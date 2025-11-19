# RepoPulse Client

A React + TypeScript + Tailwind CSS dashboard for GitHub Pull Requests with LLM-generated summaries.

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The app will be available at `http://localhost:5173` (or the port Vite assigns).

### Build

```bash
npm run build
```

## Features

- **Login Page**: Fake authentication (no real credentials required)
- **PR List Page**: View all pull requests with filtering and search
- **PR Detail Page**: View detailed PR information including summaries and file changes
- **Mock API**: All API calls are mocked with in-memory data

## Project Structure

```
src/
  ├── api/           # Mock API client
  ├── components/    # Reusable components
  ├── context/       # React context (Auth)
  ├── pages/         # Page components
  ├── types/         # TypeScript type definitions
  ├── App.tsx        # Main app component with routing
  ├── main.tsx       # Entry point
  └── index.css      # Tailwind CSS imports
```

## Tech Stack

- **Vite** - Build tool
- **React 18** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **React Router DOM** - Routing

