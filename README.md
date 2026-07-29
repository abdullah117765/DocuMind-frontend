# Project 1

A React application built with Vite and organized by feature.

## Project structure

```text
src/
|-- app/                 # Root application component and app-level styles
|-- assets/              # Static assets imported by components
|-- config/              # Environment and application configuration
|-- features/            # Feature modules
|   |-- counter/
|   `-- home/
|-- services/
|   `-- api/             # API client, response helpers, and API errors
|-- index.css            # Global styles and design tokens
`-- main.jsx             # React entry point
```

New feature-specific components, hooks, and services should remain inside their
feature folder. Only code shared by multiple features belongs in a top-level
shared folder or in `services`.

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
