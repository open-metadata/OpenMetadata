"""Tests for health check endpoint."""

import pytest
from httpx import AsyncClient, ASGITransport
from thirdeye.app import app


@pytest.mark.asyncio
async def test_health_check():
    """Test that health endpoint returns 200 OK with correct response."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/thirdeye/health")
        
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "ok"
        assert data["service"] == "thirdeye-py-service"
        assert data["version"] == "0.1.0"
        assert "timestamp" in data
        assert "environment" in data


@pytest.mark.asyncio
async def test_root_endpoint():
    """Test that root endpoint returns service information."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/")
        
        assert response.status_code == 200
        
        data = response.json()
        assert data["service"] == "thirdeye-py-service"
        assert "health" in data
        assert "metrics" in data


@pytest.mark.asyncio
async def test_metrics_endpoint():
    """Test that Prometheus metrics endpoint is available."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/metrics")
        
        # Metrics endpoint returns plain text, not JSON
        assert response.status_code == 200
        assert "text/plain" in response.headers.get("content-type", "")
