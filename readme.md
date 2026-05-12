# VerseCraft — Full FE/BE Implementation Notes

This document explains all implemented **frontend** and **backend** changes for the VerseCraft app in this workspace.

---

## 1) Project structure

### Frontend (`/poetry`)
- `versecraft (2).html` — page structure, sections, modals, and UI containers
- `css/versecraft.css` — full styling/theme, modal styling, request board UI/animations
- `js/versecraft.js` — all client interaction logic and API integration

### Backend (`/poetry/backend`)
- `app.py` — Flask app, API routes, validation, static serving
- `schema.sql` — SQLite tables (`poem_requests`, `poet_applications`, `poem_bids`)
- `requirements.txt` — backend dependency list
- `smoke_test.py` — API regression/sanity test
- `versecraft.db` — runtime SQLite file (auto-created)
- `scripts/stable_server.sh` — auto-restart supervisor loop
- `scripts/start_stable_server.sh` — one-command stable start
- `scripts/stop_stable_server.sh` — one-command stable stop
- `scripts/server_status.sh` — supervisor/app/health status
- `templates/` — Flask templates for rendered pages
- `static/css/versecraft.css` — compiled frontend CSS for Flask
- `static/js/versecraft.js` — frontend behavior served by Flask
- `scripts/com.versecraft.backend.plist.template` — launchd agent template
- `scripts/install_launchd_service.sh` — install + bootstrap launchd auto-start
- `scripts/uninstall_launchd_service.sh` — unload + remove launchd auto-start
- `scripts/launchd_status.sh` — launchd loaded state + backend health

---

## 2) Backend changes (Flask + SQLite)

### 2.1 API endpoints implemented
- `GET /` serves `versecraft (2).html`
- `GET /api/health`
- `GET /api/stats`
- `GET /api/requests` (newest first, includes bid counts + minimum apply amount)
- `GET /api/poets` (newest first)
- `GET /api/poets/<poet_id>/bids` (poet-specific bid history)
- `POST /api/requests` (create poem request)
- `POST /api/poets` (register poet)
- `POST /api/requests/<request_id>/bids` (poet applies to request)

### 2.2 Validation and business rules
- Request validation:
	- required: `occasion`, `tone`, `subject`, `detail`
	- `tone` must be one of: `warm|romantic|hopeful|reflective`
	- region must be `europe` or `outside-europe`
	- paper delivery allowed only for `europe`
- Pricing:
	- request base budget minimum is enforced
	- paper surcharge is applied when selected
	- `total_price` is persisted
- Poet bid validation:
	- poet must exist (`poetId`)
	- request must exist (`request_id`)
	- bid `amount` must be **>=** request `total_price`

### 2.3 Database schema implemented
- `poem_requests`
	- stores request content, region, paper flag, surcharge, total, timestamp
- `poet_applications`
	- stores poet identity/profile/rate, timestamp
- `poem_bids`
	- links poet + request with bid amount, timestamp
	- foreign keys to both request and poet

---

## 3) Frontend changes

### 3.1 Core UX/features implemented
- Request modal supports:
	- occasion/tone/subject/detail/budget
	- region selection
	- paper delivery option (`Europe` only)
- Poet modal supports:
	- poet registration form
	- open requests board inside modal
	- my bids panel inside modal
- Main page supports:
	- requests board section
	- apply flow directly from cards
	- “already applied” badge + disabled re-apply controls

### 3.2 API integration in FE
- `POST /api/requests` on request submit
- `POST /api/poets` on poet registration
- `POST /api/requests/<id>/bids` on apply
- `GET /api/requests` for request board rendering
- `GET /api/poets/<id>/bids` for “My bids” rendering
- `GET /api/stats` for stats counters

### 3.3 Request board behavior
- Requests render newest-first from backend
- each card shows:
	- occasion/subject/tone/detail
	- total requested amount
	- delivery mode + region
	- minimum apply amount + bids count
- if current poet already applied:
	- badge: `You already applied (€X)`
	- amount/button are disabled

### 3.4 Featured card behavior
- No AI-generated poem is created after submit
- Featured card now displays latest request details from backend
- On page load/refresh it fetches latest request so state persists

### 3.5 Refresh UX improvements
- refresh button has fancy loading state:
	- shimmer animation
	- spinner indicator
	- temporary text `Refreshing`
- refresh interaction has minimum duration for smoother feel

### 3.6 Content changes
- Copywriting section removed from page and nav per request
- Header nav contains a link to `Requests board`

### 3.7 Requests board pagination (new)
- Main `Requests board` section now shows **3 requests per page**
- Added pagination controls under the board:
	- `Previous` button
	- page status label (`Page X of Y`)
	- `Next` button
- Pagination behavior:
	- newest requests still come first from backend
	- only the selected page slice is rendered (`3` per page)
	- `Previous` is disabled on first page
	- `Next` is disabled on last page
	- controls auto-hide when total requests are `<= 3`
- Poet modal requests list remains full (not paginated), so poets can scan all open requests quickly in one place.

---

## 4) End-to-end flows implemented

### Flow A: Requester
1. Opens request modal
2. Submits request
3. Backend persists request
4. Requests board + featured card update
5. Latest request remains visible after reload

### Flow B: Poet registration
1. Opens poet modal
2. Submits poet profile
3. Backend stores poet profile
4. Poet can apply to open requests immediately

### Flow C: Poet applies to request
1. Poet selects request and enters amount
2. Backend checks request + poet existence
3. Backend enforces `amount >= minimumApplyAmount`
4. Bid is stored in `poem_bids`
5. UI shows applied badge + updates My bids

---

## 5) Run locally

```bash
cd /Users/marijajolevska/Downloads/marijajolevskaa-cpu-b2abbd5cac7fbe8ba956383f10c6f7e5beef8fa1/poetry/backend
pip install -r requirements.txt
python app.py
```

Open:
- `http://127.0.0.1:5050/`

### More stable mode (recommended)

Use these scripts to keep backend up even if `app.py` exits unexpectedly.

```bash
cd /Users/marijajolevska/Downloads/marijajolevskaa-cpu-b2abbd5cac7fbe8ba956383f10c6f7e5beef8fa1/poetry/backend
./scripts/start_stable_server.sh
./scripts/server_status.sh
```

Stop it anytime:

```bash
cd /Users/marijajolevska/Downloads/marijajolevskaa-cpu-b2abbd5cac7fbe8ba956383f10c6f7e5beef8fa1/poetry/backend
./scripts/stop_stable_server.sh
```

Logs:
- app log: `/tmp/versecraft_backend.log`
- supervisor log: `/tmp/versecraft_supervisor.log`

### Playwright browser testing

The backend includes a Playwright test setup for browser-based verification.

From `poetry/backend`:

```bash
npm install
npx playwright install
npm test
```

The Playwright files are:
 - `package.json`
 - `playwright.config.js`
 - `tests/poetry.spec.js`

The tests assume the app is running at `http://127.0.0.1:5050`.

### Auto-start on macOS login (`launchd`)

Install and load the user launch agent:

```bash
cd /Users/marijajolevska/Downloads/marijajolevskaa-cpu-b2abbd5cac7fbe8ba956383f10c6f7e5beef8fa1/poetry/backend
./scripts/install_launchd_service.sh
./scripts/launchd_status.sh
```

Remove it:

```bash
cd /Users/marijajolevska/Downloads/marijajolevskaa-cpu-b2abbd5cac7fbe8ba956383f10c6f7e5beef8fa1/poetry/backend
./scripts/uninstall_launchd_service.sh
```

`launchd` logs:
- `/tmp/versecraft_launchd.out.log`
- `/tmp/versecraft_launchd.err.log`

### Stability hardening summary

To reduce backend downtime during development, two layers are now in place:

1. **Stable supervisor mode** (`stable_server.sh`)
	- runs `app.py` in a loop
	- if Flask exits unexpectedly, it restarts automatically after a short delay
	- tracks process IDs in `/tmp/versecraft_supervisor.pid` and `/tmp/versecraft_backend.pid`

2. **macOS login auto-start** (`launchd`)
	- installs user launch agent `com.versecraft.backend`
	- starts stable supervisor at login
	- `KeepAlive` ensures launchd attempts to keep service active

---

## 6) Verify quickly

### Smoke test
```bash
cd /Users/marijajolevska/Downloads/marijajolevskaa-cpu-b2abbd5cac7fbe8ba956383f10c6f7e5beef8fa1/poetry/backend
python smoke_test.py
```

### API checks
```bash
curl -s http://127.0.0.1:5050/api/health
curl -s http://127.0.0.1:5050/api/stats
curl -s http://127.0.0.1:5050/api/requests
curl -s http://127.0.0.1:5050/api/poets
curl -s http://127.0.0.1:5050/api/poets/1/bids
```

### Bid example
```bash
curl -s -X POST http://127.0.0.1:5050/api/requests/1/bids \
	-H 'Content-Type: application/json' \
	-d '{"poetId":1,"amount":72}'
```

---

## 7) Verified status

- Flask app root `GET /` renders successfully and returns `200`
- Playwright browser tests are configured in `package.json`, `playwright.config.js`, and `tests/poetry.spec.js`
- Current browser suite result: `2 passed`
- Health endpoint verified with `GET /api/health`

---

## 8) Notes
- This is a dev setup (Flask development server + SQLite).
- `versecraft.db` is local state; deleting it resets stored data.
- Frontend keeps graceful fallback messaging if backend is unavailable.

