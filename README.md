# Terra Smart Irrigation Simulation

A React dashboard for the project's four-zone soil simulation. The Express API runs
the Python simulation and trained random-forest model, then returns zone and daily
summaries to the browser.

## Run locally

Requirements: Node.js 20.6+ and Python 3.11+ (including Python 3.14).

From PowerShell:

```powershell
Set-Location "C:\path\to\pern-app"
npm install
npm install --prefix server
npm install --prefix client
python -m pip install -r server\requirements.txt
npm run dev
```

Open <http://localhost:5173>, choose a simulation length, and select **Run
simulation**. The API is available at <http://localhost:5000/api/health>.

The local simulation does not require Neon or a `DATABASE_URL`. Set
`PYTHON_EXECUTABLE` if Python is not available as `python` on Windows or
`python3` on Linux/macOS.

## Simulation details

- The dashboard calls `POST /api/simulation/run` with a duration from 1 to 30 days.
- The API runs `server/irrigation/run_simulation.py` with the shared simulation
  core and model bundled in `server/irrigation/`.
- The default seed (2024) makes a run repeatable. A run simulates synthetic weather,
  sensor noise, and four assumed soil types; it does not read live sensors or
  control real valves.
- Valve lockout, daily watering caps, sensor validation, and fail-closed behavior
  are applied by the simulation. Soil and water-flow values are assumptions, not
  field-validated agronomic advice.

For deployment, install the Python packages in `server/requirements.txt` in the
server environment and set `PYTHON_EXECUTABLE` if needed. The `npm run build`
command creates a project-local `.venv`, installs those dependencies, and builds
the React app. On Render, set the Build Command to `npm run build` and the Start
Command to `npm start`; the deployed Node service must use a Python-capable build
environment. The server serves the built React app from `client/dist`.
