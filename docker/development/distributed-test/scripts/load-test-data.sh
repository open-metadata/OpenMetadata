#!/bin/bash
# Load test data for distributed indexing testing

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Default values
SERVER_URL="http://localhost:8585"
NUM_TABLES=30000
NUM_DASHBOARDS=10000
NUM_PIPELINES=5000
NUM_TOPICS=5000
NUM_DATABASES=10

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --tables)
            NUM_TABLES="$2"
            shift 2
            ;;
        --dashboards)
            NUM_DASHBOARDS="$2"
            shift 2
            ;;
        --pipelines)
            NUM_PIPELINES="$2"
            shift 2
            ;;
        --topics)
            NUM_TOPICS="$2"
            shift 2
            ;;
        --databases)
            NUM_DATABASES="$2"
            shift 2
            ;;
        --server)
            SERVER_URL="$2"
            shift 2
            ;;
        --quick)
            # Quick mode for rapid testing - smaller dataset
            NUM_TABLES=5000
            NUM_DASHBOARDS=2000
            NUM_PIPELINES=1000
            NUM_TOPICS=1000
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --tables NUM       Number of tables to create (default: 30000)"
            echo "  --dashboards NUM   Number of dashboards to create (default: 10000)"
            echo "  --pipelines NUM    Number of pipelines to create (default: 5000)"
            echo "  --topics NUM       Number of topics to create (default: 5000)"
            echo "  --databases NUM    Number of databases to distribute tables across (default: 10)"
            echo "  --server URL       Target server URL (default: http://localhost:8585)"
            echo "  --quick            Quick mode with smaller dataset (tables: 5000, dashboards: 2000, pipelines: 1000, topics: 1000)"
            echo "  -h, --help         Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

TOTAL=$((NUM_TABLES + NUM_DASHBOARDS + NUM_PIPELINES + NUM_TOPICS))

echo "======================================"
echo "Loading Test Data for Distributed Indexing"
echo "======================================"
echo "Server: $SERVER_URL"
echo ""
echo "Entity counts:"
echo "  - Tables:     $NUM_TABLES"
echo "  - Dashboards: $NUM_DASHBOARDS"
echo "  - Pipelines:  $NUM_PIPELINES"
echo "  - Topics:     $NUM_TOPICS"
echo "  - Total:      $TOTAL"
echo ""

# Use Python with urllib (built-in, no extra packages needed)
python3 << EOF
import urllib.request
import urllib.error
import json
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

SERVER_URL = "${SERVER_URL}"
NUM_TABLES = ${NUM_TABLES}
NUM_DASHBOARDS = ${NUM_DASHBOARDS}
NUM_PIPELINES = ${NUM_PIPELINES}
NUM_TOPICS = ${NUM_TOPICS}
NUM_DATABASES = ${NUM_DATABASES}

print(f"Connecting to {SERVER_URL}...")
sys.stdout.flush()

def make_request(url, data=None, method="GET", headers=None):
    if headers is None:
        headers = {}
    headers["Content-Type"] = "application/json"
    if data:
        data = json.dumps(data).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            return response.status, json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        try:
            body = e.read().decode('utf-8')
        except:
            body = str(e)
        return e.code, body
    except Exception as e:
        return 0, str(e)

# Use admin JWT token directly
token = "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
print("Using admin JWT token for authentication.")

headers = {"Content-Type": "application/json"}
if token:
    headers["Authorization"] = f"Bearer {token}"

overall_start = time.time()
stats = {"tables": 0, "dashboards": 0, "pipelines": 0, "topics": 0}

# ========== TABLES ==========
if NUM_TABLES > 0:
    print("")
    print("=" * 50)
    print("Creating Tables")
    print("=" * 50)

    # Create database service
    print("Creating database service...")
    sys.stdout.flush()
    service_data = {
        "name": "test-service-distributed",
        "serviceType": "Mysql",
        "connection": {
            "config": {
                "type": "Mysql",
                "username": "test",
                "authType": {"password": "test"},
                "hostPort": "localhost:3306"
            }
        }
    }

    status, resp = make_request(
        f"{SERVER_URL}/api/v1/services/databaseServices",
        data=service_data,
        method="PUT",
        headers=headers
    )

    if status in [200, 201] and isinstance(resp, dict):
        db_service_fqn = resp["fullyQualifiedName"]
        print(f"Database service created: {db_service_fqn}")
    else:
        print(f"Failed to create database service: {status} - {resp}")
        sys.exit(1)

    # Create databases
    print(f"Creating {NUM_DATABASES} databases...")
    sys.stdout.flush()
    database_fqns = []
    for i in range(NUM_DATABASES):
        db_data = {"name": f"test_db_{i:04d}", "service": db_service_fqn}
        status, resp = make_request(f"{SERVER_URL}/api/v1/databases", data=db_data, method="PUT", headers=headers)
        if status in [200, 201] and isinstance(resp, dict):
            database_fqns.append(resp["fullyQualifiedName"])

    print(f"Created {len(database_fqns)} databases")

    # Create schemas
    print("Creating schemas...")
    schema_fqns = []
    for db_fqn in database_fqns:
        schema_data = {"name": "public", "database": db_fqn}
        status, resp = make_request(f"{SERVER_URL}/api/v1/databaseSchemas", data=schema_data, method="PUT", headers=headers)
        if status in [200, 201] and isinstance(resp, dict):
            schema_fqns.append(resp["fullyQualifiedName"])

    print(f"Created {len(schema_fqns)} schemas")

    if not schema_fqns:
        print("ERROR: No schemas created. Cannot continue with tables.")
    else:
        # Create tables
        print(f"Creating {NUM_TABLES} tables...")
        sys.stdout.flush()
        tables_per_schema = NUM_TABLES // len(schema_fqns)
        created = 0
        failed = 0
        start_time = time.time()

        def create_table(args):
            schema_fqn, table_idx = args
            table_data = {
                "name": f"table_{table_idx:06d}",
                "databaseSchema": schema_fqn,
                "columns": [
                    {"name": "id", "dataType": "BIGINT", "description": "Primary key"},
                    {"name": "name", "dataType": "VARCHAR", "dataLength": 255, "description": "Name field"},
                    {"name": "created_at", "dataType": "TIMESTAMP", "description": "Creation timestamp"},
                    {"name": "data", "dataType": "JSON", "description": "JSON data field"}
                ]
            }
            status, _ = make_request(f"{SERVER_URL}/api/v1/tables", data=table_data, method="PUT", headers=headers)
            return status in [200, 201]

        # Prepare tasks
        tasks = []
        table_idx = 0
        for schema_fqn in schema_fqns:
            for _ in range(tables_per_schema):
                tasks.append((schema_fqn, table_idx))
                table_idx += 1
                if table_idx >= NUM_TABLES:
                    break
            if table_idx >= NUM_TABLES:
                break

        # Execute with thread pool
        with ThreadPoolExecutor(max_workers=20) as executor:
            futures = {executor.submit(create_table, task): task for task in tasks}
            for future in as_completed(futures):
                if future.result():
                    created += 1
                else:
                    failed += 1
                total = created + failed
                if total % 1000 == 0 or total == len(tasks):
                    elapsed = time.time() - start_time
                    rate = total / elapsed if elapsed > 0 else 0
                    print(f"  Tables: {total}/{NUM_TABLES} ({rate:.1f}/sec) - Created: {created}, Failed: {failed}")
                    sys.stdout.flush()

        stats["tables"] = created
        print(f"Tables completed: {created} created, {failed} failed")

# ========== DASHBOARDS ==========
if NUM_DASHBOARDS > 0:
    print("")
    print("=" * 50)
    print("Creating Dashboards")
    print("=" * 50)

    # Create dashboard service
    print("Creating dashboard service...")
    sys.stdout.flush()
    dashboard_service_data = {
        "name": "test-dashboard-service",
        "serviceType": "Looker",
        "connection": {
            "config": {
                "type": "Looker",
                "clientId": "test-client-id",
                "clientSecret": "test-client-secret",
                "hostPort": "https://looker.example.com"
            }
        }
    }

    status, resp = make_request(
        f"{SERVER_URL}/api/v1/services/dashboardServices",
        data=dashboard_service_data,
        method="PUT",
        headers=headers
    )

    if status in [200, 201] and isinstance(resp, dict):
        dashboard_service_fqn = resp["fullyQualifiedName"]
        print(f"Dashboard service created: {dashboard_service_fqn}")
    else:
        print(f"Failed to create dashboard service: {status} - {resp}")
        dashboard_service_fqn = None

    if dashboard_service_fqn:
        # Create dashboards
        print(f"Creating {NUM_DASHBOARDS} dashboards...")
        sys.stdout.flush()
        created = 0
        failed = 0
        start_time = time.time()

        def create_dashboard(idx):
            dashboard_data = {
                "name": f"dashboard_{idx:06d}",
                "service": dashboard_service_fqn,
                "displayName": f"Test Dashboard {idx}",
                "description": f"Auto-generated test dashboard {idx} for distributed indexing testing"
            }
            status, _ = make_request(f"{SERVER_URL}/api/v1/dashboards", data=dashboard_data, method="PUT", headers=headers)
            return status in [200, 201]

        # Execute with thread pool
        with ThreadPoolExecutor(max_workers=20) as executor:
            futures = {executor.submit(create_dashboard, i): i for i in range(NUM_DASHBOARDS)}
            for future in as_completed(futures):
                if future.result():
                    created += 1
                else:
                    failed += 1
                total = created + failed
                if total % 1000 == 0 or total == NUM_DASHBOARDS:
                    elapsed = time.time() - start_time
                    rate = total / elapsed if elapsed > 0 else 0
                    print(f"  Dashboards: {total}/{NUM_DASHBOARDS} ({rate:.1f}/sec) - Created: {created}, Failed: {failed}")
                    sys.stdout.flush()

        stats["dashboards"] = created
        print(f"Dashboards completed: {created} created, {failed} failed")

# ========== PIPELINES ==========
if NUM_PIPELINES > 0:
    print("")
    print("=" * 50)
    print("Creating Pipelines")
    print("=" * 50)

    # Create pipeline service
    print("Creating pipeline service...")
    sys.stdout.flush()
    pipeline_service_data = {
        "name": "test-pipeline-service",
        "serviceType": "Airflow",
        "connection": {
            "config": {
                "type": "Airflow",
                "hostPort": "http://airflow.example.com:8080",
                "connection": {
                    "type": "BackendConnection"
                }
            }
        }
    }

    status, resp = make_request(
        f"{SERVER_URL}/api/v1/services/pipelineServices",
        data=pipeline_service_data,
        method="PUT",
        headers=headers
    )

    if status in [200, 201] and isinstance(resp, dict):
        pipeline_service_fqn = resp["fullyQualifiedName"]
        print(f"Pipeline service created: {pipeline_service_fqn}")
    else:
        print(f"Failed to create pipeline service: {status} - {resp}")
        pipeline_service_fqn = None

    if pipeline_service_fqn:
        # Create pipelines
        print(f"Creating {NUM_PIPELINES} pipelines...")
        sys.stdout.flush()
        created = 0
        failed = 0
        start_time = time.time()

        def create_pipeline(idx):
            pipeline_data = {
                "name": f"pipeline_{idx:06d}",
                "service": pipeline_service_fqn,
                "displayName": f"Test Pipeline {idx}",
                "description": f"Auto-generated test pipeline {idx} for distributed indexing testing"
            }
            status, _ = make_request(f"{SERVER_URL}/api/v1/pipelines", data=pipeline_data, method="PUT", headers=headers)
            return status in [200, 201]

        # Execute with thread pool
        with ThreadPoolExecutor(max_workers=20) as executor:
            futures = {executor.submit(create_pipeline, i): i for i in range(NUM_PIPELINES)}
            for future in as_completed(futures):
                if future.result():
                    created += 1
                else:
                    failed += 1
                total = created + failed
                if total % 1000 == 0 or total == NUM_PIPELINES:
                    elapsed = time.time() - start_time
                    rate = total / elapsed if elapsed > 0 else 0
                    print(f"  Pipelines: {total}/{NUM_PIPELINES} ({rate:.1f}/sec) - Created: {created}, Failed: {failed}")
                    sys.stdout.flush()

        stats["pipelines"] = created
        print(f"Pipelines completed: {created} created, {failed} failed")

# ========== TOPICS ==========
if NUM_TOPICS > 0:
    print("")
    print("=" * 50)
    print("Creating Topics")
    print("=" * 50)

    # Create messaging service
    print("Creating messaging service...")
    sys.stdout.flush()
    messaging_service_data = {
        "name": "test-messaging-service",
        "serviceType": "Kafka",
        "connection": {
            "config": {
                "type": "Kafka",
                "bootstrapServers": "localhost:9092"
            }
        }
    }

    status, resp = make_request(
        f"{SERVER_URL}/api/v1/services/messagingServices",
        data=messaging_service_data,
        method="PUT",
        headers=headers
    )

    if status in [200, 201] and isinstance(resp, dict):
        messaging_service_fqn = resp["fullyQualifiedName"]
        print(f"Messaging service created: {messaging_service_fqn}")
    else:
        print(f"Failed to create messaging service: {status} - {resp}")
        messaging_service_fqn = None

    if messaging_service_fqn:
        # Create topics
        print(f"Creating {NUM_TOPICS} topics...")
        sys.stdout.flush()
        created = 0
        failed = 0
        start_time = time.time()

        def create_topic(idx):
            topic_data = {
                "name": f"topic_{idx:06d}",
                "service": messaging_service_fqn,
                "partitions": 3,
                "replicationFactor": 1,
                "description": f"Auto-generated test topic {idx} for distributed indexing testing"
            }
            status, _ = make_request(f"{SERVER_URL}/api/v1/topics", data=topic_data, method="PUT", headers=headers)
            return status in [200, 201]

        # Execute with thread pool
        with ThreadPoolExecutor(max_workers=20) as executor:
            futures = {executor.submit(create_topic, i): i for i in range(NUM_TOPICS)}
            for future in as_completed(futures):
                if future.result():
                    created += 1
                else:
                    failed += 1
                total = created + failed
                if total % 1000 == 0 or total == NUM_TOPICS:
                    elapsed = time.time() - start_time
                    rate = total / elapsed if elapsed > 0 else 0
                    print(f"  Topics: {total}/{NUM_TOPICS} ({rate:.1f}/sec) - Created: {created}, Failed: {failed}")
                    sys.stdout.flush()

        stats["topics"] = created
        print(f"Topics completed: {created} created, {failed} failed")

# ========== SUMMARY ==========
overall_elapsed = time.time() - overall_start
total_created = sum(stats.values())

print("")
print("=" * 50)
print("Test Data Loading Complete!")
print("=" * 50)
print("")
print("Summary:")
print(f"  Tables:     {stats['tables']:>6}")
print(f"  Dashboards: {stats['dashboards']:>6}")
print(f"  Pipelines:  {stats['pipelines']:>6}")
print(f"  Topics:     {stats['topics']:>6}")
print(f"  -----------------")
print(f"  Total:      {total_created:>6}")
print("")
print(f"Time: {overall_elapsed:.1f} seconds")
if overall_elapsed > 0:
    print(f"Rate: {total_created/overall_elapsed:.1f} entities/second")
EOF

echo ""
echo "Test data loaded. You can now trigger reindexing with: ./scripts/trigger-reindex.sh"
