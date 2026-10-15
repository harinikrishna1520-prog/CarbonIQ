# CarbonIQ

CarbonIQ is a personal carbon-footprint dashboard with a separately runnable React frontend and Express API.

## Project structure

- `frontend/` — React and Vite dashboard
- `backend/` — Express API with health and emissions calculation endpoints

## Run the backend

```sh
cd backend
npm install
copy .env.example .env
npm run dev
```

The API defaults to `http://localhost:5051`, matching the frontend development proxy and avoiding the port used by JeevaPulse. It provides:

- `GET /api/health` — API health check
- `POST /api/emissions/calculate` — calculates monthly category and total emissions

The calculation endpoint accepts non-negative numeric `electricity`, `gas`, `car`, and `flights` values in the JSON body.

## Run the frontend

In another terminal:

```sh
cd frontend
npm install
npm run dev
```

The frontend is served at `http://localhost:5173`. In development, Vite proxies `/api` requests to the backend at `http://localhost:5051`. The dashboard requests emissions calculations from the backend as activity estimates change. Saved activity estimates and the customizable monthly goal are stored in the current browser's local storage; they are not uploaded to the backend. The dashboard can export current activity estimates, calculated emissions, and the monthly goal as CSV. The estimates use simplified average emissions factors and are for personal awareness, not formal reporting.
