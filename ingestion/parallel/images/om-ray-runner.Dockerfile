# Ray runner image for OpenMetadata parallel ingestion
FROM rayproject/ray:2.31.0-py311

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy OpenMetadata ingestion requirements
COPY ingestion/pyproject.toml ingestion/setup.py /app/ingestion/
COPY ingestion/src/metadata/__version__.py /app/ingestion/src/metadata/

# Install OpenMetadata ingestion framework
RUN pip install --no-cache-dir -e /app/ingestion/

# Copy parallel ingestion module
COPY ingestion/parallel /app/ingestion/parallel/

# Install additional dependencies for parallel processing
RUN pip install --no-cache-dir \
    prometheus-client==0.19.0 \
    boto3==1.34.11 \
    google-cloud-storage==2.10.0 \
    azure-storage-blob==12.19.0

# Create non-root user
RUN useradd -m -u 1000 omuser && \
    chown -R omuser:omuser /app

USER omuser

# Set Python path
ENV PYTHONPATH="/app:${PYTHONPATH}"

# Default command
CMD ["python", "-m", "ingestion.parallel.om_parallel"]