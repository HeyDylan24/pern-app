import json
import sys
import warnings
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from irrigation_core import (
    DURATIONS,
    FEATURES,
    VALID_RANGES,
    ZONES,
    simulate,
)

warnings.filterwarnings("ignore")

HERE = Path(__file__).resolve().parent
MODEL_PATH = HERE / "irrigation_model_v2.pkl"


def valid_observation(observation):
    for feature in FEATURES:
        value = observation.get(feature)
        lower, upper = VALID_RANGES[feature]
        if value is None or not np.isfinite(value) or value < lower or value > upper:
            return False
    return True


def build_controller(bundle):
    classifier = bundle["classifier"]
    regressor = bundle["regressor"]
    threshold = bundle["threshold"]

    def controller(observations):
        actions = [(0, 0)] * len(observations)
        valid_indexes = [
            index
            for index, observation in enumerate(observations)
            if valid_observation(observation)
        ]
        if not valid_indexes:
            return actions

        features = pd.DataFrame(
            [
                {name: observations[index][name] for name in FEATURES}
                for index in valid_indexes
            ]
        )
        probabilities = classifier.predict_proba(features)[:, 1]
        durations = regressor.predict(features)
        for offset, index in enumerate(valid_indexes):
            if probabilities[offset] >= threshold:
                duration = int(DURATIONS[np.argmin(np.abs(DURATIONS - durations[offset]))])
                actions[index] = (1, duration)
        return actions

    return controller


def run(days, seed):
    bundle = joblib.load(MODEL_PATH)
    log = simulate(build_controller(bundle), days=days, seed=seed, fault_rate=0.005)
    log["day"] = (log["timestamp"] - log["timestamp"].min()).dt.days + 1

    daily = []
    for day, day_log in log.groupby("day", sort=True):
        zone_rows = []
        for zone, config in ZONES.items():
            zone_log = day_log[day_log["zone"] == zone]
            zone_rows.append(
                {
                    "zone": zone,
                    "soil": config["soil"],
                    "meanMoisturePct": round(float(zone_log["true_moisture_pct"].mean()), 1),
                    "irrigationEvents": int(zone_log["pump_on"].sum()),
                    "durationMinutes": int(zone_log["duration_min"].sum()),
                    "waterLitres": round(float(zone_log["water_l"].sum())),
                }
            )
        daily.append(
            {
                "day": int(day),
                "meanMoisturePct": round(float(day_log["true_moisture_pct"].mean()), 1),
                "waterLitres": round(float(day_log["water_l"].sum())),
                "irrigationEvents": int(day_log["pump_on"].sum()),
                "zones": zone_rows,
            }
        )

    zone_summaries = []
    for zone, config in ZONES.items():
        zone_log = log[log["zone"] == zone]
        zone_summaries.append(
            {
                "zone": zone,
                "soil": config["soil"],
                "meanMoisturePct": round(float(zone_log["true_moisture_pct"].mean()), 1),
                "finalMoisturePct": round(float(zone_log["true_moisture_pct"].iloc[-1]), 1),
                "irrigationEvents": int(zone_log["pump_on"].sum()),
                "durationMinutes": int(zone_log["duration_min"].sum()),
                "waterLitres": round(float(zone_log["water_l"].sum())),
            }
        )

    moisture = log["true_moisture_pct"]
    capacity = log["zone"].map({zone: config["fc"] for zone, config in ZONES.items()})
    return {
        "model": bundle["meta"]["model"],
        "seed": seed,
        "days": days,
        "summary": {
            "waterLitres": round(float(log["water_l"].sum())),
            "irrigationEvents": int(log["pump_on"].sum()),
            "meanMoisturePct": round(float(moisture.mean()), 1),
            "stressHoursPct": round(float((moisture < 20).mean() * 100), 2),
            "comfortHoursPct": round(float(((moisture >= 25) & (moisture <= capacity)).mean() * 100), 2),
        },
        "zones": zone_summaries,
        "daily": daily,
    }


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("Expected simulation days and seed.")
    days = int(sys.argv[1])
    seed = int(sys.argv[2])
    if not 1 <= days <= 30 or not 0 <= seed <= 4_294_967_295:
        raise SystemExit("Simulation input is outside the allowed range.")
    print(json.dumps(run(days, seed), allow_nan=False))
