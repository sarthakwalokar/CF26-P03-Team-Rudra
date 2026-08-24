"""Audit trail service — logs all important FlowGuard events."""
import json
import uuid
from datetime import datetime
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.models.workflow import AuditLogModel
from app.schemas.workflow import AuditLog, AuditEventType


async def log_event(
    db: AsyncSession,
    workflow_id: str,
    event_type: AuditEventType,
    title: str,
    details: dict = None,
    severity: str = "INFO",
) -> AuditLog:
    log = AuditLogModel(
        id=str(uuid.uuid4())[:8],
        workflow_id=workflow_id,
        event_type=event_type.value,
        title=title,
        details_json=json.dumps(details or {}),
        severity=severity,
        timestamp=datetime.utcnow(),
    )
    db.add(log)
    await db.flush()
    return AuditLog(
        id=log.id,
        workflow_id=log.workflow_id,
        event_type=event_type,
        title=log.title,
        details=details or {},
        severity=log.severity,
        timestamp=log.timestamp,
    )


async def get_audit_trail(db: AsyncSession, workflow_id: str, limit: int = 100) -> List[AuditLog]:
    result = await db.execute(
        select(AuditLogModel)
        .where(AuditLogModel.workflow_id == workflow_id)
        .order_by(desc(AuditLogModel.timestamp))
        .limit(limit)
    )
    rows = result.scalars().all()
    return [
        AuditLog(
            id=r.id,
            workflow_id=r.workflow_id,
            event_type=AuditEventType(r.event_type),
            title=r.title,
            details=json.loads(r.details_json or "{}"),
            severity=r.severity,
            timestamp=r.timestamp,
        )
        for r in rows
    ]
