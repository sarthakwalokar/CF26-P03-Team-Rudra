"""Execution API — thin wrapper for SSE streaming of execution events."""
from fastapi import APIRouter
router = APIRouter()
# Execution is handled via POST /api/workflows/execute
# This module is reserved for WebSocket/SSE streaming in production
