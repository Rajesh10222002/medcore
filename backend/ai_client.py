import os
from google import genai
from google.genai import types
import requests as http_req
from dotenv import load_dotenv

load_dotenv()

AI_PROVIDER  = os.getenv("AI_PROVIDER", "ollama").lower()
OLLAMA_URL   = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:3b")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

_gemini_client = None


def _get_gemini_client():
    global _gemini_client
    if _gemini_client is None:
        _gemini_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
    return _gemini_client


def _ollama_generate(prompt, temperature=0.7):
    resp = http_req.post(
        f"{OLLAMA_URL}/api/generate",
        json={
            "model":   OLLAMA_MODEL,
            "prompt":  prompt,
            "stream":  False,
            "options": {"temperature": temperature}
        },
        timeout=60
    )
    resp.raise_for_status()
    return resp.json().get("response", "").strip()


def _gemini_generate(prompt, temperature=0.7):
    client = _get_gemini_client()
    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(temperature=temperature)
    )
    return (response.text or "").strip()


def generate_text(prompt, temperature=0.7):
    """
    Single entry point for all AI text generation in the app.

    Provider is chosen via the AI_PROVIDER env var:
      - "ollama" (default) — self-hosted, used for local dev
      - "gemini" — used for the Azure deployment, since Ollama running on
        localhost isn't reachable from an Azure Web App

    Raises on failure — every caller already wraps this in try/except.
    """
    if AI_PROVIDER == "gemini":
        return _gemini_generate(prompt, temperature)
    return _ollama_generate(prompt, temperature)
