# VerseSpace

#### Video Demo: https://youtu.be/oF8zSlt8bOs

### Descritption: VerseSpace is a poetry marketplace web application where users can request custom poems and poets can apply to those requests.

The platform was built as a CS50 final project using Flask, SQLite, HTML, CSS, and JavaScript.

---

# Project Idea

The goal of VerseSpace is to create a small marketplace connecting people who want personalized poems with poets who can write them.

Users can:
- Submit poem requests
- Describe the occasion and tone
- Set a budget
- Browse the interface without page reloads

Poets can:
- Register through a modal form
- Browse open requests
- Apply to requests with a bid amount

---

# Features

## Request System
Clients can create poem requests including:
- Occasion
- Tone
- Recipient
- Personal details
- Budget

Requests are stored in SQLite and displayed dynamically on the requests board.

---

## Poet Registration
Poets can:
- Register with name and email
- Add specialty
- Add sample writing
- Set a starting rate

---

## Bid System
Registered poets can:
- View requests
- Submit bids
- Apply only once per request

---

## Dynamic Frontend
The frontend uses JavaScript to:
- Open and close modals
- Fetch requests from Flask API routes
- Submit forms asynchronously
- Refresh requests without reloading the page
- Render pagination dynamically
- Display toast notifications

---

# Technologies Used

## Backend
- Python
- Flask
- SQLite

## Frontend
- HTML
- CSS
- Vanilla JavaScript

---

# Project Structure

project/
│
├── app.py
├── schema.sql
├── versespace.db
│
├── templates/
│   ├── layout.html
│   └── index.html
│
├── static/
│   ├── style.css
│   └── js.js
│
└── README.md

---

# API Routes

## GET /
Renders the homepage.

## GET /api/requests
Returns all requests as JSON.

## POST /api/requests
Creates a new poem request.

## POST /api/poets
Registers a poet.

## POST /api/requests/<id>/bids
Allows poets to apply to requests.

---

# Database

SQLite is used to store:
- Requests
- Poets
- Bids

The database schema is initialized using `schema.sql`.

---





