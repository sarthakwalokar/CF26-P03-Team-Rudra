"""SQLAlchemy ORM models for persistent storage."""
import json
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, Integer, Boolean, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.database.connection import Base


class WorkflowModel(Base):
    __tablename__ = "workflows"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    description = Column(Text, default="")
    version = Column(String, default="1.0.0")
    status = Column(String, default="DRAFT")
    risk_score = Column(Float, default=0.0)
    ir_json = Column(Text, nullable=False)  # Full WorkflowIR JSON
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    versions = relationship("WorkflowVersionModel", back_populates="workflow", cascade="all, delete-orphan")
    verification_runs = relationship("VerificationRunModel", back_populates="workflow", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLogModel", back_populates="workflow", cascade="all, delete-orphan")
    execution_runs = relationship("ExecutionRunModel", back_populates="workflow", cascade="all, delete-orphan")
    attack_runs = relationship("AttackRunModel", back_populates="workflow", cascade="all, delete-orphan")
    stress_test_runs = relationship("StressTestRunModel", back_populates="workflow", cascade="all, delete-orphan")


class WorkflowVersionModel(Base):
    __tablename__ = "workflow_versions"
    id = Column(String, primary_key=True)
    workflow_id = Column(String, ForeignKey("workflows.id"), nullable=False)
    version = Column(String, nullable=False)
    ir_json = Column(Text, nullable=False)
    change_description = Column(Text, default="")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    workflow = relationship("WorkflowModel", back_populates="versions")


class VerificationRunModel(Base):
    __tablename__ = "verification_runs"
    id = Column(String, primary_key=True)
    workflow_id = Column(String, ForeignKey("workflows.id"), nullable=False)
    status = Column(String, nullable=False)  # SAFE | WARNING | BLOCKED
    score = Column(Float, nullable=False)
    dimension_scores_json = Column(Text, default="{}")
    issues_json = Column(Text, default="[]")
    passed_checks_json = Column(Text, default="[]")
    failed_checks_json = Column(Text, default="[]")
    verified_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    workflow = relationship("WorkflowModel", back_populates="verification_runs")


class AttackRunModel(Base):
    __tablename__ = "attack_runs"
    id = Column(String, primary_key=True)
    workflow_id = Column(String, ForeignKey("workflows.id"), nullable=False)
    scenarios_run = Column(Integer, default=0)
    vulnerabilities_found = Column(Integer, default=0)
    critical_count = Column(Integer, default=0)
    findings_json = Column(Text, default="[]")
    overall_security_score = Column(Float, default=100.0)
    attacked_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    workflow = relationship("WorkflowModel", back_populates="attack_runs")


class StressTestRunModel(Base):
    __tablename__ = "stress_test_runs"
    id = Column(String, primary_key=True)
    workflow_id = Column(String, ForeignKey("workflows.id"), nullable=False)
    total = Column(Integer, default=0)
    passed = Column(Integer, default=0)
    failed = Column(Integer, default=0)
    critical_failures = Column(Integer, default=0)
    warnings = Column(Integer, default=0)
    robustness_score = Column(Float, default=0.0)
    breakdown_json = Column(Text, default="{}")
    completed_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    workflow = relationship("WorkflowModel", back_populates="stress_test_runs")


class ExecutionRunModel(Base):
    __tablename__ = "execution_runs"
    id = Column(String, primary_key=True)
    workflow_id = Column(String, ForeignKey("workflows.id"), nullable=False)
    status = Column(String, default="PENDING")
    node_states_json = Column(Text, default="{}")
    events_json = Column(Text, default="[]")
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    duration_ms = Column(Integer, nullable=True)
    workflow = relationship("WorkflowModel", back_populates="execution_runs")


class AuditLogModel(Base):
    __tablename__ = "audit_logs"
    id = Column(String, primary_key=True)
    workflow_id = Column(String, ForeignKey("workflows.id"), nullable=False)
    event_type = Column(String, nullable=False)
    title = Column(String, nullable=False)
    details_json = Column(Text, default="{}")
    severity = Column(String, default="INFO")
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    workflow = relationship("WorkflowModel", back_populates="audit_logs")
