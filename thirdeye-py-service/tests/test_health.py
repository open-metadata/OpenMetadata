"""Tests for health check endpoints."""

import pytest
from httpx import AsyncClient
from thirdeye.app import app


@pytest.mark.asyncio
async def test_health_endpoint():
    """Test basic health check endpoint."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/health")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["service"] == "thirdeye-analytics"
        assert "timestamp" in data


@pytest.mark.asyncio
async def test_health_v1_endpoint():
    """Test API v1 health check endpoint."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/api/v1/thirdeye/health")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"


@pytest.mark.asyncio
async def test_liveness_probe():
    """Test Kubernetes liveness probe."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/api/v1/thirdeye/health/live")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "alive"


@pytest.mark.asyncio
async def test_root_endpoint():
    """Test root endpoint returns service info."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/")
        
        assert response.status_code == 200
        data = response.json()
        assert data["service"] == "ThirdEye Analytics Service"
        assert data["status"] == "running"
        assert "version" in data

