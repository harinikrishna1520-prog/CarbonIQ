# CarbonIQ

CarbonIQ is a lightweight personal carbon-footprint dashboard. Adjust estimated monthly activity for electricity, natural gas, car travel, and flights to see an immediate estimate of the associated emissions and category shares.

## Run locally

```sh
npm install
npm run dev
```

## Build

```sh
npm run build
```

The calculator uses simplified average emissions factors in `src/App.jsx`. Results are for personal awareness and are not intended for formal emissions reporting. Activity values currently live in the page state and are not uploaded or persisted.
