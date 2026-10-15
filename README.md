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

The API defaults to `http://localhost:5000`. It provides:

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

The frontend is served at `http://localhost:5173`. The dashboard currently calculates estimates in the browser; the backend calculation endpoint is available for API integration. The estimates use simplified average emissions factors and are for personal awareness, not formal reporting. Activity values are not uploaded or persisted.
