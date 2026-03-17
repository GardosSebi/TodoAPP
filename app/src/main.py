"""
Simple FastAPI application for deployment demo.
Provides /, /health, and /version endpoints.
"""

import os
import subprocess
from datetime import datetime
from fastapi import FastAPI
from fastapi.responses import JSONResponse

app = FastAPI(title="Deployment Demo App", version="1.0.0")


# Get git SHA for version endpoint
def get_git_sha():
    """Get current git commit SHA."""
    try:
        result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            capture_output=True,
            text=True,
            check=True,
            timeout=5,
        )
        return result.stdout.strip()[:7]  # Short SHA
    except (subprocess.SubprocessError, FileNotFoundError):
        return os.getenv("GIT_SHA", "unknown")


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "Deployment Demo App",
        "status": "running",
        "timestamp": datetime.utcnow().isoformat(),
    }


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


@app.get("/version")
async def version():
    """Version endpoint returning git SHA."""
    git_sha = get_git_sha()
    return {
        "version": git_sha,
        "git_sha": git_sha,
        "timestamp": datetime.utcnow().isoformat(),
    }
