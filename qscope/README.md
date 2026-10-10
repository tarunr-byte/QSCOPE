# QSCOPE

**Quantum Sensor Condition Observation & Prognostics Engine**

QSCOPE is a precision scientific computing platform designed for quantum-sensor condition observation, uncertainty analysis, estimator-reliability assessment, and automated decision-support.

The platform couples high-precision atomic and quantum sensor models with the **Q-SCOPE risk certificate engine** (analyzing $d_{\text{mean}}$ nonlinear discrepancy bounds) and a **4-qubit Statevector Quantum Monitor** with adaptive CUSUM drift detection.

Interface design conventions follow the **IBM Quantum Platform** and **Carbon Design System** in the **Quantum Precision White** palette.

---

## Architecture Overview

1. **4-Qubit Statevector Quantum Monitor**: Maps extracted sensor features $[mean, std, slope, abs\_diff\_mean]$ to rotation angles $[\theta_0, \theta_1, \theta_2, \theta_3]$, evaluates state overlap fidelity $F_t = |\langle\psi_0|\psi_t\rangle|^2$, and tracks subtle drift via an adaptive CUSUM accumulator ($k=0.002, h=0.05$).
2. **Q-SCOPE Risk Certificate**: Evaluates $d_{\text{mean}}$ nonlinear discrepancy bounds:
   $$d_{\text{mean}} = \frac{|\mathbb{E}[p(\phi)] - p(\mu)|}{\sqrt{\text{Var}[p(\phi)] + 1/(4N)}}$$
   certifying whether the Extended Kalman Filter (EKF) linear approximation remains valid.
3. **Three-State Decision Policy**: Automatically routes tracking between linear EKF (`STAY_EKF`), nonlinear grid estimation (`ESCALATE_NONLINEAR`), and mission abstention (`ABSTAIN`).
4. **IBM Quantum-Inspired UI**: Built with React 18, Vite, Tailwind CSS, and IBM Carbon UI patterns:
   - **Overview**: Compute resources fleet table, 4-qubit coupling map, system metric tiles.
   - **Analyze**: 3-stage live pipeline (Oscilloscope -> 4Q Core -> Decision Terminal) + multi-channel telemetry charts.
   - **Risk Certificates**: Interactive $d_{\text{mean}}$ gauge, sensitivity matrix, and envelope sliders.
   - **Runs & Audit**: Carbon DataTable with filters, row expansion, SQLite audit logs, and JSON/CSV export.
   - **Health Monitor**: Statevector fidelity, CUSUM drift monitoring, and baseline calibration wizard.
5. **Multi-Sensor Platform Presets**:
   - `CAG-87`: Cold-Atom Gravimeter ($^{87}\text{Rb}$ Atom Interferometer)
   - `Q-IMU-X4`: Quantum Inertial Unit (Dual-Beam Sagnac Gyroscope)
   - `OPM-SERF`: SERF Atomic Magnetometer (Optically Pumped Vapor Cell)
   - `SQG-CRYO`: Superconducting Metrology (Josephson Flux Qubit Link)

---

## Deploy to Vercel (Frontend + Backend Together)

This repository is configured for a **unified single-project Vercel deployment** (`vercel.json`):

1. Push this directory to your GitHub account:
   ```cmd
   git init
   git add .
   git commit -m "Initial commit of QSCOPE platform"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo-name>.git
   git push -u origin main
   ```

2. On [Vercel](https://vercel.com):
   - Click **Add New Project** -> Import your GitHub repository.
   - Leave **Root Directory** as `./`.
   - Click **Deploy**.
   - Vercel will automatically build the Vite React frontend into `frontend/dist` and deploy the FastAPI backend at `api/index.py` on the exact same domain with no CORS setup required.

---

## Local Development

### 1. Backend Server (FastAPI)
```cmd
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
- API Docs: **http://127.0.0.1:8000/docs**
- Health Check: **http://127.0.0.1:8000/health**

### 2. Frontend Development Server (Vite)
In a second terminal:
```cmd
cd frontend
npm install
npm run dev
```
- QSCOPE UI: **http://localhost:3000**

### 3. Run Automated Tests
```cmd
python -m pytest tests
```
*(All 14 unit and integration tests pass).*
