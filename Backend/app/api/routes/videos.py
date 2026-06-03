"""
AI Study Video Recommendations
- Searches YouTube Data API v3 for educational videos
- Uses Groq (Llama 3.3 70B) to rank, annotate, and build a learning path
- Results cached in-memory for 1 hour to conserve API quota
"""

import json
import re
import time
from typing import List

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.api.routes.auth import get_current_user
from app.core.config import settings
from app.models.user import User

router = APIRouter(prefix="/videos", tags=["videos"])

# ── In-memory result cache (topic_lower → (timestamp, payload)) ──
_cache: dict[str, tuple[float, dict]] = {}
CACHE_TTL = 3600  # 1 hour

# ── Trusted educational channels ──
TRUSTED_CHANNELS = {
    "mit opencourseware", "khan academy", "freecodecamp.org", "3blue1brown",
    "cs50", "harvard university", "stanford online", "corey schafer",
    "sentdex", "tech with tim", "computerphile", "numberphile", "derek banas",
    "the coding train", "traversy Media", "academind", "networkchuck",
    "professor leonard", "jenny's lectures cs it", "gate smashers", "abdul bari",
    "mycodeschool", "neetcode", "back to back swe", "kurzgesagt", "andrej karpathy",
    "lex fridman", "mit", "geeksforgeeks", "simplilearn", "edureka",
    "programming with mosh", "fireship", "code with harry", "apna college",
    "take u forward", "striver", "love babbar", "william fiset",
}


# ── Helpers ──────────────────────────────────────────────────────────────────

def _parse_duration(iso: str) -> str:
    """PT1H23M45S → '1h 23m 45s'"""
    m = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", iso or "")
    if not m:
        return "—"
    parts = []
    if m.group(1): parts.append(f"{m.group(1)}h")
    if m.group(2): parts.append(f"{m.group(2)}m")
    if m.group(3): parts.append(f"{m.group(3)}s")
    return " ".join(parts) or "—"


def _fmt_views(n: int) -> str:
    if n >= 1_000_000:
        return f"{n / 1_000_000:.1f}M views"
    if n >= 1_000:
        return f"{n // 1_000}K views"
    return f"{n:,} views"


def _is_trusted(channel: str) -> bool:
    return channel.lower().strip() in TRUSTED_CHANNELS


# ── YouTube API calls ─────────────────────────────────────────────────────────

async def _youtube_search(topic: str, api_key: str) -> list[dict]:
    """Two-step YouTube fetch: search → details."""
    async with httpx.AsyncClient(timeout=20) as client:
        # 1. Search (costs 100 quota units)
        search_r = await client.get(
            "https://www.googleapis.com/youtube/v3/search",
            params={
                "key": api_key,
                "q": f"{topic} tutorial lecture course explained",
                "type": "video",
                "maxResults": 15,
                "order": "relevance",
                "relevanceLanguage": "en",
                "safeSearch": "strict",
                "videoEmbeddable": "true",
                "videoDefinition": "any",
                "part": "snippet",
            },
        )
        if search_r.status_code != 200:
            body = search_r.text[:300]
            if search_r.status_code == 403:
                raise HTTPException(503, f"YouTube API key error (403). Check your YOUTUBE_API_KEY. Details: {body}")
            raise HTTPException(502, f"YouTube search failed ({search_r.status_code}): {body}")

        items = search_r.json().get("items", [])
        if not items:
            return []

        video_ids = [it["id"]["videoId"] for it in items]

        # 2. Batch details (costs 1 quota unit per video)
        detail_r = await client.get(
            "https://www.googleapis.com/youtube/v3/videos",
            params={
                "key": api_key,
                "id": ",".join(video_ids),
                "part": "snippet,statistics,contentDetails",
            },
        )
        if detail_r.status_code != 200:
            raise HTTPException(502, "YouTube videos.list failed")

        detail_map = {v["id"]: v for v in detail_r.json().get("items", [])}

    videos = []
    for item in items:
        vid_id = item["id"]["videoId"]
        d = detail_map.get(vid_id)
        if not d:
            continue
        sn   = d["snippet"]
        st   = d.get("statistics", {})
        cd   = d.get("contentDetails", {})
        tn   = sn.get("thumbnails", {})
        thumb = (
            tn.get("maxres", {}).get("url") or
            tn.get("high",   {}).get("url") or
            tn.get("medium", {}).get("url") or
            tn.get("default",{}).get("url", "")
        )
        view_count = int(st.get("viewCount", 0) or 0)
        like_count = int(st.get("likeCount", 0) or 0)
        channel    = sn.get("channelTitle", "")
        videos.append({
            "video_id":     vid_id,
            "title":        sn.get("title", ""),
            "channel":      channel,
            "description":  sn.get("description", "")[:600],
            "thumbnail":    thumb,
            "published_at": sn.get("publishedAt", "")[:10],
            "view_count":   view_count,
            "like_count":   like_count,
            "duration_iso": cd.get("duration", "PT0S"),
            "duration":     _parse_duration(cd.get("duration", "PT0S")),
            "youtube_url":  f"https://www.youtube.com/watch?v={vid_id}",
            "trusted":      _is_trusted(channel),
        })

    return videos


# ── AI ranking via Groq ───────────────────────────────────────────────────────

def _fallback_rank(topic: str, videos: list[dict]) -> dict:
    """Basic ranking when Groq is unavailable."""
    max_v = max((v["view_count"] for v in videos), default=1) or 1
    scored = sorted(
        range(len(videos)),
        key=lambda i: (
            (3 if videos[i]["trusted"] else 1) *
            (0.4 + 0.6 * videos[i]["view_count"] / max_v)
        ),
        reverse=True,
    )
    return {
        "ranked_indices": scored,
        "annotations": {
            str(i): {
                "difficulty":     "Intermediate",
                "reason":         f"Educational video about {topic} from {videos[i]['channel']}.",
                "estimated_time": videos[i]["duration"] + " to watch",
            }
            for i in range(len(videos))
        },
        "learning_path":       f"Watch in order from beginner to advanced to build a solid foundation in {topic}.",
        "prerequisites":       [],
        "difficulty_overview": f"Videos cover various difficulty levels of {topic}.",
    }


async def _ai_rank(topic: str, videos: list[dict]) -> dict:
    """Ask Groq to rank videos and generate educational metadata."""
    if not settings.groq_api_key:
        return _fallback_rank(topic, videos)

    from groq import Groq
    client = Groq(api_key=settings.groq_api_key)

    compact = [
        {
            "index":         i,
            "title":         v["title"],
            "channel":       v["channel"],
            "desc":          v["description"][:250],
            "views":         v["view_count"],
            "duration":      v["duration"],
            "published":     v["published_at"],
            "trusted_edu_channel": v["trusted"],
        }
        for i, v in enumerate(videos)
    ]

    prompt = f"""You are an expert educational video curator. Analyze these YouTube videos about "{topic}" and respond with ONLY valid JSON.

Videos:
{json.dumps(compact, ensure_ascii=False)}

JSON format (no markdown, no extra text):
{{
  "ranked_indices": [array of video indices ordered best→worst for educational quality],
  "annotations": {{
    "0": {{
      "difficulty": "Beginner|Intermediate|Advanced",
      "reason": "Concise 25-word explanation of why this video is recommended",
      "estimated_time": "e.g. 30 min watch + 1 hr practice"
    }}
  }},
  "learning_path": "2-3 sentence suggested viewing sequence for mastering {topic}",
  "prerequisites": ["topic1", "topic2"],
  "difficulty_overview": "One sentence overall difficulty assessment for {topic}"
}}

Ranking criteria:
- Trusted/reputable educational channels get priority
- Higher view counts and engagement signal proven quality
- Prefer content that is clear, structured, and topic-specific
- Assign difficulty based on title/description vocabulary and depth
- Prerequisites must be foundational concepts required BEFORE studying {topic}
- Keep reasons specific to why THIS video stands out"""

    try:
        resp = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=2000,
            temperature=0.25,
        )
        raw = resp.choices[0].message.content.strip()
        # Extract the first complete JSON object
        m = re.search(r"\{[\s\S]*\}", raw)
        if m:
            return json.loads(m.group())
    except Exception:
        pass

    return _fallback_rank(topic, videos)


# ── Schemas ───────────────────────────────────────────────────────────────────

class SearchRequest(BaseModel):
    topic: str
    max_results: int = 8


class VideoResult(BaseModel):
    video_id: str
    title: str
    channel: str
    duration: str
    view_count: int
    view_count_formatted: str
    published_at: str
    thumbnail: str
    youtube_url: str
    ai_reason: str
    difficulty: str        # Beginner | Intermediate | Advanced
    estimated_time: str
    is_top: bool
    is_trusted: bool
    rank: int


class SearchResponse(BaseModel):
    topic: str
    videos: List[VideoResult]
    learning_path: str
    prerequisites: List[str]
    difficulty_overview: str
    cached: bool


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.post("/search", response_model=SearchResponse)
async def search_study_videos(
    body: SearchRequest,
    current_user: User = Depends(get_current_user),
):
    topic = body.topic.strip()
    if not topic:
        raise HTTPException(400, "Topic cannot be empty")
    if len(topic) > 200:
        raise HTTPException(400, "Topic must be under 200 characters")

    # Cache check
    cache_key = topic.lower()
    now = time.time()
    if cache_key in _cache:
        ts, cached = _cache[cache_key]
        if now - ts < CACHE_TTL:
            return {**cached, "cached": True}

    # API key guard
    api_key = getattr(settings, "youtube_api_key", "")
    if not api_key:
        raise HTTPException(
            503,
            "YouTube API key not configured. "
            "Add YOUTUBE_API_KEY=<your-key> to Backend/.env and restart the server. "
            "Get a free key at https://console.cloud.google.com → YouTube Data API v3."
        )

    # Fetch from YouTube
    raw = await _youtube_search(topic, api_key)
    if not raw:
        raise HTTPException(404, f"No educational videos found for '{topic}'. Try a different topic.")

    # AI ranking + annotation
    ai = await _ai_rank(topic, raw)

    ranked_idx  = ai.get("ranked_indices", list(range(len(raw))))
    annotations = ai.get("annotations", {})
    max_out     = min(body.max_results, len(raw), 10)

    out_videos: list[VideoResult] = []
    for rank, idx in enumerate(ranked_idx[:max_out]):
        if idx >= len(raw):
            continue
        v   = raw[idx]
        ann = annotations.get(str(idx), {})
        out_videos.append(VideoResult(
            video_id            = v["video_id"],
            title               = v["title"],
            channel             = v["channel"],
            duration            = v["duration"],
            view_count          = v["view_count"],
            view_count_formatted= _fmt_views(v["view_count"]),
            published_at        = v["published_at"],
            thumbnail           = v["thumbnail"],
            youtube_url         = v["youtube_url"],
            ai_reason           = ann.get("reason", f"Highly relevant educational content about {topic}."),
            difficulty          = ann.get("difficulty", "Intermediate"),
            estimated_time      = ann.get("estimated_time", v["duration"] + " to watch"),
            is_top              = (rank == 0),
            is_trusted          = v["trusted"],
            rank                = rank + 1,
        ))

    payload = {
        "topic":              topic,
        "videos":             [v.model_dump() for v in out_videos],
        "learning_path":      ai.get("learning_path", ""),
        "prerequisites":      ai.get("prerequisites", []),
        "difficulty_overview":ai.get("difficulty_overview", ""),
        "cached":             False,
    }

    _cache[cache_key] = (now, payload)
    return payload
