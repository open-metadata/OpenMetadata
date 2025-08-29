#!/bin/bash

# BigQuery SSO Setup Script
# This script sets up the environment for BigQuery SSO query execution

set -e  # Exit on error

echo "================================================"
echo "BigQuery SSO Query Runner Setup"
echo "================================================"
echo ""

# Function to check command existence
check_command() {
    if ! command -v "$1" &> /dev/null; then
        echo "✗ $1 is required but not installed."
        echo "  Please install it and try again."
        exit 1
    fi
}

# Function to create or update .env file
create_env_file() {
    local project_id=$1
    local location=$2
    
    cat > .env << EOF
# BigQuery SSO Configuration
# Generated on $(date)

BIGQUERY_PROJECT_ID=$project_id
BIGQUERY_LOCATION=$location
EOF
    
    echo "✓ Created/Updated .env file"
}

echo "Step 1: Checking Prerequisites..."
echo "------------------------------------------------"

# Check for Python 3
check_command python3
echo "✓ Python 3 is installed: $(python3 --version)"

# Check for pip
check_command pip
echo "✓ pip is installed"

# Check for gcloud
check_command gcloud
echo "✓ Google Cloud CLI is installed"

echo ""
echo "Step 2: Setting up Python Environment..."
echo "------------------------------------------------"

# Create virtual environment if it doesn't exist
if [ ! -d "venv_bigquery_sso" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv_bigquery_sso
    echo "✓ Virtual environment created"
else
    echo "✓ Virtual environment already exists"
fi

# Activate virtual environment
source venv_bigquery_sso/bin/activate
echo "✓ Virtual environment activated"

# Install/upgrade pip
pip install --upgrade pip -q

# Install requirements
echo "Installing dependencies..."
pip install -q -r requirements_bigquery_sso.txt
echo "✓ Dependencies installed"

echo ""
echo "Step 3: Configuring Google Cloud Authentication..."
echo "------------------------------------------------"

# Check current authentication status
AUTH_LIST=$(gcloud auth list --format="value(account)" 2>/dev/null)
if [ -z "$AUTH_LIST" ]; then
    echo "No authenticated accounts found."
    echo "Please authenticate with Google Cloud:"
    gcloud auth application-default login \
        --scopes=https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/bigquery
else
    echo "Currently authenticated accounts:"
    echo "$AUTH_LIST"
    echo ""
    read -p "Do you want to re-authenticate? (y/n): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        gcloud auth application-default login \
            --scopes=https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/bigquery
    fi
fi

echo ""
echo "Step 4: Configuring BigQuery Project..."
echo "------------------------------------------------"

# Check if .env exists and load it
if [ -f ".env" ]; then
    source .env
    echo "Found existing configuration:"
    echo "  Project: $BIGQUERY_PROJECT_ID"
    echo "  Location: $BIGQUERY_LOCATION"
    echo ""
    read -p "Keep existing configuration? (y/n): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        CONFIG_DONE=true
    fi
fi

if [ "$CONFIG_DONE" != "true" ]; then
    # Get project from gcloud
    CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null)
    
    if [ -n "$CURRENT_PROJECT" ]; then
        echo "Current gcloud project: $CURRENT_PROJECT"
        read -p "Use this project? (y/n) [y]: " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Nn]$ ]]; then
            PROJECT_ID=$CURRENT_PROJECT
        fi
    fi
    
    # If no project set, ask for it
    if [ -z "$PROJECT_ID" ]; then
        read -p "Enter your BigQuery project ID: " PROJECT_ID
    fi
    
    # Ask for location
    echo ""
    echo "BigQuery dataset locations: US, EU, asia-northeast1, etc."
    read -p "Enter location [US]: " LOCATION
    LOCATION=${LOCATION:-US}
    
    # Create .env file
    create_env_file "$PROJECT_ID" "$LOCATION"
fi

# Export for current session
source .env
export BIGQUERY_PROJECT_ID
export BIGQUERY_LOCATION

echo ""
echo "Step 5: Testing BigQuery Connection..."
echo "------------------------------------------------"

# Test connection with a simple query
python3 << EOF
import sys
from google.cloud import bigquery
from google.auth import default

try:
    credentials, project = default()
    client = bigquery.Client(
        project="${BIGQUERY_PROJECT_ID}",
        credentials=credentials,
        location="${BIGQUERY_LOCATION}"
    )
    
    # Test query
    query = "SELECT 1 as test_value"
    result = client.query(query).result()
    
    for row in result:
        print(f"✓ BigQuery connection successful! Test value: {row.test_value}")
    
    # Try to list datasets
    datasets = list(client.list_datasets(max_results=3))
    if datasets:
        print(f"✓ Found {len(datasets)} dataset(s) in project ${BIGQUERY_PROJECT_ID}")
    else:
        print(f"✓ Connected to project ${BIGQUERY_PROJECT_ID} (no datasets found)")
        
except Exception as e:
    print(f"✗ Connection test failed: {e}")
    sys.exit(1)
EOF

if [ $? -ne 0 ]; then
    echo ""
    echo "Connection test failed. Please check:"
    echo "1. You have authenticated with: gcloud auth application-default login"
    echo "2. The project ID is correct: $BIGQUERY_PROJECT_ID"
    echo "3. You have BigQuery permissions in the project"
    exit 1
fi

echo ""
echo "Step 6: Running Query Runner Demo..."
echo "------------------------------------------------"

python test_bigquery_sso_query_runner.py

echo ""
echo "================================================"
echo "Setup Complete!"
echo "================================================"
echo ""
echo "Your configuration has been saved to .env:"
echo "  BIGQUERY_PROJECT_ID=$BIGQUERY_PROJECT_ID"
echo "  BIGQUERY_LOCATION=$BIGQUERY_LOCATION"
echo ""
echo "To run the query runner again:"
echo "  source venv_bigquery_sso/bin/activate"
echo "  python test_bigquery_sso_query_runner.py"
echo ""
echo "To use in your own code:"
echo "  from test_bigquery_sso_query_runner import BigQueryQueryRunner, BigQuerySSO"
echo ""