# VerseSpace requirements

1. A client submits occasion, tone, recipient, detail and budget.
2. Occasion, recipient and detail are required (400 if missing).
3. Tone must be warm, romantic, hopeful or reflective (400 otherwise).
4. Budget must be between €5 and €500.
5. A poet registers with name, specialty, sample line and rate.
6. Poet rate is at least €10.
7. A bid must come from a registered poet on an existing request (404 otherwise).
8. A bid must be at least the request's budget (400 otherwise).
9. A poet can bid once per request (409 on a duplicate).
10. AI suggestions return on success, and a clean 503 if the AI service fails.
