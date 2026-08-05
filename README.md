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

## Authentication integration

Copy `.env.example` to `.env` before starting the app:

```env
VITE_API_BASE_URL=http://localhost:3000/api
```

The NestJS backend must allow the exact Vite origin:

```env
FRONTEND_URL=http://localhost:5173
```

Authentication uses access and refresh tokens in `HttpOnly` cookies. Every
request includes browser credentials, and sensitive mutations first obtain a
signed token from `GET /auth/csrf`. Tokens are never stored in local storage.
Expired access cookies are recovered with one coordinated refresh request so
refresh-token rotation is safe when multiple API requests fail together.

Implemented routes:

- `/register`
- `/login`
- `/verify-email?token=...`
- `/forgot-password`
- `/reset-password?email=...`
- `/dashboard`
- `/account/sessions`

The app restores the current user from `/auth/me`, protects private routes,
maps backend validation details onto form fields, supports password-reset OTPs
with leading zeroes, and provides single-device and all-device logout.

The backend Swagger contract is available at
`http://localhost:3000/api/docs`.

## Commands

```bash
npm run dev
npm run build
npm run lint
npm run preview
```
