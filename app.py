from __future__ import annotations
# Enables newer Python type hint syntax on older Python versions

import sqlite3
# Python's built-in library for working with SQLite databases
# SQLite stores everything in a single .db file — no separate server needed

from pathlib import Path
# Modern way of working with file paths
# Works on Windows, Mac, and Linux without changes

from typing import Any, Dict
# Type hints — tells Python and your editor what types variables should be
# Any means "this can be any type" — used when we don't know what JSON will contain
# Dict means "this is a dictionary" — used for the JSON payload from requests

from flask import Flask, jsonify, request, render_template
# Flask — the web framework that runs the server and handles HTTP requests
# jsonify — converts a Python dict into a proper JSON HTTP response
# request — Flask's object containing everything about the incoming HTTP request
# render_template — reads an HTML file from templates/ and returns it as a response


# ─── PATHS ────────────────────────────────────────────────────────────────────

BASE_DIR = Path(__file__).resolve().parent
# __file__ is the path to app.py
# .resolve() converts it to an absolute path
# .parent gets the folder containing app.py
# Used as the base for all other paths so the app works
# regardless of where it is run from

DB_PATH = BASE_DIR / "versespace.db"
# Full path to the SQLite database file
# SQLite creates this file automatically if it doesn't exist yet

SCHEMA_PATH = BASE_DIR / "schema.sql"
# Full path to the SQL schema file
# schema.sql contains the CREATE TABLE statements


# ─── FLASK APP ────────────────────────────────────────────────────────────────

app = Flask(__name__, template_folder="templates", static_folder="static", static_url_path="/static")
# Creates the Flask application instance
# __name__ tells Flask the name of the current module
# template_folder — Flask looks here when render_template() is called
# static_folder — where CSS, JS, and image files live
# static_url_path — the URL prefix for static files (/static/css.css)


# ─── VALIDATION SET ───────────────────────────────────────────────────────────

TONE_OPTIONS = {"warm", "romantic", "hopeful", "reflective"}
# The only valid tone values — matches the <select name="tone"> options in the form
# Used in create_request() to reject anything not in this set


# ─── DATABASE HELPERS ─────────────────────────────────────────────────────────

def get_db() -> sqlite3.Connection:
    # Opens and returns a new connection to the SQLite database
    # We open a new connection per request because SQLite connections
    # are not safe to share across threads
    conn = sqlite3.connect(DB_PATH)
    # Opens the database file — creates it automatically if it doesn't exist

    conn.row_factory = sqlite3.Row
    # Makes rows behave like dicts so you can write row["occasion"]
    # instead of row[1] — much more readable and less error-prone

    return conn


def init_db() -> None:
    # Creates the database tables if they don't already exist
    # Called once when the server starts
    # CREATE TABLE IF NOT EXISTS in schema.sql means existing data is never wiped
    schema = SCHEMA_PATH.read_text(encoding="utf-8")
    # Reads the entire schema.sql file as a string

    with get_db() as conn:
        # 'with' is a context manager — commits on success, rolls back on failure
        conn.executescript(schema)
        # Runs all the CREATE TABLE statements in schema.sql at once


def to_int(value: Any, default: int = 0) -> int:
    # Safely converts any value to an integer
    # Returns default if conversion fails instead of crashing
    # Needed because JSON values can arrive as strings, floats, or None
    # e.g. budget might be "30", 30.0, or None — all handled safely
    try:
        return int(value)
    except (TypeError, ValueError):
        # TypeError: value is None or non-numeric
        # ValueError: value is a string like "abc" that can't convert
        return default


def json_error(message: str, status_code: int = 400):
    # Returns a consistent JSON error response as a (response, status) tuple
    # Flask handles tuples automatically — sends the response with the status code
    # status_code defaults to 400 Bad Request — means the client sent invalid data
    # 404 Not Found is used when a poet or request doesn't exist in the database
    return jsonify({"ok": False, "error": message}), status_code
    # ok: False signals failure to the JS
    # error: message is shown in the toast notification


# ─── ROUTES ───────────────────────────────────────────────────────────────────
# A route is a URL pattern + HTTP method that Flask listens for
# @app.get() handles GET requests (fetching data)
# @app.post() handles POST requests (sending/saving data)


@app.get("/")
def index():
    # Serves the homepage
    # Flask reads templates/index.html, processes Jinja2 tags,
    # and sends the result back as an HTML response
    return render_template("index.html")


@app.get("/api/health")
def health():
    # Simple check to confirm the server is running
    # Visit /api/health in the browser — you'll see the JSON response
    return jsonify({"ok": True, "service": "versespace-backend"})


@app.get("/api/requests")
def list_requests():
    # Returns every poem request in the database, newest first
    # Called by JS on page load and on refresh to populate the requests board
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT
              id,          -- database row id, used as data-request-id in bid forms
              occasion,    -- e.g. "Wedding", "Birthday"
              tone,        -- e.g. "warm", "romantic"
              subject,     -- who the poem is for
              detail,      -- the key memory the client shared
              budget,      -- what the client wants to pay in euros
              total_price, -- equals budget since there is no surcharge
              created_at   -- timestamp when the request was submitted
            FROM poem_requests
            ORDER BY id DESC
            -- Newest requests first (highest id = most recently inserted)
            """
        ).fetchall()
        # fetchall() returns every row as a list
        # Each row behaves like a dict because of row_factory = sqlite3.Row

    requests_payload = [
        # List comprehension — loops over every row and builds a dict
        # jsonify() will convert this list of dicts into a JSON array
        {
            "id": row["id"],
            "occasion": row["occasion"],
            "tone": row["tone"],
            "subject": row["subject"],
            "detail": row["detail"],
            "budget": row["budget"],
            "totalPrice": row["total_price"],
            # total_price equals budget — no paper surcharge in this version
            "minimumApplyAmount": row["total_price"],
            # Poets must bid at least this amount — prevents undercutting the client
            "createdAt": row["created_at"],
        }
        for row in rows
    ]

    return jsonify({"ok": True, "requests": requests_payload})
    # The JS reads payload.requests to get the array of request objects


@app.get("/api/poets")
def list_poets():
    # Returns every poet application, newest first
    # Not currently called by the JS but available for future features
    # like a public poets directory or admin panel
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT id, name, specialty, sample, rate, created_at
            FROM poet_applications
            ORDER BY id DESC
            """
        ).fetchall()

    poets_payload = [
        {
            "id": row["id"],
            "name": row["name"],
            "specialty": row["specialty"],  # e.g. "Love & Weddings"
            "sample": row["sample"],        # The sample line they submitted
            "rate": row["rate"],            # Their starting rate in euros
            "createdAt": row["created_at"],
        }
        for row in rows
    ]

    return jsonify({"ok": True, "poets": poets_payload})


@app.get("/api/poets/<int:poet_id>/bids")
def list_poet_bids(poet_id: int):
    # Returns all bids submitted by a specific poet along with their profile
    # <int:poet_id> extracts the number from the URL
    # e.g. GET /api/poets/3/bids sets poet_id = 3
    with get_db() as conn:
        poet_row = conn.execute(
            "SELECT id, name, specialty FROM poet_applications WHERE id = ?",
            (poet_id,),
            # (poet_id,) is a single-value tuple — the ? placeholder in the SQL
            # Using ? prevents SQL injection — the value is treated as literal data
            # not as SQL code, so malicious input can't manipulate the query
        ).fetchone()
        # fetchone() returns one row or None if no match was found

        if poet_row is None:
            return json_error("Poet profile not found.", 404)
            # Return early so the code below doesn't crash trying to use poet_row

        rows = conn.execute(
            """
            SELECT
              b.id,         -- bid's own database id
              b.request_id, -- which poem request this bid is for
              b.amount,     -- how much the poet offered to charge
              b.created_at, -- when the bid was submitted
              r.occasion,   -- the occasion of the request being bid on
              r.subject,    -- who the poem is for
              r.tone,       -- the tone requested
              r.total_price -- the minimum bid amount for this request
            FROM poem_bids b
            -- b is an alias for poem_bids so we can write b.id instead of poem_bids.id
            JOIN poem_requests r ON r.id = b.request_id
            -- JOIN combines bids with requests so we can return request details
            -- alongside each bid without a separate query
            WHERE b.poet_id = ?
            -- Only return bids from this specific poet
            ORDER BY b.id DESC
            """,
            (poet_id,),
        ).fetchall()

    bids_payload = [
        {
            "id": row["id"],
            "requestId": row["request_id"],
            "occasion": row["occasion"],
            "subject": row["subject"],
            "tone": row["tone"],
            "amount": row["amount"],              # How much this poet bid
            "minimumAmount": row["total_price"],  # The minimum that was required
            "createdAt": row["created_at"],
        }
        for row in rows
    ]

    return jsonify({
        "ok": True,
        "poet": {
            "id": poet_row["id"],
            "name": poet_row["name"],
            "specialty": poet_row["specialty"],
        },
        "bids": bids_payload,
    })


@app.post("/api/requests/<int:request_id>/bids")
def create_bid(request_id: int):
    # Saves a poet's bid on a specific poem request
    # Called when a poet enters an amount and clicks Apply
    # Validates: poet exists, request exists, amount meets the minimum
    # <int:request_id> extracts the request id from the URL
    # e.g. POST /api/requests/5/bids sets request_id = 5

    payload: Dict[str, Any] = request.get_json(silent=True) or {}
    # Parses the JSON body — silent=True returns None instead of crashing if empty
    # or {} ensures we always have a dict even if the body was empty
    # Contains: {"poetId": 2, "amount": 45}

    poet_id = to_int(payload.get("poetId", 0), 0)
    # Reads poetId from the payload, defaults to 0 if missing
    # to_int() handles string or float values safely
    amount = to_int(payload.get("amount", 0), 0)

    if poet_id <= 0:
        return json_error("Poet ID is required.")
        # Happens if currentPoet.id was null in JS and 0 was sent
    if amount <= 0:
        return json_error("Bid amount must be greater than zero.")

    with get_db() as conn:
        request_row = conn.execute(
            "SELECT id, total_price FROM poem_requests WHERE id = ?",
            (request_id,),
        ).fetchone()
        # Look up the request to confirm it exists and get the minimum price

        if request_row is None:
            return json_error("Request not found.", 404)

        poet_row = conn.execute(
            "SELECT id, name FROM poet_applications WHERE id = ?",
            (poet_id,),
        ).fetchone()
        # Look up the poet to confirm they are registered
        # Without this anyone could send any poetId and submit bids

        if poet_row is None:
            return json_error("Poet profile not found. Please register first.", 404)

        minimum_amount = int(request_row["total_price"])
        if amount < minimum_amount:
            return json_error(f"Bid must be at least €{minimum_amount}.", 400)
            # Prevents poets from bidding below the client's budget
            # JS also validates this but the backend is the authoritative check

        cursor = conn.execute(
            "INSERT INTO poem_bids (request_id, poet_id, amount) VALUES (?, ?, ?)",
            (request_id, poet_id, amount),
            # Three ? placeholders matching the three values in the tuple
        )
        bid_id = cursor.lastrowid
        # The database-assigned id of the row just inserted

    return jsonify({
        "ok": True,
        "bid": {
            "id": bid_id,
            "requestId": request_id,
            "poetId": poet_id,
            "poetName": poet_row["name"],
            "amount": amount,
            "minimumAmount": minimum_amount,
        },
    }), 201
    # 201 Created — standard HTTP status for "a new resource was successfully created"


@app.post("/api/requests")
def create_request():
    # Saves a new poem request from the request modal form
    # Called when the client fills in all fields and clicks Submit request
    # Validates every field then saves to the database
    # total_price equals budget since paper copy has been removed

    payload: Dict[str, Any] = request.get_json(silent=True) or {}
    # Parses the JSON body sent by the JS form submit handler
    # Contains: occasion, tone, subject, detail, budget

    occasion = str(payload.get("occasion", "")).strip()
    # str() ensures it's a string even if null was sent
    # .strip() removes leading/trailing whitespace
    tone = str(payload.get("tone", "")).strip().lower()
    # .lower() normalises case so "Warm" and "warm" are treated the same
    subject = str(payload.get("subject", "")).strip()
    detail = str(payload.get("detail", "")).strip()
    budget = max(5, to_int(payload.get("budget", 5), 5))
    # max(5, ...) enforces the minimum budget of €5

    # Validate every required field
    # Flask stops executing the function as soon as a return is hit
    if not occasion:
        return json_error("Occasion is required.")
        # not occasion is True when occasion is "" after .strip()
    if tone not in TONE_OPTIONS:
        return json_error("Invalid tone selection.")
        # Rejects anything not in {"warm", "romantic", "hopeful", "reflective"}
    if not subject:
        return json_error("Recipient is required.")
    if not detail:
        return json_error("A key memory/detail is required.")

    total_price = budget
    # total_price equals budget directly
    # Previously total_price = budget + paper_surcharge (€12 if paper copy was ticked)
    # Paper copy has been removed so the surcharge no longer applies

    with get_db() as conn:
        cursor = conn.execute(
            """
            INSERT INTO poem_requests (
              occasion, tone, subject, detail, budget, total_price
            ) VALUES (?, ?, ?, ?, ?, ?)
            """,
            # Six ? placeholders matching the six values in the tuple below
            (occasion, tone, subject, detail, budget, total_price),
        )
        request_id = cursor.lastrowid
        # The database-assigned id for the new row

    return jsonify({
        "ok": True,
        "request": {
            "id": request_id,
            "occasion": occasion,
            "tone": tone,
            "subject": subject,
            "detail": detail,
            "budget": budget,
            "totalPrice": total_price,
        },
    }), 201


@app.post("/api/poets")
def create_poet_application():
    # Saves a new poet registration from the poet modal form
    # Called when a poet fills in their details and clicks Submit application
    # The returned poet id is stored in currentPoet in the JS
    # and sent as poetId with every bid submission

    payload: Dict[str, Any] = request.get_json(silent=True) or {}

    name = str(payload.get("name", "")).strip()
    specialty = str(payload.get("specialty", "")).strip()
    sample = str(payload.get("sample", "")).strip()
    rate = max(10, to_int(payload.get("rate", 35), 35))
    # Minimum rate is €10 — enforced even if the JS sends a lower value

    if not name:
        return json_error("Name is required.")
    if not specialty:
        return json_error("Specialty is required.")
    if not sample:
        return json_error("Sample line is required.")

    with get_db() as conn:
        cursor = conn.execute(
            "INSERT INTO poet_applications (name, specialty, sample, rate) VALUES (?, ?, ?, ?)",
            (name, specialty, sample, rate),
        )
        poet_id = cursor.lastrowid
        # The critical value — returned to the JS and stored as currentPoet.id
        # Every bid submission sends this id as poetId to identify the poet

    return jsonify({
        "ok": True,
        "poet": {
            "id": poet_id,        # JS stores this in currentPoet.id
            "name": name,
            "specialty": specialty,
            "sample": sample,
            "rate": rate,
        },
    }), 201


# ─── STARTUP ──────────────────────────────────────────────────────────────────

init_db()
# Runs once when Flask loads this file — before handling any requests
# Creates the three tables (poem_requests, poet_applications, poem_bids)
# if they don't already exist
# Existing data is never touched because schema.sql uses CREATE TABLE IF NOT EXISTS


if __name__ == "__main__":
    # Only runs when you execute: python app.py
    # Does NOT run when started with: flask run
    # because flask run imports the module rather than running it directly
    app.run(debug=True, host="127.0.0.1", port=5050)
    # debug=True — auto-reloads when you save a file, shows detailed error pages
    # host="127.0.0.1" — only accessible from your own machine
    # port=5050 — access at http://127.0.0.1:5050

