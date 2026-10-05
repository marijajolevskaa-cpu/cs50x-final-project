# ai_helper.py — third-party AI integration for VerseSpace
# Calls an LLM API to suggest improvements to a client's poem request.
# The API key is read from an environment variable (never hardcoded).

import os
import requests


# The endpoint and key come from the environment, not the code.
# This keeps secrets out of the source and lets tests override them.
LLM_API_URL = os.getenv("LLM_API_URL", "https://api.example-llm.com/v1/complete")
LLM_API_KEY = os.getenv("LLM_API_KEY", "")


def suggest_request_improvements(occasion: str, tone: str, detail: str) -> str:
    """
    Send a client's draft poem request to the LLM API and return
    suggestions for making it clearer for poets.

    Raises RuntimeError if the API call fails, so the caller can
    handle it gracefully.
    """
    # Build the prompt from the client's draft
    prompt = (
        "A client is requesting a custom poem. Suggest 2-3 short, "
        "specific improvements to make their request clearer for poets.\n\n"
        f"Occasion: {occasion}\n"
        f"Tone: {tone}\n"
        f"Details: {detail}\n\n"
        "Suggestions:"
    )

    # Call the external API with the key in the Authorization header
    try:
        response = requests.post(
            LLM_API_URL,
            headers={"Authorization": f"Bearer {LLM_API_KEY}"},
            json={"prompt": prompt, "max_tokens": 200},
            timeout=10,
        )
    except requests.RequestException as e:
        # Network error, timeout, etc. — wrap it so the caller knows
        raise RuntimeError(f"Could not reach the AI service: {e}")

    # If the API returned an error status, handle it
    if response.status_code != 200:
        raise RuntimeError(f"AI service returned status {response.status_code}")

    # Parse the JSON response and extract the suggestions
    data = response.json()
    return data.get("text", "").strip()
