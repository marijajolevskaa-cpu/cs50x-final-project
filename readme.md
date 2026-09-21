# VerseSpace 🪶

**A full-stack poetry marketplace that connects people who want a custom poem with poets who write them.**

▶️ **[Watch the 2-minute demo](https://youtu.be/oF8zSlt8bOs)**

VerseSpace is a two-sided web marketplace: clients post paid requests for
personalized poems, and registered poets browse those requests and bid to fulfil
them. I built it as my CS50 final project to practise designing a complete
application end to end — a relational database, a JSON REST API, and a reactive
single-page interface — using Flask and vanilla JavaScript, with no front-end
frameworks.

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
- **Relational data model** — requests, poets, and bids as related tables.

## Data integrity & validation

Correctness is enforced on the server, not just in the UI:

- **Parameterized queries everywhere** — every SQL statement uses bound parameters,
  so user input can never be executed as SQL (no injection).
- **One bid per poet per request** — guaranteed by a `UNIQUE (request_id, poet_id)`
  constraint in the schema, with an application-level check that returns a clean
  `409 Conflict` ("you have already applied") instead of a database error.
- **Foreign keys with cascade deletes** — bids reference requests and poets with
  `ON DELETE CASCADE`, and foreign-key enforcement is enabled on every connection
  so referential integrity actually holds at runtime.
- **Server-side validation** — required fields, an allowlist of valid tones, and
  minimum budget/bid amounts are all checked on the backend, which is treated as
  the authoritative source of truth even though the frontend validates too.

## Tech stack

**Backend:** Python · Flask · SQLite
**Frontend:** HTML · CSS · Vanilla JavaScript (async `fetch`, no frameworks)

## REST API

| Method | Route | Purpose |
|--------|-------|---------|
| `GET`  | `/` | Render the homepage |
| `GET`  | `/api/requests` | Return all poem requests as JSON |
| `POST` | `/api/requests` | Create a new poem request |
| `POST` | `/api/poets` | Register a poet |
| `POST` | `/api/requests/<id>/bids` | Submit a bid on a request |
| `GET`  | `/api/poets/<id>/bids` | List a poet's bids |
| `GET`  | `/api/health` | Health check |

## Database

SQLite stores three related tables — **requests**, **poets**, and **bids** — with
the schema initialized from `schema.sql`. The `poem_bids` table enforces
`UNIQUE (request_id, poet_id)` and cascades on delete from both parents.

## Project structure

```
project/
├── app.py              # Flask app + API routes
├── schema.sql          # database schema
├── templates/
│   ├── layout.html
│   └── index.html
├── static/
│   ├── style.css
│   └── js.js
└── README.md
```

## Running locally

Requires Python 3.

```bash
# install Flask
pip install flask

# run the app (creates the SQLite database on first run)
python app.py
```

Then open the address it prints (`http://127.0.0.1:5050`).

---

*CS50 final project — a full-stack web application demonstrating REST API design,
relational data modeling with enforced integrity constraints, server-side
validation, and an async, framework-free JavaScript frontend.*
