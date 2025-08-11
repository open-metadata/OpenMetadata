---
title: Test Case 1 - MySQL Ingestion Pipeline Tutorial
description: Complete step-by-step guide for configuring and testing MySQL database connector with sample configurations, error handling, and validation.
slug: /how-to-guides/ingestion-examples/mysql-ingestion-pipeline
---

# Test Case 1: Configuring a MySQL Ingestion Pipeline

This comprehensive tutorial walks you through configuring a MySQL connector for OpenMetadata ingestion, including complete configuration examples, common troubleshooting scenarios, and validation steps.

## Prerequisites

### System Requirements
- OpenMetadata server running and accessible
- Python 3.9+ installed
- MySQL database accessible with appropriate permissions

### Required Permissions
Your MySQL user needs the following permissions:

```sql
-- Create user (replace username, hostname, and password)
CREATE USER 'openmetadata_user'@'%' IDENTIFIED BY 'strong_password';

-- Grant necessary permissions
GRANT SELECT ON *.* TO 'openmetadata_user'@'%';
GRANT SELECT ON INFORMATION_SCHEMA.* TO 'openmetadata_user'@'%';
GRANT SELECT ON PERFORMANCE_SCHEMA.* TO 'openmetadata_user'@'%';

-- For profiling (optional)
GRANT SELECT ON mysql.* TO 'openmetadata_user'@'%';

-- Apply changes
FLUSH PRIVILEGES;
```

### Install Dependencies

```bash
# Install OpenMetadata ingestion with MySQL support
pip3 install "openmetadata-ingestion[mysql]"

# Verify installation
metadata --version
```

## Step 1: Prepare MySQL Connector Configuration

### Basic Configuration File

Create a file named `mysql_config.json` with the following content:

```json
{
  "source": {
    "type": "mysql",
    "serviceName": "mysql_production",
    "serviceConnection": {
      "config": {
        "type": "Mysql",
        "username": "openmetadata_user",
        "authType": {
          "password": "strong_password"
        },
        "hostPort": "localhost:3306",
        "connectionOptions": {
          "charset": "utf8mb4",
          "connect_timeout": 30
        },
        "connectionArguments": {
          "ssl_disabled": "true"
        }
      }
    },
    "sourceConfig": {
      "config": {
        "type": "DatabaseMetadata",
        "schemaFilterPattern": {
          "includes": ["production_db", "analytics_db"],
          "excludes": ["test_.*", "temp_.*"]
        },
        "tableFilterPattern": {
          "includes": [".*"],
          "excludes": ["tmp_.*", "backup_.*"]
        },
        "includeTables": true,
        "includeViews": true,
        "includeTags": true,
        "markDeletedTables": true,
        "useFqnForFiltering": false
      }
    }
  },
  "sink": {
    "type": "metadata-rest",
    "config": {}
  },
  "workflowConfig": {
    "loggerLevel": "INFO",
    "openMetadataServerConfig": {
      "hostPort": "http://localhost:8585/api",
      "authProvider": "openmetadata",
      "securityConfig": {
        "jwtToken": "your-jwt-token-here"
      },
      "apiVersion": "v1",
      "retry": {
        "enabled": true,
        "maxRetries": 3,
        "initialDelay": 1,
        "maxDelay": 10
      }
    }
  }
}
```

### Configuration Parameters Explained

#### Connection Parameters
- **`username`**: MySQL database user with read permissions
- **`authType.password`**: Password for the MySQL user
- **`hostPort`**: MySQL server hostname and port (format: `host:port`)
- **`connectionOptions`**: Additional MySQL connection parameters
  - `charset`: Character encoding (recommended: `utf8mb4`)
  - `connect_timeout`: Connection timeout in seconds
- **`connectionArguments`**: Driver-specific arguments
  - `ssl_disabled`: Set to `"true"` to disable SSL (use `"false"` for production)

#### Filtering Configuration
- **`schemaFilterPattern`**: Control which databases to include/exclude
- **`tableFilterPattern`**: Control which tables to include/exclude
- **`includeTables`**: Include regular tables (default: true)
- **`includeViews`**: Include database views (default: true)
- **`markDeletedTables`**: Mark tables as deleted if not found (default: true)

#### Server Configuration
- **`hostPort`**: OpenMetadata server API endpoint
- **`authProvider`**: Authentication method (`"openmetadata"`, `"auth0"`, etc.)
- **`jwtToken`**: Authentication token (get from OpenMetadata UI → Settings → Bots)

## Step 2: Obtain JWT Token

### Method 1: From OpenMetadata UI
1. Login to OpenMetadata UI
2. Go to **Settings** → **Integrations** → **Bots**
3. Find or create a bot (e.g., "ingestion-bot")
4. Copy the JWT token

### Method 2: Using API
```bash
# Get JWT token via API
curl -X POST "http://localhost:8585/api/v1/users/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@openmetadata.org",
    "password": "admin"
  }' | jq -r .accessToken
```

## Step 3: Run the Ingestion

### Test Configuration First
```bash
# Validate configuration file syntax
python -c "import json; print('Valid JSON' if json.load(open('mysql_config.json')) else 'Invalid JSON')"

# Test database connectivity
metadata ingest -c mysql_config.json --dry-run
```

### Run the Full Ingestion
```bash
# Run ingestion with verbose logging
metadata ingest -c mysql_config.json --verbose

# Run with specific log level
metadata ingest -c mysql_config.json --log-level DEBUG
```

### Monitor Progress
```bash
# View ingestion logs in real-time
tail -f /tmp/openmetadata_ingestion.log

# Check for specific error patterns
grep -i error /tmp/openmetadata_ingestion.log
```

## Step 4: Validate Successful Ingestion

### 1. Check OpenMetadata UI
- Navigate to **Databases** in the OpenMetadata UI
- Verify your MySQL service appears in the list
- Click on the service to see discovered databases and tables
- Check that table schemas, columns, and metadata are populated

### 2. Verify Via API
```bash
# List discovered databases
curl -X GET "http://localhost:8585/api/v1/databases?service=mysql_production" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" | jq

# Get specific table details
curl -X GET "http://localhost:8585/api/v1/tables/name/mysql_production.production_db.users" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" | jq
```

### 3. Check Ingestion Statistics
```bash
# View ingestion pipeline status
curl -X GET "http://localhost:8585/api/v1/services/ingestionPipelines" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" | jq '.data[] | select(.service.name == "mysql_production")'
```

## Common Error Scenarios & Solutions

### Error 1: Authentication Failures

#### Symptom
```
ERROR: Access denied for user 'openmetadata_user'@'hostname'
```

#### Solutions
```sql
-- Check user exists and permissions
SELECT User, Host FROM mysql.user WHERE User = 'openmetadata_user';

-- Reset password
ALTER USER 'openmetadata_user'@'%' IDENTIFIED BY 'new_password';

-- Grant required permissions
GRANT SELECT ON *.* TO 'openmetadata_user'@'%';
FLUSH PRIVILEGES;
```

### Error 2: Network Connectivity Issues

#### Symptom
```
ERROR: Can't connect to MySQL server on 'hostname' (111)
```

#### Solutions
```bash
# Test network connectivity
telnet your-mysql-host 3306
nc -zv your-mysql-host 3306

# Check firewall rules
iptables -L | grep 3306

# Verify MySQL is listening on correct interface
netstat -tlnp | grep 3306
```

#### Configuration Adjustments
```json
{
  "connectionOptions": {
    "connect_timeout": 60,
    "read_timeout": 300,
    "charset": "utf8mb4"
  }
}
```

### Error 3: SSL Certificate Issues

#### Symptom
```
ERROR: SSL connection error: certificate verify failed
```

#### Solutions

For development (disable SSL):
```json
{
  "connectionArguments": {
    "ssl_disabled": "true"
  }
}
```

For production (proper SSL):
```json
{
  "connectionArguments": {
    "ssl_ca": "/path/to/ca-cert.pem",
    "ssl_cert": "/path/to/client-cert.pem",
    "ssl_key": "/path/to/client-key.pem"
  }
}
```

### Error 4: Schema/Table Filtering Issues

#### Symptom
```
INFO: No tables found matching the filter criteria
```

#### Solutions
```json
{
  "sourceConfig": {
    "config": {
      "schemaFilterPattern": {
        "includes": [".*"],
        "excludes": ["information_schema", "performance_schema", "mysql", "sys"]
      },
      "useFqnForFiltering": true
    }
  }
}
```

### Error 5: JWT Token Expired

#### Symptom
```
ERROR: 401 Unauthorized: Token has expired
```

#### Solutions
```bash
# Generate new JWT token
curl -X POST "http://localhost:8585/api/v1/users/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@openmetadata.org", "password": "admin"}' \
  | jq -r .accessToken
```

## Advanced Configuration Examples

### Configuration with SSL and Connection Pooling
```json
{
  "source": {
    "serviceConnection": {
      "config": {
        "type": "Mysql",
        "username": "openmetadata_user",
        "authType": {
          "password": "strong_password"
        },
        "hostPort": "mysql.company.com:3306",
        "connectionOptions": {
          "charset": "utf8mb4",
          "connect_timeout": 30,
          "read_timeout": 600
        },
        "connectionArguments": {
          "ssl_ca": "/etc/ssl/ca-cert.pem",
          "ssl_verify_cert": "true",
          "pool_size": "10",
          "pool_recycle": "3600"
        }
      }
    }
  }
}
```

### Configuration with Query Usage Collection
```json
{
  "source": {
    "sourceConfig": {
      "config": {
        "type": "DatabaseMetadata",
        "includeStoredProcedures": true,
        "queryLogDuration": 1,
        "queryLogFilePath": "/var/log/mysql/mysql-slow.log",
        "resultLimit": 1000
      }
    }
  }
}
```

## Performance Optimization Tips

### 1. Connection Settings
```json
{
  "connectionOptions": {
    "connect_timeout": 30,
    "read_timeout": 300,
    "charset": "utf8mb4"
  },
  "connectionArguments": {
    "pool_size": "5",
    "pool_recycle": "3600",
    "pool_pre_ping": "true"
  }
}
```

### 2. Filtering for Large Databases
```json
{
  "sourceConfig": {
    "config": {
      "schemaFilterPattern": {
        "includes": ["prod_.*", "analytics"],
        "excludes": ["temp_.*", "test_.*", "backup_.*"]
      },
      "tableFilterPattern": {
        "excludes": [".*_temp", ".*_backup", ".*_archive"]
      }
    }
  }
}
```

### 3. Workflow Configuration
```json
{
  "workflowConfig": {
    "loggerLevel": "WARN",
    "openMetadataServerConfig": {
      "retry": {
        "enabled": true,
        "maxRetries": 5,
        "initialDelay": 2,
        "maxDelay": 30
      }
    }
  }
}
```

## Next Steps

After successful ingestion:

1. **Set up Data Profiling**: Follow [Test Case 3](/how-to-guides/ingestion-examples/data-profiling-configuration)
2. **Configure Custom Fields**: Follow [Test Case 2](/how-to-guides/ingestion-examples/custom-metadata-fields-api)
3. **Schedule Regular Ingestion**: Set up automated workflows via the OpenMetadata UI
4. **Monitor Data Quality**: Implement data quality tests and monitoring

## Troubleshooting Checklist

- [ ] Database user has correct permissions
- [ ] Network connectivity is established
- [ ] JWT token is valid and not expired
- [ ] Configuration file syntax is valid JSON
- [ ] Filter patterns match your database structure
- [ ] OpenMetadata server is accessible
- [ ] Required Python packages are installed
- [ ] Log files provide specific error details

{% note %}
Keep your JWT tokens secure and rotate them regularly. For production environments, always use SSL connections and follow security best practices.
{% /note %}