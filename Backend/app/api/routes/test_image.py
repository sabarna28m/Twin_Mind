"""
Debug endpoint — POST /api/v1/test-image
Accepts a base64 image string, calls Gemini 3.5 Flash directly,
and returns the full raw response so we can see exactly what's failing.
Remove this file once image analysis is confirmed working.
"""
import base64
import json
import sys

import requests as req
from fastapi import APIRouter
from pydantic import BaseModel

from app.core.config import settings

router = APIRouter(prefix="/test-image", tags=["debug"])


class TestImageRequest(BaseModel):
    # base64-encoded image data (no data-URI prefix needed)
    image_base64: str
    mime_type: str = "image/jpeg"


@router.post("")
def test_image(payload: TestImageRequest):
    # ── 1. Key check ──────────────────────────────────────────────────────
    key = settings.gemini_api_key or ""
    key_preview = key[:10] + "..." if len(key) >= 10 else f"(only {len(key)} chars)"
    print(f"\n[TEST-IMAGE] GEMINI_API_KEY first 10 chars: {key_preview}", flush=True, file=sys.stdout)
    print(f"[TEST-IMAGE] GEMINI_API_KEY length: {len(key)}", flush=True, file=sys.stdout)

    if not key:
        msg = "GEMINI_API_KEY is empty or not set in .env"
        print(f"[TEST-IMAGE] ERROR: {msg}", flush=True, file=sys.stdout)
        return {"error": msg, "key_preview": key_preview}

    # ── 2. Build request ──────────────────────────────────────────────────
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models"
        f"/gemini-3.5-flash:generateContent?key={key}"
    )
    body = {
        "contents": [{
            "parts": [
                {
                    "inline_data": {
                        "mime_type": payload.mime_type,
                        "data": payload.image_base64,
                    }
                },
                {"text": "Describe what you see in this image in detail"},
            ]
        }]
    }

    print(f"[TEST-IMAGE] Calling Gemini URL (key hidden): "
          f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent",
          flush=True, file=sys.stdout)
    print(f"[TEST-IMAGE] mime_type={payload.mime_type}  "
          f"base64_length={len(payload.image_base64)}", flush=True, file=sys.stdout)

    # ── 3. Call Gemini ────────────────────────────────────────────────────
    try:
        resp = req.post(url, json=body, timeout=30)
    except Exception as exc:
        print(f"[TEST-IMAGE] requests.post EXCEPTION: {exc}", flush=True, file=sys.stdout)
        return {"error": f"HTTP request failed: {exc}", "key_preview": key_preview}

    print(f"[TEST-IMAGE] Gemini HTTP status: {resp.status_code}", flush=True, file=sys.stdout)
    print(f"[TEST-IMAGE] Gemini raw response:\n{resp.text}", flush=True, file=sys.stdout)

    # ── 4. Parse and return ───────────────────────────────────────────────
    try:
        data = resp.json()
    except Exception:
        return {
            "key_preview": key_preview,
            "http_status": resp.status_code,
            "raw_response": resp.text,
            "parse_error": "Response is not valid JSON",
        }

    description = None
    parse_error = None
    try:
        description = data["candidates"][0]["content"]["parts"][0]["text"]
        print(f"[TEST-IMAGE] Extracted description ({len(description)} chars): "
              f"{description[:200]}", flush=True, file=sys.stdout)
    except (KeyError, IndexError) as exc:
        parse_error = f"Could not extract text: {exc}"
        print(f"[TEST-IMAGE] Parse error: {parse_error}", flush=True, file=sys.stdout)

    return {
        "key_preview": key_preview,
        "http_status": resp.status_code,
        "gemini_response": data,
        "extracted_description": description,
        "parse_error": parse_error,
    }
