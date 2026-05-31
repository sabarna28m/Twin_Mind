import asyncio
from typing import Dict, List

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.core.database import get_db
from app.core.security import decode_token
from app.models.user import User

router = APIRouter(tags=["websocket"])


class ConnectionManager:
    def __init__(self) -> None:
        self._active: Dict[int, List[WebSocket]] = {}

    async def connect(self, user_id: int, ws: WebSocket) -> None:
        await ws.accept()
        self._active.setdefault(user_id, []).append(ws)

    def disconnect(self, user_id: int, ws: WebSocket) -> None:
        bucket = self._active.get(user_id, [])
        if ws in bucket:
            bucket.remove(ws)
        if not bucket:
            self._active.pop(user_id, None)

    async def broadcast(self, user_id: int, data: dict) -> None:
        dead: List[WebSocket] = []
        for ws in list(self._active.get(user_id, [])):
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(user_id, ws)


manager = ConnectionManager()


@router.websocket("/ws/{user_id}")
async def ws_endpoint(
    user_id: int,
    ws: WebSocket,
    token: str = Query(...),
) -> None:
    payload = decode_token(token)
    if not payload or int(payload.get("sub", -1)) != user_id:
        await ws.close(code=4001)
        return

    db_gen = get_db()
    db = next(db_gen)
    try:
        user = db.query(User).filter(User.id == user_id, User.is_active.is_(True)).first()
    finally:
        try:
            next(db_gen)
        except StopIteration:
            pass

    if not user:
        await ws.close(code=4001)
        return

    await manager.connect(user_id, ws)
    try:
        while True:
            try:
                await asyncio.wait_for(ws.receive_text(), timeout=20.0)
            except asyncio.TimeoutError:
                # Server-side heartbeat to detect dead connections
                await ws.send_json({"type": "ping"})
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        manager.disconnect(user_id, ws)
