---
title: Test Case 3 - Data Profiling Configuration Tutorial
description: Complete guide for configuring data profiling with performance optimization, sampling strategies, and result visualization in OpenMetadata.
slug: /how-to-guides/ingestion-examples/data-profiling-configuration
---

# Test Case 3: Testing Data Profiling Configuration

This comprehensive tutorial walks you through configuring data profiling in OpenMetadata, including setup, performance optimization, sampling strategies, and how to interpret and view profiling results.

## Prerequisites

### System Requirements
- OpenMetadata server running with profiler support
- Database connector already configured (see [Test Case 1](/how-to-guides/ingestion-examples/mysql-ingestion-pipeline))
- Python environment with required profiler dependencies
- Database with appropriate permissions for profiling queries

### Required Database Permissions
Your database user needs additional permissions for profiling:

#### MySQL Example
```sql
-- Basic profiling permissions
GRANT SELECT ON *.* TO 'openmetadata_user'@'%';
GRANT SELECT ON INFORMATION_SCHEMA.* TO 'openmetadata_user'@'%';

-- For advanced profiling metrics
GRANT SELECT ON PERFORMANCE_SCHEMA.* TO 'openmetadata_user'@'%';

-- For table statistics
GRANT SELECT ON mysql.* TO 'openmetadata_user'@'%';

FLUSH PRIVILEGES;
```

#### PostgreSQL Example
```sql
-- Basic profiling permissions
GRANT USAGE ON SCHEMA information_schema TO openmetadata_user;
GRANT SELECT ON ALL TABLES IN SCHEMA information_schema TO openmetadata_user;

-- For specific databases
GRANT USAGE ON SCHEMA public TO openmetadata_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO openmetadata_user;

-- For statistics
GRANT SELECT ON pg_stats TO openmetadata_user;
```

### Install Profiler Dependencies
```bash
# Install OpenMetadata ingestion with profiler support
pip3 install "openmetadata-ingestion[mysql,postgresql,profiler]"

# For additional profiling capabilities
pip3 install great-expectations pandas numpy
```

## Step 1: Basic Data Profiling Configuration

### Create Profiler Configuration File
Create a file named `mysql_profiler_config.json`:

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
          "charset": "utf8mb4"
        }
      }
    },
    "sourceConfig": {
      "config": {
        "type": "Profiler",
        "generateSampleData": true,
        "profileSample": 100,
        "profileSampleType": "PERCENTAGE",
        "samplingMethodType": "SYSTEM",
        "schemaFilterPattern": {
          "includes": ["ecommerce", "analytics"]
        },
        "tableFilterPattern": {
          "includes": ["users", "orders", "products"],
          "excludes": [".*_temp", ".*_backup"]
        },
        "profileQuery": "SELECT * FROM {}.{} WHERE created_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)",
        "processPiiSensitive": false,
        "confidence": 95,
        "timeoutSeconds": 43200
      }
    }
  },
  "processor": {
    "type": "orm-profiler",
    "config": {}
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
      }
    }
  }
}
```

### Configuration Parameters Explained

#### Core Profiling Parameters
- **`generateSampleData`**: Generate sample data preview (true/false)
- **`profileSample`**: Percentage or number of rows to sample
- **`profileSampleType`**: `"PERCENTAGE"` or `"ROWS"`
- **`samplingMethodType`**: `"SYSTEM"`, `"BERNOULLI"`, or `"RANDOM"`
- **`processPiiSensitive`**: Include PII-sensitive columns in profiling
- **`confidence`**: Statistical confidence level (90, 95, 99)
- **`timeoutSeconds`**: Maximum time for profiling workflow

#### Advanced Profiling Options
- **`profileQuery`**: Custom query for data sampling
- **`excludeColumns`**: List of columns to exclude from profiling
- **`includeColumns`**: List of columns to specifically include
- **`computeMetrics`**: List of specific metrics to compute

## Step 2: Sampling Strategies & Performance Impact

### Sampling Method Types

#### 1. SYSTEM Sampling (Fastest)
```json
{
  "samplingMethodType": "SYSTEM",
  "profileSample": 10,
  "profileSampleType": "PERCENTAGE"
}
```
- **Performance**: Fastest method
- **Use Case**: Large tables (>1M rows)
- **Accuracy**: Good for most metrics
- **Database Support**: MySQL, PostgreSQL, SQL Server

#### 2. BERNOULLI Sampling (Most Random)
```json
{
  "samplingMethodType": "BERNOULLI",
  "profileSample": 5,
  "profileSampleType": "PERCENTAGE"
}
```
- **Performance**: Moderate speed
- **Use Case**: When statistical accuracy is critical
- **Accuracy**: Highest statistical accuracy
- **Database Support**: PostgreSQL, SQL Server

#### 3. RANDOM Sampling (Balanced)
```json
{
  "samplingMethodType": "RANDOM",
  "profileSample": 1000,
  "profileSampleType": "ROWS"
}
```
- **Performance**: Slower, but predictable
- **Use Case**: Fixed sample size requirements
- **Accuracy**: Good balance
- **Database Support**: All databases

### Performance Impact Comparison

| Table Size | Sample % | SYSTEM Time | BERNOULLI Time | RANDOM Time | Accuracy |
|------------|----------|-------------|----------------|-------------|----------|
| 100K rows  | 10%      | 2 sec      | 3 sec         | 4 sec       | High     |
| 1M rows    | 5%       | 8 sec      | 15 sec        | 30 sec      | High     |
| 10M rows   | 1%       | 30 sec     | 120 sec       | 300 sec     | Medium   |
| 100M rows  | 0.1%     | 60 sec     | 600 sec       | 1800 sec    | Medium   |

### Recommended Sampling Strategies

#### For Small Tables (<100K rows)
```json
{
  "profileSample": 100,
  "profileSampleType": "PERCENTAGE",
  "samplingMethodType": "SYSTEM"
}
```

#### For Medium Tables (100K - 10M rows)
```json
{
  "profileSample": 5,
  "profileSampleType": "PERCENTAGE",
  "samplingMethodType": "SYSTEM"
}
```

#### For Large Tables (>10M rows)
```json
{
  "profileSample": 10000,
  "profileSampleType": "ROWS",
  "samplingMethodType": "SYSTEM"
}
```

## Step 3: Advanced Profiling Configuration

### Custom Profiling Queries
```json
{
  "sourceConfig": {
    "config": {
      "type": "Profiler",
      "profileQuery": "SELECT * FROM {}.{} WHERE active = 1 AND created_date >= '2024-01-01'",
      "partitionDetails": {
        "partitionColumnName": "created_date",
        "partitionIntervalType": "TIME-UNIT",
        "partitionInterval": 30,
        "partitionIntervalUnit": "DAY"
      }
    }
  }
}
```

### Column-Specific Configuration
```json
{
  "sourceConfig": {
    "config": {
      "type": "Profiler",
      "excludeColumns": ["password_hash", "ssn", "credit_card"],
      "includeColumns": ["user_id", "email", "registration_date", "status"],
      "computeMetrics": [
        "nullCount",
        "uniqueCount",
        "distinctCount",
        "mean",
        "median",
        "min",
        "max",
        "stddev"
      ]
    }
  }
}
```

### Time-Based Profiling
```json
{
  "sourceConfig": {
    "config": {
      "type": "Profiler",
      "profileQuery": "SELECT * FROM {}.{} WHERE DATE(updated_at) = CURDATE()",
      "timeoutSeconds": 7200,
      "computeMetrics": [
        "rowCount",
        "nullCount",
        "uniqueCount",
        "distinctCount"
      ]
    }
  }
}
```

## Step 4: Run Data Profiling

### Test Configuration
```bash
# Validate profiler configuration
python -c "import json; json.load(open('mysql_profiler_config.json'))"

# Test database connectivity
metadata profile -c mysql_profiler_config.json --dry-run
```

### Run Profiling with Different Verbosity Levels
```bash
# Run with basic logging
metadata profile -c mysql_profiler_config.json

# Run with verbose logging for troubleshooting
metadata profile -c mysql_profiler_config.json --verbose

# Run with debug logging
metadata profile -c mysql_profiler_config.json --log-level DEBUG
```

### Monitor Profiling Progress
```bash
# Monitor profiling logs
tail -f /tmp/openmetadata_profiler.log

# Check for specific table profiling
grep -i "profiling table" /tmp/openmetadata_profiler.log

# Monitor for errors
grep -i error /tmp/openmetadata_profiler.log
```

## Step 5: Understanding Profiling Metrics

### Basic Metrics Generated

#### Numerical Columns
- **Count**: Total number of non-null values
- **Null Count**: Number of null values
- **Unique Count**: Number of unique values
- **Distinct Count**: Number of distinct values
- **Mean**: Average value
- **Median**: Middle value when sorted
- **Min/Max**: Minimum and maximum values
- **Standard Deviation**: Measure of data spread
- **Variance**: Square of standard deviation
- **Quantiles**: 25th, 50th, 75th percentiles

#### String Columns
- **Count**: Total number of non-null values
- **Null Count**: Number of null values
- **Unique Count**: Number of unique values
- **Min/Max Length**: Shortest and longest strings
- **Mean Length**: Average string length

#### Date/Datetime Columns
- **Count**: Total number of non-null values
- **Null Count**: Number of null values
- **Min/Max Date**: Earliest and latest dates
- **Unique Count**: Number of unique dates

### Advanced Metrics

#### Data Quality Metrics
- **Completeness**: Percentage of non-null values
- **Uniqueness**: Percentage of unique values
- **Validity**: Percentage of valid format values
- **Consistency**: Consistency across related columns

#### Distribution Analysis
- **Histogram**: Data distribution visualization
- **Value Frequency**: Most and least common values
- **Outlier Detection**: Statistical outliers identification

## Step 6: View Profiling Results

### In OpenMetadata UI

#### Navigate to Profiler Results
1. Login to OpenMetadata UI
2. Go to **Databases** → Select your database → Select table
3. Click on the **Profiler** tab
4. View latest profiling run results

#### Understanding the Profiler UI
- **Overview Tab**: Summary statistics and data health score
- **Column Details**: Individual column profiling metrics
- **Sample Data**: Preview of actual data
- **Data Quality**: Quality test results and trends
- **Historical Trends**: Profiling metrics over time

### Via API

#### Get Profiling Results
```bash
# Get latest profiler results for a table
export TABLE_FQN="mysql_production.ecommerce.users"

curl -X GET "${OM_HOST}/api/v1/tables/name/${TABLE_FQN}/tableProfile/latest" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" | jq
```

#### Get Historical Profiling Data
```bash
# Get profiling history for last 30 days
curl -X GET "${OM_HOST}/api/v1/tables/name/${TABLE_FQN}/tableProfile?startTs=$(date -d '30 days ago' +%s)&endTs=$(date +%s)" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" | jq
```

#### Get Column-Specific Profiling
```bash
# Get profiling data for specific column
curl -X GET "${OM_HOST}/api/v1/tables/name/${TABLE_FQN}" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" | jq '.columns[] | select(.name=="email") | .profile'
```

## Step 7: Troubleshooting Common Issues

### Issue 1: Profiling Takes Too Long

#### Symptoms
- Profiling runs for hours without completing
- Database connections timeout
- High CPU/memory usage on database

#### Solutions
```json
{
  "sourceConfig": {
    "config": {
      "profileSample": 1,
      "profileSampleType": "PERCENTAGE",
      "samplingMethodType": "SYSTEM",
      "timeoutSeconds": 3600,
      "excludeColumns": ["large_text_column", "blob_data"]
    }
  }
}
```

### Issue 2: Memory Issues

#### Symptoms
- Out of memory errors
- Profiler process killed
- System becomes unresponsive

#### Solutions
```bash
# Increase memory limits
export PYTHONMEMORY=8G

# Use smaller sample sizes
{
  "profileSample": 1000,
  "profileSampleType": "ROWS"
}

# Process tables in smaller batches
{
  "tableFilterPattern": {
    "includes": ["users", "orders"]
  }
}
```

### Issue 3: Incorrect Statistics

#### Symptoms
- Profiling metrics don't match expected values
- Inconsistent results between runs
- Missing data in results

#### Solutions
```json
{
  "sourceConfig": {
    "config": {
      "samplingMethodType": "BERNOULLI",
      "profileSample": 10,
      "confidence": 95,
      "profileQuery": "SELECT * FROM {}.{} WHERE deleted_at IS NULL"
    }
  }
}
```

### Issue 4: Permission Errors

#### Symptoms
- Access denied errors
- Unable to read certain tables
- Incomplete profiling results

#### Solutions
```sql
-- Check current permissions
SHOW GRANTS FOR 'openmetadata_user'@'%';

-- Grant additional permissions if needed
GRANT SELECT ON performance_schema.* TO 'openmetadata_user'@'%';
GRANT SHOW VIEW ON *.* TO 'openmetadata_user'@'%';
```

## Step 8: Performance Optimization

### Database-Specific Optimizations

#### MySQL Optimizations
```json
{
  "serviceConnection": {
    "config": {
      "connectionOptions": {
        "connect_timeout": 300,
        "read_timeout": 3600,
        "charset": "utf8mb4"
      },
      "connectionArguments": {
        "pool_size": "5",
        "pool_timeout": "30",
        "pool_recycle": "3600"
      }
    }
  }
}
```

#### PostgreSQL Optimizations
```json
{
  "serviceConnection": {
    "config": {
      "connectionArguments": {
        "connect_timeout": "300",
        "application_name": "openmetadata_profiler",
        "work_mem": "256MB"
      }
    }
  }
}
```

### Workflow Optimizations
```json
{
  "workflowConfig": {
    "loggerLevel": "WARN",
    "openMetadataServerConfig": {
      "retry": {
        "enabled": true,
        "maxRetries": 3,
        "initialDelay": 5,
        "maxDelay": 60
      }
    }
  },
  "processor": {
    "type": "orm-profiler",
    "config": {
      "tableConfig": [
        {
          "fullyQualifiedName": "mysql_production.ecommerce.large_table",
          "profileSample": 0.1,
          "profileSampleType": "PERCENTAGE",
          "samplingMethodType": "SYSTEM"
        }
      ]
    }
  }
}
```

## Step 9: Automated Profiling Workflows

### Schedule Regular Profiling
```json
{
  "workflowConfig": {
    "schedule": {
      "cron": "0 2 * * *",
      "timezone": "UTC"
    },
    "openMetadataServerConfig": {
      "hostPort": "http://localhost:8585/api",
      "authProvider": "openmetadata",
      "securityConfig": {
        "jwtToken": "your-jwt-token-here"
      }
    }
  }
}
```

### Conditional Profiling
```bash
#!/bin/bash
# Script for conditional profiling based on data freshness

TABLE_FQN="mysql_production.ecommerce.users"
LAST_PROFILED=$(curl -s -X GET "${OM_HOST}/api/v1/tables/name/${TABLE_FQN}/tableProfile/latest" \
  -H "Authorization: Bearer ${JWT_TOKEN}" | jq -r '.profileDate')

LAST_UPDATED=$(curl -s -X GET "${OM_HOST}/api/v1/tables/name/${TABLE_FQN}" \
  -H "Authorization: Bearer ${JWT_TOKEN}" | jq -r '.updatedAt')

if [[ "$LAST_UPDATED" > "$LAST_PROFILED" ]]; then
  echo "Data updated since last profiling. Running profiler..."
  metadata profile -c mysql_profiler_config.json
else
  echo "Data unchanged. Skipping profiling."
fi
```

## Step 10: Integration with Data Quality

### Create Data Quality Tests from Profiling
```bash
# Get profiling results
export PROFILE_RESULTS=$(curl -s -X GET "${OM_HOST}/api/v1/tables/name/${TABLE_FQN}/tableProfile/latest" \
  -H "Authorization: Bearer ${JWT_TOKEN}")

# Extract metrics for data quality tests
export NULL_COUNT=$(echo $PROFILE_RESULTS | jq '.columnProfile[0].nullCount')
export ROW_COUNT=$(echo $PROFILE_RESULTS | jq '.rowCount')

# Create data quality test based on profiling
curl -X POST "${OM_HOST}/api/v1/dataQuality/testCases" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "users_email_completeness_test",
    "displayName": "Users Email Completeness",
    "description": "Test based on profiling results",
    "entityLink": "<#E::table::'${TABLE_FQN}'::columns::email>",
    "testDefinition": {
      "name": "columnNullCountToBeInRange",
      "displayName": "Column Null Count To Be In Range"
    },
    "parameterValues": [
      {"name": "minValue", "value": "0"},
      {"name": "maxValue", "value": "'$((NULL_COUNT + 100))'"}
    ]
  }'
```

## Best Practices & Recommendations

### 1. Sampling Strategy Selection
- **Small tables (<100K)**: Use 100% sampling
- **Medium tables (100K-10M)**: Use 5-10% SYSTEM sampling
- **Large tables (>10M)**: Use fixed row count (10K-100K rows)
- **Very large tables (>100M)**: Use 0.1-1% SYSTEM sampling

### 2. Performance Guidelines
- Start with small sample sizes and increase gradually
- Use SYSTEM sampling for large tables
- Exclude unnecessary columns (BLOBs, large text fields)
- Profile during off-peak hours
- Monitor database performance impact

### 3. Scheduling Recommendations
- **Daily**: Critical tables with frequent changes
- **Weekly**: Important tables with moderate changes
- **Monthly**: Archive tables and historical data
- **On-demand**: Tables with unpredictable update patterns

### 4. Monitoring & Alerting
```bash
# Monitor profiling job success/failure
curl -X GET "${OM_HOST}/api/v1/services/ingestionPipelines?serviceType=Profiler" \
  -H "Authorization: Bearer ${JWT_TOKEN}" | jq '.data[] | {name: .name, status: .pipelineStatuses[-1].pipelineState}'
```

## Validation Checklist

- [ ] Database permissions are correctly configured
- [ ] Profiler configuration is valid JSON
- [ ] Sample size is appropriate for table size
- [ ] Profiling completes within expected time
- [ ] Metrics appear in OpenMetadata UI
- [ ] Historical profiling data is accessible
- [ ] Data quality tests can be created from profiling results
- [ ] No significant performance impact on production database

## Next Steps

After successful data profiling setup:

1. **Implement Data Quality Tests**: Use profiling insights to create relevant quality tests
2. **Set up Monitoring**: Create alerts for significant metric changes
3. **Optimize Performance**: Fine-tune sampling and scheduling based on results
4. **Integrate with Workflows**: Include profiling in your data pipeline workflows

{% note %}
Data profiling can impact database performance. Always start with small sample sizes and monitor your database during profiling runs. Consider running profiling during off-peak hours for production systems.
{% /note %}