"""
FlowGuard AI - Main FastAPI Application
Natural Language → Verified Workflow Compiler (P-03)
"""
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.database.connection import init_db
from app.api import workflows, execution, audit


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize DB on startup."""
    await init_db()
    yield


app = FastAPI(
    title="FlowGuard AI",
    description="Natural Language → Verified Workflow Compiler (P-03)",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(workflows.router, prefix="/api/workflows", tags=["workflows"])
app.include_router(execution.router, prefix="/api/execution", tags=["execution"])
app.include_router(audit.router, prefix="/api/audit", tags=["audit"])


@app.get("/")
async def root():
    return {"message": "FlowGuard AI API", "version": "1.0.0", "status": "operational"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
