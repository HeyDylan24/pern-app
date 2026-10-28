"""
irrigation_core.py
Shared simulation core: 4-zone field model, weather generator, sensor noise,
the Slide-10 rule table, and a closed-loop simulator used by both
generate_dataset.py and simulation_console.py.

NOTE: this is a *simulation*. Every constant marked ASSUMPTION should be
replaced by calibrated values once real sensor data is collected.
"""
import numpy as np
import pandas as pd

# ---------------------------------------------------------------- zones
# k = drying speed multiplier, fc = field capacity (%VWC)   (ASSUMPTION)
ZONES = {
    "A": dict(soil="Sandy", k=1.6, fc=36.0, temp_off=1.5, m0=30.0),
    "B": dict(soil="Loamy", k=1.0, fc=42.0, temp_off=0.0, m0=36.0),
    "C": dict(soil="Clay",  k=0.8, fc=48.0, temp_off=0.8, m0=40.0),
    "D": dict(soil="Black", k=0.7, fc=52.0, temp_off=-1.0, m0=45.0),
}
FEATURES = ["soil_moisture_pct", "soil_temp_c", "ambient_temp_c",
            "humidity_pct", "rain_prob", "hour"]
VALID_RANGES = {            # plausibility limits (Slide 5 "local validation")
    "soil_moisture_pct": (0, 100), "soil_temp_c": (-10, 80),
    "ambient_temp_c": (-10, 60), "humidity_pct": (0, 100),
    "rain_prob": (0, 1), "hour": (0, 23),
}
NOISE = dict(moisture=1.5, soil_temp=0.5, ambient=0.5, humidity=3.0)  # sensor sd
GAIN_PER_MIN = 0.25      # %VWC added per minute of irrigation   (ASSUMPTION)
FLOW_L_PER_MIN = 10.0    # litres per minute per zone valve       (ASSUMPTION)
LOCKOUT_H = 6            # valve rest period after an irrigation event
MAX_DAILY_MIN = 90       # safety cap per zone per day
DURATIONS = np.array([15, 20, 30, 45])


# ---------------------------------------------------------------- weather
def make_weather(days, seed=0):
    rng = np.random.default_rng(seed)
    n = days * 24
    t = np.arange(n); hour = t % 24; day = t // 24
    phase = rng.uniform(0, 2 * np.pi)
    base = 22 + 10 * np.sin(2 * np.pi * day / 180 + phase)             # 180-day season cycle
    daily_anom = np.convolve(rng.normal(0, 2.5, days + 4), np.ones(3) / 3, "same")[:days]
    hot_spell = np.repeat(rng.random(days) < 0.06, 24) * 4.0
    amb = base + daily_anom[day] + hot_spell + 5 * np.sin(2 * np.pi * (hour - 9) / 24) \
          + rng.normal(0, 0.4, n)
    soil = np.zeros(n); soil[0] = amb[:24].mean()
    for i in range(1, n):                       # soil temp lags air temp
        soil[i] = soil[i - 1] + 0.12 * (amb[i] - soil[i - 1])
    rain = np.zeros(n)
    for d in range(days):
        if rng.random() < 0.10:
            start = d * 24 + rng.integers(0, 20); dur = rng.integers(1, 5)
            rain[start:start + dur] += rng.uniform(2, 20) / dur
    hum = np.clip(75 - 1.6 * (amb - 25) + rng.normal(0, 4, n) + (rain > 0) * 15, 25, 98)
    ahead = np.array([rain[i:i + 6].sum() for i in range(n)])
    prob = np.clip(np.where(ahead > 1, 0.8, 0.1) + rng.normal(0, 0.12, n), 0, 1)
    return dict(n=n, hour=hour, amb=amb, soil=soil, hum=hum, rain=rain, rain_prob=prob)


# ---------------------------------------------------------------- Slide-10 rule table
def rule_decision(soil_t, m, rain_prob=0.0, hour=12):
    """Slide-10 table. Returns (decision_name, duration_min); duration > 0 = soil needs water.
    Valve lockout / daily cap are NOT here - they live in the safety layer."""
    if soil_t < 10:
        return "NO_IRRIGATION", 0
    if soil_t <= 20:
        thr, name, dur, skip = 25, "IRRIGATE", 20, "SKIP"
    elif soil_t <= 30:
        thr, name, dur, skip = 30, "IRRIGATE", 30, "MONITOR"
    else:
        thr, name, dur, skip = 35, "URGENT", 45, "COOL_IRRIGATE"
    if m < thr:
        if rain_prob >= 0.6 and m >= 0.7 * thr:
            return "RAIN_HOLD", 0
        return name, dur
    if skip == "COOL_IRRIGATE":                       # hot but not dry: cool in daytime only
        if 11 <= hour <= 17 and rain_prob < 0.6:
            return "COOL_IRRIGATE", 15
        return "NO_NEED", 0
    return skip, 0


def sensor_obs(true, rng, noise=True):
    """Turn true state into what the sensors report (adds noise)."""
    o = dict(true)
    if noise:
        o["soil_moisture_pct"] += rng.normal(0, NOISE["moisture"])
        o["soil_temp_c"] += rng.normal(0, NOISE["soil_temp"])
        o["ambient_temp_c"] += rng.normal(0, NOISE["ambient"])
        o["humidity_pct"] += rng.normal(0, NOISE["humidity"])
    return o


# ---------------------------------------------------------------- closed-loop simulator
def simulate(controller, days=30, seed=0, zones=None, obs_noise=True,
             label_with_truth=False, start="2025-01-01", fault_rate=0.0):
    """
    controller(list_of_obs_dicts) -> list of (pump_on, duration_min), one per zone.
    If label_with_truth=True, the rule table is evaluated on TRUE state and
    stored as the label (used to build the training dataset).
    Returns a per-zone-per-hour DataFrame log.
    """
    zones = zones or list(ZONES)
    W = make_weather(days, seed)
    rng = np.random.default_rng(seed + 1)
    m = {z: ZONES[z]["m0"] for z in zones}
    since = {z: 99 for z in zones}
    day_min = {z: 0 for z in zones}
    ts0 = pd.Timestamp(start)
    rows = []
    for t in range(W["n"]):
        h = int(W["hour"][t])
        if h == 0:
            day_min = {z: 0 for z in zones}
            # exploration for dataset building: on some days the "behaviour" policy acts late/rarely,
            # so the data also covers very dry soil (labels still come from the rule on TRUE state)
            act_p = rng.choice([1.0, 0.3, 0.05]) if label_with_truth else 1.0
        trues, obs = [], []
        for z in zones:
            zc = ZONES[z]
            true = dict(zone=z, soil_moisture_pct=m[z],
                        soil_temp_c=W["soil"][t] + zc["temp_off"],
                        ambient_temp_c=W["amb"][t], humidity_pct=W["hum"][t],
                        rain_prob=W["rain_prob"][t], hour=h,
                        hours_since_irrigation=min(since[z], 48))
            ob = sensor_obs(true, rng, obs_noise)
            if fault_rate and rng.random() < fault_rate:
                ob["soil_moisture_pct"] = float("nan")           # simulated sensor dropout
            trues.append(true); obs.append(ob)
        if label_with_truth:
            acts = []
            for tr in trues:
                name, dur = rule_decision(tr["soil_temp_c"], tr["soil_moisture_pct"],
                                          tr["rain_prob"], tr["hour"])
                acts.append((int(dur > 0), dur, name))
        else:
            acts = [(a[0], a[1], "") for a in controller(obs)]
        for z, tr, ob, (on, dur, name) in zip(zones, trues, obs, acts):
            zc = ZONES[z]
            need, need_dur = int(on), int(dur)                  # what the policy wanted
            if label_with_truth and on and rng.random() > act_p:
                on, dur = 0, 0                                  # exploration: skip acting
            if on and (since[z] < LOCKOUT_H or day_min[z] + dur > MAX_DAILY_MIN):
                on, dur = 0, 0                                  # hard safety layer
            gain = GAIN_PER_MIN * dur if on else 0.0
            if on:
                since[z] = 0; day_min[z] += dur
            else:
                since[z] += 1
            loss = zc["k"] * (0.20 + 0.03 * max(W["amb"][t] - 12, 0)) * (1 - W["hum"][t] / 160)
            mm = m[z] - loss + W["rain"][t] * 0.35 + gain
            if mm > zc["fc"]:
                mm = zc["fc"] + (mm - zc["fc"]) * 0.5            # drainage
            m[z] = float(np.clip(mm, 3, 60))
            rows.append(dict(
                timestamp=ts0 + pd.Timedelta(hours=t), zone=z, soil_type=zc["soil"],
                soil_temp_c=round(ob["soil_temp_c"], 2),
                soil_moisture_pct=round(ob["soil_moisture_pct"], 2),
                ambient_temp_c=round(ob["ambient_temp_c"], 2),
                humidity_pct=round(float(np.clip(ob["humidity_pct"], 0, 100)), 2),
                rain_prob=round(ob["rain_prob"], 2), hour=h,
                hours_since_irrigation=ob["hours_since_irrigation"],
                decision=name, irrigate_needed=need, needed_duration_min=need_dur,
                pump_on=int(on), duration_min=int(dur) if on else 0,
                true_moisture_pct=round(tr["soil_moisture_pct"], 2),
                water_l=(dur * FLOW_L_PER_MIN) if on else 0.0))
    return pd.DataFrame(rows)
