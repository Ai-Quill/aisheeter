# Contributing to AISheeter

Thanks for your interest in contributing! AISheeter is an open-source Google Sheets add-on that brings multi-model AI to spreadsheets.

## Getting Started

1. Fork the repository
2. Clone your fork locally
3. Set up the development environment (see README.md)
4. Create a feature branch from `main`

## Development Setup

### Backend (Next.js)
```bash
cd backend
npm install
cp .env.example .env.local
# Fill in your environment variables
npm run dev
```

### Frontend (Google Apps Script)
```bash
cd frontend
# Install clasp globally if not already
npm install -g @google/clasp

# Login to Google
clasp login

# Update .clasp.json with your script ID
# Push to Apps Script
clasp push
```

## What to Contribute

We welcome contributions in these areas:

- **Bug fixes** -- find and fix issues
- **New AI model support** -- add providers to the model registry
- **Formula catalogs** -- expand the Google Sheets formula knowledge base
- **UI improvements** -- enhance the sidebar experience
- **Documentation** -- improve setup guides, add examples
- **Translations** -- add language support via `Sidebar_i18n.html`

## Pull Request Process

1. Create a descriptive branch name (`fix/model-selection-bug`, `feat/deepseek-support`)
2. Write clear commit messages
3. Test your changes locally (backend builds, frontend pushes to GAS)
4. Open a PR with a description of what and why

## Code Style

- TypeScript strict mode for backend code
- Follow existing patterns in the codebase
- No unnecessary dependencies

## Questions?

Open an issue or reach out at [aisheeter.com](https://www.aisheeter.com).
