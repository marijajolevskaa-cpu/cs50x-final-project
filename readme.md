# VerseSpace 🪶

![Cypress Tests](https://github.com/marijajolevskaa-cpu/cs50x-final-project/actions/workflows/cypress.yml/badge.svg)

**A full-stack poetry marketplace that connects people who want a custom poem with poets who write them.**

▶️ **[Watch the 2-minute demo](https://youtu.be/oF8zSlt8bOs)**

VerseSpace is a two-sided web marketplace: clients post paid requests for
personalized poems, and registered poets browse those requests and bid to fulfil
them. I built it as my CS50 final project to practise designing a complete
application end to end — a relational database, a JSON REST API, and a reactive
single-page interface — using Flask and vanilla JavaScript, with no front-end
frameworks. It also includes a **third-party AI integration** and an automated test
suite covering both the backend and the browser, running in CI.

---

## Why I built it

Most beginner projects are one-directional (a user acts, the app responds).
I wanted something with **two distinct user roles and a real transaction between
them**, because that forces harder design decisions: separate registration and
data models for clients and poets, a bidding relationship that links them, rules
like "one bid per poet per request," and a shared board that updates as new
requests and bids come in. Getting those pieces to work together taught me far
more than another single-user CRUD app would have.

## How it works

**Clients** submit a poem request describing the occasion, tone, recipient,
personal details, and budget. The request is saved and appears immediately on a
shared, paginated requests board — no page reload.

**Poets** register with their name, email, specialty, a writing sample, and a
starting rate, then browse open requests and place a single bid on any they'd like
to write.

Every interaction — submitting a request, registering, bidding — happens
asynchronously through the API and updates the interface in place.

## Key features

- **Two-sided marketplace** — separate flows and data models for clients and poets.
- **Bidding system** — poets bid on requests, enforced to one application each.
- **JSON REST API** — a clean set of endpoints the frontend consumes.
- **Reactive frontend without a framework** — modals, async form submission, live
  board refresh, dynamic pagination, and toast notifications, all in plain
  JavaScript.
- **Third-party AI integration** — an "AI suggestions" feature that calls an
  external LLM API to help clients write clearer requests (see below).
- **Relational data model** — requests, poets, and bids as related tables.

## Third-party AI integration

VerseSpace integrates an external LLM API to suggest improvements to a client's
draft request — helping clients write clearer requests so human poets can bid
better. The integration is **assistive, not a replacement**: it never writes poems,
so it supports the marketplace rather than undermining the value of human poets.

Implementation details that matter:
- **Authentication** via a Bearer token, with the API key and URL read from
  **environment variables** — no secrets hardcoded or committed.
- **Error handling with graceful degradation** — if the external service is
  unavailable, the endpoint returns a clean `503` and the UI shows a friendly
  message instead of breaking.
- The integration logic lives in its own module (`ai_helper.py`), isolated so it is
  easy to reason about and to mock in tests.

## Data integrity & validation

Correctness is enforced on the server, not just in the UI:

- **Parameterized queries everywhere** — user input can never be executed as SQL.
- **One bid per poet per request** — guaranteed by a `UNIQUE (request_id, poet_id)`
  constraint, with an application-level check returning a clean `409 Conflict`.
- **Foreign keys with cascade deletes**, enforced on every connection.
- **Server-side validation** — required fields, an allowlist of valid tones, and
  minimum budget/bid amounts, all checked on the authoritative backend.

## Testing

The project is tested at **two layers with two frameworks**, and the end-to-end
suite runs automatically in **CI** on every push.

**Backend — pytest (`test_api.py`).** API tests using Flask's test client, each
against a fresh temporary SQLite database for full isolation. Coverage includes:
- Happy paths (create poet, create request, place a bid).
- The bid rule, both sides — a poet cannot bid twice on the same request (`409`),
  and the same poet *can* bid on different requests (`201`).
- Validation & error cases — invalid tone (`400`), missing field (`400`), bid below
  minimum (`400`), bids on a non-existent request or poet (`404`).
- The AI integration — the external call is **mocked** (`unittest.mock`) to test both
  the success path and graceful failure (`503`), with no real API call.

**Frontend — Cypress (`cypress/e2e/`).** End-to-end tests that drive the real UI in
a browser and use **`cy.intercept()`** to mock the AI API at the network level —
testing that the interface shows the suggestions on success and a friendly message
on failure, without any real service.

**Continuous integration.** A GitHub Actions workflow
(`.github/workflows/cypress.yml`) runs the Cypress suite on every push: it installs
dependencies, **starts the Flask app, waits for it to be ready**, then runs the
end-to-end tests against the live application.

```bash
# backend tests
pip install -r requirements.txt
pytest -v

# frontend tests (app must be running in another terminal)
npm install
npx cypress open      # interactive runner
# or: npx cypress run  # headless (the way CI runs them)
```

## Tech stack

**Backend:** Python · Flask · SQLite
**Frontend:** HTML · CSS · Vanilla JavaScript (async `fetch`, no frameworks)
**Integration:** external LLM REST API (Bearer-token auth, env-var config)
**Testing:** pytest · Flask test client · Cypress (`cy.intercept`)
**CI:** GitHub Actions (starts the app, waits for readiness, runs E2E tests)

## REST API

| Method | Route | Purpose |
|--------|-------|---------|
| `GET`  | `/` | Render the homepage |
| `GET`  | `/api/requests` | Return all poem requests as JSON |
| `POST` | `/api/requests` | Create a new poem request |
| `POST` | `/api/poets` | Register a poet |
| `POST` | `/api/requests/<id>/bids` | Submit a bid on a request |
| `GET`  | `/api/poets/<id>/bids` | List a poet's bids |
| `POST` | `/api/suggest-improvements` | AI suggestions for a draft request |
| `GET`  | `/api/health` | Health check |

## Database

SQLite stores three related tables — **requests**, **poets**, and **bids** — with
the schema initialized from `schema.sql`. The `poem_bids` table enforces
`UNIQUE (request_id, poet_id)` and cascades on delete from both parents.

## Project structure

```
project/
├── app.py                  # Flask app + API routes
├── ai_helper.py            # third-party LLM integration
├── schema.sql              # database schema
├── test_api.py             # pytest API & integration tests
├── cypress/e2e/            # Cypress end-to-end tests
├── cypress.config.js
├── .github/workflows/      # Cypress CI workflow
├── templates/              # layout.html, index.html, request.html
├── static/                 # css.css, js.js
└── README.md
```

## Running locally

Requires Python 3 and Node.js (for the Cypress tests).

```bash
pip install -r requirements.txt
python app.py            # starts on http://127.0.0.1:5050
```

---

*CS50 final project — a full-stack web application demonstrating REST API design,
relational data modeling with enforced integrity constraints, a third-party API
integration with authentication and graceful failure handling, and automated
testing at two layers (pytest backend mocks and Cypress frontend intercepts) with
end-to-end tests running in CI.*
