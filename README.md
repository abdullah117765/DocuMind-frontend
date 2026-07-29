# Project 1

A React application built with Vite and organized by feature.

## Project structure

```text
src/
|-- features/
|   |-- auth/
|   |   |-- components/
|   |   |-- pages/
|   |   |-- hooks/
|   |   |-- services/
|   |   `-- context/
|   |-- users/
|   |   |-- components/
|   |   |-- pages/
|   |   |-- services/
|   |   `-- hooks/
|   `-- dashboard/
|       |-- components/
|       `-- pages/
|-- shared/
|   |-- components/
|   |   |-- Button/
|   |   |-- Input/
|   |   |-- Modal/
|   |   `-- Loader/
|   |-- hooks/
|   |-- utils/
|   |-- constants/
|   `-- assets/
|-- routes/
|-- App.jsx
`-- main.jsx
```

Feature-specific code stays inside its feature. Only reusable UI, hooks,
utilities, constants, and assets belong under `src/shared`.

## API contract

The API utilities support the response envelopes documented in
`must follow.txt`:

- `apiRequest` sends and accepts JSON and throws a normalized `ApiError`.
- `getResponseData` unwraps successful response data.
- `getPagination` reads pagination metadata.
- `getValidationIssues` returns field-level validation issues.

Copy `.env.example` to `.env` and update `VITE_API_BASE_URL` before connecting
the application to a backend.

## Commands

```bash
npm run dev
npm run build
npm run lint
npm run preview
```
