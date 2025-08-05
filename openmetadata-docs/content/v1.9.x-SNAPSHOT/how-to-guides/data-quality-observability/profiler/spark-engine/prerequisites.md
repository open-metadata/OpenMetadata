---
title: Spark Engine Prerequisites | OpenMetadata Spark Profiling Setup
description: Learn about the required infrastructure, network connectivity, and setup for using Spark Engine in OpenMetadata.
slug: /how-to-guides/data-quality-observability/profiler/spark-engine/prerequisites
collate: true
---

# Spark Engine Prerequisites

## Required Infrastructure

### Spark Cluster

- **Spark Connect available** (versions 3.5.2 to 3.5.6 supported)
- **Network access** from the pipeline execution environment to the Spark Connect endpoint
- **Network access** from the pipeline execution environment to the OpenMetadata server

### Database Drivers in Spark Cluster

Depending on your source database, ensure the appropriate driver is installed in your Spark cluster:

- **PostgreSQL**: `org.postgresql.Driver`
- **MySQL**: `com.mysql.cj.jdbc.Driver`

{% note %}
The specific driver versions should match your Spark version and database version for optimal compatibility.
{% /note %}

## Network Connectivity

The pipeline execution environment must have:

- **Outbound access** to your Spark Connect endpoint (typically port 15002)
- **Outbound access** to your OpenMetadata server (typically port 8585)
- **Inbound access** from Spark workers to your source database

## Verification Steps

1. **Test Spark Connect**: Verify connectivity from your pipeline environment to Spark Connect
2. **Test OpenMetadata**: Ensure your pipeline environment can reach the OpenMetadata API
3. **Test Database**: Confirm Spark workers can connect to your source database
4. **Verify Drivers**: Check that the appropriate database driver is available in your Spark cluster

## Example Verification Commands

### Test Spark Connect Connectivity

```bash
# Test basic connectivity to Spark Connect
telnet your_spark_connect_host 15002

# Or using curl if available
curl -X GET http://your_spark_connect_host:15002
```

### Test OpenMetadata Connectivity

```bash
# Test OpenMetadata API connectivity
curl -X GET http://your_openmetadata_host:8585/api/v1/version
```

### Test Database Connectivity from Spark

```python
# Test database connectivity using Spark
from pyspark.sql import SparkSession

spark = SparkSession.builder \
    .appName("DatabaseConnectivityTest") \
    .remote("<SPARK_CONNECT_HOST>:<SPARK_CONNECT_PORT>") \
    .config("spark.jars", "/path/to/your/database/driver.jar") \
    .getOrCreate()

# Test connection to your database
df = spark.read \
    .format("jdbc") \
    .option("url", "jdbc:your_database_url") \
    .option("dbtable", "your_test_table") \
    .option("user", "your_username") \
    .option("password", "your_password") \
    .load()

df.head()
```

{% inlineCalloutContainer %}
 {% inlineCallout
  color="violet-70"
  bold="Partitioning Requirements"
  icon="MdOutlineSchema"
  href="/how-to-guides/data-quality-observability/profiler/spark-engine/partitioning" %}
  Learn about the partitioning requirements for Spark Engine.
 {% /inlineCallout %}
 {% inlineCallout
    icon="MdAnalytics"
    bold="Configuration"
    href="/how-to-guides/data-quality-observability/profiler/spark-engine/configuration" %}
    Configure your profiler pipeline to use Spark Engine.
 {% /inlineCallout %}
{% /inlineCalloutContainer %} 