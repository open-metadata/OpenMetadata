#!/bin/bash

# Set your Snowflake credentials as environment variables
export SNOWFLAKE_USERNAME="your_username"
export SNOWFLAKE_PASSWORD="your_password"
export SNOWFLAKE_ACCOUNT="your_account"
export SNOWFLAKE_WAREHOUSE="your_warehouse"
export SNOWFLAKE_DATABASE="your_database"
export SNOWFLAKE_ROLE="your_role"

# Navigate to ingestion directory
cd ingestion

# Install dependencies if not already installed
make install_dev_env

# Run specific Snowflake connection test
pytest tests/cli_e2e/test_cli_snowflake.py::SnowflakeCliTest -v

# Or run a simpler unit test
# pytest tests/unit/topology/database/test_snowflake.py -v