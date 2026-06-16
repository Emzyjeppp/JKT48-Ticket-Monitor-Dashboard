# Contributing to JKT48 Ticket Monitor

Thank you for your interest in contributing to the JKT48 Ticket Monitor! We welcome contributions to make this project better for the JKT48 community.

Please take a moment to review this document before getting started.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How to Contribute](#how-to-contribute)
  - [Reporting Bugs](#reporting-bugs)
  - [Suggesting Features](#suggesting-features)
  - [Submitting Pull Requests](#submitting-pull-requests)
- [Local Development Setup](#local-development-setup)

## Code of Conduct

This project and everyone participating in it is governed by the [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## How to Contribute

### Reporting Bugs

If you find a bug or issue (e.g., ticket data not updating, layout breaks on mobile, rate limits):
1. Check the existing issues to see if it has already been reported.
2. If not, open a new issue using the **Bug Report** template.
3. Provide as much context as possible (browser details, console logs, screenshots).

### Suggesting Features

If you have ideas for new features or improvements:
1. Open a new issue using the **Feature Request** template.
2. Explain the goal of the feature and how it benefits users.

### Submitting Pull Requests

1. Fork the repository.
2. Create a new branch for your feature or bug fix:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. Make your changes and commit them with descriptive messages.
4. Push your branch to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```
5. Submit a Pull Request (PR) to the `main` branch of this repository.

## Local Development Setup

To test and run the project locally:

1. Clone your fork of the repository.
2. Run a local HTTP server to view the frontend (e.g., VS Code Live Server, or Python's `http.server`):
   ```bash
   python -m http.server 8000
   ```
3. The protection script `security.js` will automatically disable itself on `localhost` or local file systems so you can debug comfortably.
4. For backend / Cloudflare Workers changes:
   - Install dependencies: `npm install`
   - Run Wrangler locally: `npx wrangler dev cloudflare-worker.js`
