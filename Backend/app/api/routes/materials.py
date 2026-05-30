import os
import uuid
from pathlib import Path
from typing import List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session as DBSession

from app.core.database import get_db
from app.models.material import Material
from app.models.user import User
from app.api.routes.auth import get_current_user
from app.api.schemas.material import MaterialResponse

router = APIRouter(prefix="/materials", tags=["materials"])

UPLOAD_DIR = Path(__file__).resolve().parents[3] / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB
ALLOWED_TYPES = {
    "application/pdf",
    "image/png", "image/jpeg", "image/gif", "image/webp",
    "text/plain",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/msword",
}


@router.get("", response_model=List[MaterialResponse])
def list_materials(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    return db.query(Material).filter(Material.user_id == current_user.id).order_by(Material.created_at.desc()).all()


@router.post("", response_model=MaterialResponse, status_code=status.HTTP_201_CREATED)
async def upload_material(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File exceeds 20 MB limit")

    mime = file.content_type or "application/octet-stream"
    if mime not in ALLOWED_TYPES:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail=f"File type '{mime}' not allowed")

    ext = Path(file.filename or "file").suffix
    stored_name = f"{uuid.uuid4().hex}{ext}"
    user_dir = UPLOAD_DIR / str(current_user.id)
    user_dir.mkdir(exist_ok=True)
    (user_dir / stored_name).write_bytes(content)

    record = Material(
        user_id=current_user.id,
        original_name=file.filename or stored_name,
        stored_name=stored_name,
        mime_type=mime,
        file_size=len(content),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/{material_id}/download")
def download_material(
    material_id: int,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    record = db.query(Material).filter(Material.id == material_id, Material.user_id == current_user.id).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Material not found")
    path = UPLOAD_DIR / str(current_user.id) / record.stored_name
    if not path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File missing from storage")
    return FileResponse(path=str(path), filename=record.original_name, media_type=record.mime_type)


@router.delete("/{material_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_material(
    material_id: int,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    record = db.query(Material).filter(Material.id == material_id, Material.user_id == current_user.id).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Material not found")
    path = UPLOAD_DIR / str(current_user.id) / record.stored_name
    if path.exists():
        path.unlink()
    db.delete(record)
    db.commit()
