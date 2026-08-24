"""Audit trail API routes."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.database.connection import get_db
from app.schemas.workflow import AuditLog
from app.services.audit import get_audit_trail

router = APIRouter()


@router.get("/{workflow_id}", response_model=List[AuditLog])
async def get_workflow_audit(
    workflow_id: str,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
):
    logs = await get_audit_trail(db, workflow_id, limit)
    return logs
