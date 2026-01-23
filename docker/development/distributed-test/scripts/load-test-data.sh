#!/bin/bash
# Load test data for distributed indexing testing

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Default values
SERVER_URL="http://localhost:8585"
NUM_TABLES=20000
NUM_DASHBOARDS=5000
NUM_CHARTS=10000
NUM_PIPELINES=3000
NUM_TOPICS=3000
NUM_MLMODELS=2000
NUM_CONTAINERS=2000
NUM_SEARCH_INDEXES=1000
NUM_GLOSSARIES=50
NUM_TERMS_PER_GLOSSARY=100
NUM_CLASSIFICATIONS=20
NUM_TAGS_PER_CLASSIFICATION=50
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
        --charts)
            NUM_CHARTS="$2"
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
        --mlmodels)
            NUM_MLMODELS="$2"
            shift 2
            ;;
        --containers)
            NUM_CONTAINERS="$2"
            shift 2
            ;;
        --search-indexes)
            NUM_SEARCH_INDEXES="$2"
            shift 2
            ;;
        --glossaries)
            NUM_GLOSSARIES="$2"
            shift 2
            ;;
        --terms-per-glossary)
            NUM_TERMS_PER_GLOSSARY="$2"
            shift 2
            ;;
        --classifications)
            NUM_CLASSIFICATIONS="$2"
            shift 2
            ;;
        --tags-per-classification)
            NUM_TAGS_PER_CLASSIFICATION="$2"
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
            NUM_TABLES=3000
            NUM_DASHBOARDS=1000
            NUM_CHARTS=2000
            NUM_PIPELINES=500
            NUM_TOPICS=500
            NUM_MLMODELS=300
            NUM_CONTAINERS=300
            NUM_SEARCH_INDEXES=200
            NUM_GLOSSARIES=10
            NUM_TERMS_PER_GLOSSARY=50
            NUM_CLASSIFICATIONS=5
            NUM_TAGS_PER_CLASSIFICATION=20
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --tables NUM              Number of tables to create (default: 20000)"
            echo "  --dashboards NUM          Number of dashboards to create (default: 5000)"
            echo "  --charts NUM              Number of charts to create (default: 10000)"
            echo "  --pipelines NUM           Number of pipelines to create (default: 3000)"
            echo "  --topics NUM              Number of topics to create (default: 3000)"
            echo "  --mlmodels NUM            Number of ML models to create (default: 2000)"
            echo "  --containers NUM          Number of containers to create (default: 2000)"
            echo "  --search-indexes NUM      Number of search indexes to create (default: 1000)"
            echo "  --glossaries NUM          Number of glossaries to create (default: 50)"
            echo "  --terms-per-glossary NUM  Number of terms per glossary (default: 100)"
            echo "  --classifications NUM     Number of classifications to create (default: 20)"
            echo "  --tags-per-classification Number of tags per classification (default: 50)"
            echo "  --databases NUM           Number of databases (default: 10)"
            echo "  --server URL              Target server URL (default: http://localhost:8585)"
            echo "  --quick                   Quick mode with smaller dataset (~10k entities)"
            echo "  -h, --help                Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

NUM_GLOSSARY_TERMS=$((NUM_GLOSSARIES * NUM_TERMS_PER_GLOSSARY))
NUM_TAGS=$((NUM_CLASSIFICATIONS * NUM_TAGS_PER_CLASSIFICATION))
TOTAL=$((NUM_TABLES + NUM_DASHBOARDS + NUM_CHARTS + NUM_PIPELINES + NUM_TOPICS + NUM_MLMODELS + NUM_CONTAINERS + NUM_SEARCH_INDEXES + NUM_GLOSSARIES + NUM_GLOSSARY_TERMS + NUM_CLASSIFICATIONS + NUM_TAGS))

echo "======================================"
echo "Loading Test Data for Distributed Indexing"
echo "======================================"
echo "Server: $SERVER_URL"
echo ""
echo "Entity counts:"
echo "  - Tables:          $NUM_TABLES"
echo "  - Dashboards:      $NUM_DASHBOARDS"
echo "  - Charts:          $NUM_CHARTS"
echo "  - Pipelines:       $NUM_PIPELINES"
echo "  - Topics:          $NUM_TOPICS"
echo "  - ML Models:       $NUM_MLMODELS"
echo "  - Containers:      $NUM_CONTAINERS"
echo "  - Search Indexes:  $NUM_SEARCH_INDEXES"
echo "  - Glossaries:      $NUM_GLOSSARIES"
echo "  - Glossary Terms:  $NUM_GLOSSARY_TERMS"
echo "  - Classifications: $NUM_CLASSIFICATIONS"
echo "  - Tags:            $NUM_TAGS"
echo "  --------------------------"
echo "  - Total:           $TOTAL"
echo ""

# Use Python with urllib (built-in, no extra packages needed)
python3 << EOF
import urllib.request
import urllib.error
import json
import sys
import time
import random
from concurrent.futures import ThreadPoolExecutor, as_completed

SERVER_URL = "${SERVER_URL}"
NUM_TABLES = ${NUM_TABLES}
NUM_DASHBOARDS = ${NUM_DASHBOARDS}
NUM_CHARTS = ${NUM_CHARTS}
NUM_PIPELINES = ${NUM_PIPELINES}
NUM_TOPICS = ${NUM_TOPICS}
NUM_MLMODELS = ${NUM_MLMODELS}
NUM_CONTAINERS = ${NUM_CONTAINERS}
NUM_SEARCH_INDEXES = ${NUM_SEARCH_INDEXES}
NUM_GLOSSARIES = ${NUM_GLOSSARIES}
NUM_TERMS_PER_GLOSSARY = ${NUM_TERMS_PER_GLOSSARY}
NUM_CLASSIFICATIONS = ${NUM_CLASSIFICATIONS}
NUM_TAGS_PER_CLASSIFICATION = ${NUM_TAGS_PER_CLASSIFICATION}
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
stats = {
    "tables": 0, "dashboards": 0, "charts": 0, "pipelines": 0, "topics": 0,
    "mlmodels": 0, "containers": 0, "searchIndexes": 0,
    "glossaries": 0, "glossaryTerms": 0, "classifications": 0, "tags": 0
}

# Store created entity FQNs for linking
dashboard_fqns = []

# ========== CLASSIFICATIONS & TAGS ==========
if NUM_CLASSIFICATIONS > 0:
    print("")
    print("=" * 50)
    print("Creating Classifications and Tags")
    print("=" * 50)

    created_classifications = 0
    created_tags = 0
    start_time = time.time()

    for i in range(NUM_CLASSIFICATIONS):
        classification_data = {
            "name": f"TestClassification_{i:04d}",
            "description": f"Test classification {i} for distributed indexing testing"
        }
        status, resp = make_request(
            f"{SERVER_URL}/api/v1/classifications",
            data=classification_data,
            method="PUT",
            headers=headers
        )
        if status in [200, 201] and isinstance(resp, dict):
            created_classifications += 1
            classification_fqn = resp["fullyQualifiedName"]

            # Create tags for this classification
            def create_tag(args):
                class_fqn, tag_idx = args
                tag_data = {
                    "name": f"Tag_{tag_idx:04d}",
                    "classification": class_fqn,
                    "description": f"Test tag {tag_idx} in classification"
                }
                status, _ = make_request(f"{SERVER_URL}/api/v1/tags", data=tag_data, method="PUT", headers=headers)
                return status in [200, 201]

            with ThreadPoolExecutor(max_workers=10) as executor:
                futures = [executor.submit(create_tag, (classification_fqn, j)) for j in range(NUM_TAGS_PER_CLASSIFICATION)]
                for future in as_completed(futures):
                    if future.result():
                        created_tags += 1

        if (i + 1) % 5 == 0 or i == NUM_CLASSIFICATIONS - 1:
            elapsed = time.time() - start_time
            print(f"  Classifications: {created_classifications}/{NUM_CLASSIFICATIONS}, Tags: {created_tags}/{NUM_CLASSIFICATIONS * NUM_TAGS_PER_CLASSIFICATION}")
            sys.stdout.flush()

    stats["classifications"] = created_classifications
    stats["tags"] = created_tags
    print(f"Classifications completed: {created_classifications} created")
    print(f"Tags completed: {created_tags} created")

# ========== GLOSSARIES & TERMS ==========
if NUM_GLOSSARIES > 0:
    print("")
    print("=" * 50)
    print("Creating Glossaries and Terms")
    print("=" * 50)

    created_glossaries = 0
    created_terms = 0
    start_time = time.time()

    for i in range(NUM_GLOSSARIES):
        glossary_data = {
            "name": f"TestGlossary_{i:04d}",
            "displayName": f"Test Glossary {i}",
            "description": f"Test glossary {i} for distributed indexing testing"
        }
        status, resp = make_request(
            f"{SERVER_URL}/api/v1/glossaries",
            data=glossary_data,
            method="PUT",
            headers=headers
        )
        if status in [200, 201] and isinstance(resp, dict):
            created_glossaries += 1
            glossary_fqn = resp["fullyQualifiedName"]

            # Create terms for this glossary
            def create_term(args):
                gloss_fqn, term_idx = args
                term_data = {
                    "name": f"Term_{term_idx:04d}",
                    "glossary": gloss_fqn,
                    "displayName": f"Term {term_idx}",
                    "description": f"Test glossary term {term_idx}"
                }
                status, _ = make_request(f"{SERVER_URL}/api/v1/glossaryTerms", data=term_data, method="PUT", headers=headers)
                return status in [200, 201]

            with ThreadPoolExecutor(max_workers=10) as executor:
                futures = [executor.submit(create_term, (glossary_fqn, j)) for j in range(NUM_TERMS_PER_GLOSSARY)]
                for future in as_completed(futures):
                    if future.result():
                        created_terms += 1

        if (i + 1) % 10 == 0 or i == NUM_GLOSSARIES - 1:
            elapsed = time.time() - start_time
            print(f"  Glossaries: {created_glossaries}/{NUM_GLOSSARIES}, Terms: {created_terms}/{NUM_GLOSSARIES * NUM_TERMS_PER_GLOSSARY}")
            sys.stdout.flush()

    stats["glossaries"] = created_glossaries
    stats["glossaryTerms"] = created_terms
    print(f"Glossaries completed: {created_glossaries} created")
    print(f"Glossary Terms completed: {created_terms} created")

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
            status, resp = make_request(f"{SERVER_URL}/api/v1/dashboards", data=dashboard_data, method="PUT", headers=headers)
            if status in [200, 201] and isinstance(resp, dict):
                return resp.get("fullyQualifiedName")
            return None

        # Execute with thread pool
        with ThreadPoolExecutor(max_workers=20) as executor:
            futures = {executor.submit(create_dashboard, i): i for i in range(NUM_DASHBOARDS)}
            for future in as_completed(futures):
                result = future.result()
                if result:
                    created += 1
                    dashboard_fqns.append(result)
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

# ========== CHARTS ==========
if NUM_CHARTS > 0 and dashboard_fqns:
    print("")
    print("=" * 50)
    print("Creating Charts")
    print("=" * 50)

    print(f"Creating {NUM_CHARTS} charts linked to dashboards...")
    sys.stdout.flush()
    created = 0
    failed = 0
    start_time = time.time()

    def create_chart(idx):
        # Link chart to a random dashboard
        dashboard_fqn = random.choice(dashboard_fqns) if dashboard_fqns else None
        chart_data = {
            "name": f"chart_{idx:06d}",
            "service": dashboard_service_fqn,
            "displayName": f"Test Chart {idx}",
            "chartType": random.choice(["Line", "Bar", "Pie", "Area", "Scatter", "Table"]),
            "description": f"Auto-generated test chart {idx}"
        }
        status, _ = make_request(f"{SERVER_URL}/api/v1/charts", data=chart_data, method="PUT", headers=headers)
        return status in [200, 201]

    with ThreadPoolExecutor(max_workers=20) as executor:
        futures = {executor.submit(create_chart, i): i for i in range(NUM_CHARTS)}
        for future in as_completed(futures):
            if future.result():
                created += 1
            else:
                failed += 1
            total = created + failed
            if total % 1000 == 0 or total == NUM_CHARTS:
                elapsed = time.time() - start_time
                rate = total / elapsed if elapsed > 0 else 0
                print(f"  Charts: {total}/{NUM_CHARTS} ({rate:.1f}/sec) - Created: {created}, Failed: {failed}")
                sys.stdout.flush()

    stats["charts"] = created
    print(f"Charts completed: {created} created, {failed} failed")

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

# ========== ML MODELS ==========
if NUM_MLMODELS > 0:
    print("")
    print("=" * 50)
    print("Creating ML Models")
    print("=" * 50)

    # Create ML model service
    print("Creating ML model service...")
    sys.stdout.flush()
    mlmodel_service_data = {
        "name": "test-mlmodel-service",
        "serviceType": "Mlflow",
        "connection": {
            "config": {
                "type": "Mlflow",
                "trackingUri": "http://mlflow.example.com:5000",
                "registryUri": "http://mlflow.example.com:5000"
            }
        }
    }

    status, resp = make_request(
        f"{SERVER_URL}/api/v1/services/mlmodelServices",
        data=mlmodel_service_data,
        method="PUT",
        headers=headers
    )

    if status in [200, 201] and isinstance(resp, dict):
        mlmodel_service_fqn = resp["fullyQualifiedName"]
        print(f"ML model service created: {mlmodel_service_fqn}")
    else:
        print(f"Failed to create ML model service: {status} - {resp}")
        mlmodel_service_fqn = None

    if mlmodel_service_fqn:
        print(f"Creating {NUM_MLMODELS} ML models...")
        sys.stdout.flush()
        created = 0
        failed = 0
        start_time = time.time()

        algorithms = ["LinearRegression", "RandomForest", "XGBoost", "NeuralNetwork", "SVM", "KMeans", "DecisionTree"]

        def create_mlmodel(idx):
            mlmodel_data = {
                "name": f"mlmodel_{idx:06d}",
                "service": mlmodel_service_fqn,
                "algorithm": random.choice(algorithms),
                "displayName": f"Test ML Model {idx}",
                "description": f"Auto-generated test ML model {idx}"
            }
            status, _ = make_request(f"{SERVER_URL}/api/v1/mlmodels", data=mlmodel_data, method="PUT", headers=headers)
            return status in [200, 201]

        with ThreadPoolExecutor(max_workers=20) as executor:
            futures = {executor.submit(create_mlmodel, i): i for i in range(NUM_MLMODELS)}
            for future in as_completed(futures):
                if future.result():
                    created += 1
                else:
                    failed += 1
                total = created + failed
                if total % 500 == 0 or total == NUM_MLMODELS:
                    elapsed = time.time() - start_time
                    rate = total / elapsed if elapsed > 0 else 0
                    print(f"  ML Models: {total}/{NUM_MLMODELS} ({rate:.1f}/sec) - Created: {created}, Failed: {failed}")
                    sys.stdout.flush()

        stats["mlmodels"] = created
        print(f"ML Models completed: {created} created, {failed} failed")

# ========== CONTAINERS ==========
if NUM_CONTAINERS > 0:
    print("")
    print("=" * 50)
    print("Creating Containers")
    print("=" * 50)

    # Create storage service
    print("Creating storage service...")
    sys.stdout.flush()
    storage_service_data = {
        "name": "test-storage-service",
        "serviceType": "S3",
        "connection": {
            "config": {
                "type": "S3",
                "awsConfig": {
                    "awsAccessKeyId": "test-key",
                    "awsSecretAccessKey": "test-secret",
                    "awsRegion": "us-east-1"
                }
            }
        }
    }

    status, resp = make_request(
        f"{SERVER_URL}/api/v1/services/storageServices",
        data=storage_service_data,
        method="PUT",
        headers=headers
    )

    if status in [200, 201] and isinstance(resp, dict):
        storage_service_fqn = resp["fullyQualifiedName"]
        print(f"Storage service created: {storage_service_fqn}")
    else:
        print(f"Failed to create storage service: {status} - {resp}")
        storage_service_fqn = None

    if storage_service_fqn:
        print(f"Creating {NUM_CONTAINERS} containers...")
        sys.stdout.flush()
        created = 0
        failed = 0
        start_time = time.time()

        def create_container(idx):
            container_data = {
                "name": f"container_{idx:06d}",
                "service": storage_service_fqn,
                "displayName": f"Test Container {idx}",
                "description": f"Auto-generated test container {idx}"
            }
            status, _ = make_request(f"{SERVER_URL}/api/v1/containers", data=container_data, method="PUT", headers=headers)
            return status in [200, 201]

        with ThreadPoolExecutor(max_workers=20) as executor:
            futures = {executor.submit(create_container, i): i for i in range(NUM_CONTAINERS)}
            for future in as_completed(futures):
                if future.result():
                    created += 1
                else:
                    failed += 1
                total = created + failed
                if total % 500 == 0 or total == NUM_CONTAINERS:
                    elapsed = time.time() - start_time
                    rate = total / elapsed if elapsed > 0 else 0
                    print(f"  Containers: {total}/{NUM_CONTAINERS} ({rate:.1f}/sec) - Created: {created}, Failed: {failed}")
                    sys.stdout.flush()

        stats["containers"] = created
        print(f"Containers completed: {created} created, {failed} failed")

# ========== SEARCH INDEXES ==========
if NUM_SEARCH_INDEXES > 0:
    print("")
    print("=" * 50)
    print("Creating Search Indexes")
    print("=" * 50)

    # Create search service
    print("Creating search service...")
    sys.stdout.flush()
    search_service_data = {
        "name": "test-search-service",
        "serviceType": "ElasticSearch",
        "connection": {
            "config": {
                "type": "ElasticSearch",
                "hostPort": "http://elasticsearch.example.com:9200"
            }
        }
    }

    status, resp = make_request(
        f"{SERVER_URL}/api/v1/services/searchServices",
        data=search_service_data,
        method="PUT",
        headers=headers
    )

    if status in [200, 201] and isinstance(resp, dict):
        search_service_fqn = resp["fullyQualifiedName"]
        print(f"Search service created: {search_service_fqn}")
    else:
        print(f"Failed to create search service: {status} - {resp}")
        search_service_fqn = None

    if search_service_fqn:
        print(f"Creating {NUM_SEARCH_INDEXES} search indexes...")
        sys.stdout.flush()
        created = 0
        failed = 0
        start_time = time.time()

        def create_search_index(idx):
            search_index_data = {
                "name": f"search_index_{idx:06d}",
                "service": search_service_fqn,
                "displayName": f"Test Search Index {idx}",
                "description": f"Auto-generated test search index {idx}",
                "fields": [
                    {"name": "id", "dataType": "KEYWORD"},
                    {"name": "content", "dataType": "TEXT"},
                    {"name": "timestamp", "dataType": "DATE"}
                ]
            }
            status, _ = make_request(f"{SERVER_URL}/api/v1/searchIndexes", data=search_index_data, method="PUT", headers=headers)
            return status in [200, 201]

        with ThreadPoolExecutor(max_workers=20) as executor:
            futures = {executor.submit(create_search_index, i): i for i in range(NUM_SEARCH_INDEXES)}
            for future in as_completed(futures):
                if future.result():
                    created += 1
                else:
                    failed += 1
                total = created + failed
                if total % 200 == 0 or total == NUM_SEARCH_INDEXES:
                    elapsed = time.time() - start_time
                    rate = total / elapsed if elapsed > 0 else 0
                    print(f"  Search Indexes: {total}/{NUM_SEARCH_INDEXES} ({rate:.1f}/sec) - Created: {created}, Failed: {failed}")
                    sys.stdout.flush()

        stats["searchIndexes"] = created
        print(f"Search Indexes completed: {created} created, {failed} failed")

# ========== SUMMARY ==========
overall_elapsed = time.time() - overall_start
total_created = sum(stats.values())

print("")
print("=" * 50)
print("Test Data Loading Complete!")
print("=" * 50)
print("")
print("Summary:")
print(f"  Tables:          {stats['tables']:>6}")
print(f"  Dashboards:      {stats['dashboards']:>6}")
print(f"  Charts:          {stats['charts']:>6}")
print(f"  Pipelines:       {stats['pipelines']:>6}")
print(f"  Topics:          {stats['topics']:>6}")
print(f"  ML Models:       {stats['mlmodels']:>6}")
print(f"  Containers:      {stats['containers']:>6}")
print(f"  Search Indexes:  {stats['searchIndexes']:>6}")
print(f"  Glossaries:      {stats['glossaries']:>6}")
print(f"  Glossary Terms:  {stats['glossaryTerms']:>6}")
print(f"  Classifications: {stats['classifications']:>6}")
print(f"  Tags:            {stats['tags']:>6}")
print(f"  --------------------------")
print(f"  Total:           {total_created:>6}")
print("")
print(f"Time: {overall_elapsed:.1f} seconds")
if overall_elapsed > 0:
    print(f"Rate: {total_created/overall_elapsed:.1f} entities/second")
EOF

echo ""
echo "Test data loaded. You can now trigger reindexing with: ./scripts/trigger-reindex.sh"
