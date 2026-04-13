# banana.splitt 🍌

A lightweight cost-splitting web app — track shared expenses across trips and see who owes what.

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later

## Getting started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Start the server**

   ```bash
   npm start
   ```

3. **Open the app**

   Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

## Development mode

Run the server with automatic restarts on file changes:

```bash
npm run dev
```

## Running tests

```bash
npm test
```

## Configuration

| Environment variable | Default            | Description                        |
|----------------------|--------------------|------------------------------------|
| `PORT`               | `3000`             | Port the server listens on         |
| `DATA_FILE_OVERRIDE` | `data/trips.json`  | Path to the JSON data file         |
