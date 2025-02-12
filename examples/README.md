# example

## Setup

1. Add Firebase service account key as `sa.json`
2. Add Gemini API key as `gemini.json` with format: `{ "key": "your-api-key" }`
3. Run `npm install`
4. Start dev server with `npm run dev`

## Project Structure

- `prompts/` - Your prompt files live here
  - `invoices/[id].prompt` - Example invoice analysis endpoint
- `schema.ts` - Output type definitions

## Available Routes

- `POST /invoices/:id` - Analyze an invoice by ID

## Development

Start the development server:
```bash
npm run dev
```

Build for production:
```bash
npm run build
npm start
```