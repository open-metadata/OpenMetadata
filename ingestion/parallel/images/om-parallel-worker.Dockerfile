# Use official Python slim image for smaller size
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    git \
    libpq-dev \
    postgresql-client \
    default-libmysqlclient-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy ingestion module requirements and install
COPY ingestion/pyproject.toml ingestion/setup.py /app/ingestion/
COPY ingestion/src /app/ingestion/src/

# Install OpenMetadata ingestion with database connectors
RUN pip install --no-cache-dir /app/ingestion/[postgres,snowflake,mysql,mssql,bigquery,redshift]

# Copy parallel processing module
COPY ingestion/parallel /app/ingestion/parallel/

# Set Python path
ENV PYTHONPATH=/app/ingestion/src:/app/ingestion/parallel:$PYTHONPATH

# Default command
CMD ["python", "--version"]