# Multi-stage Dockerfile for ThirdEye Python GraphQL Service
# Build optimized production image with minimal dependencies

FROM python:3.11-slim as base

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app


# Stage 1: Build dependencies
FROM base as builder

# Install build dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        gcc \
        g++ \
        libmariadb-dev \
        pkg-config && \
    rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --user -r requirements.txt


# Stage 2: Runtime
FROM base as runtime

# Install runtime dependencies only
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        libmariadb3 \
        curl && \
    rm -rf /var/lib/apt/lists/*

# Copy Python packages from builder
COPY --from=builder /root/.local /root/.local

# Make sure scripts in .local are usable
ENV PATH=/root/.local/bin:$PATH

# Copy application code
COPY src/ /app/src/

# Set Python path
ENV PYTHONPATH=/app/src:$PYTHONPATH

# Create non-root user
RUN useradd -m -u 1000 thirdeye && \
    chown -R thirdeye:thirdeye /app

USER thirdeye

# Expose port
EXPOSE 8586

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8586/api/v1/thirdeye/health || exit 1

# Run the application
CMD ["uvicorn", "thirdeye.app:app", "--host", "0.0.0.0", "--port", "8586"]
