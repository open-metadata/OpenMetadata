#!/bin/bash
# Load test data for distributed indexing testing

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Default values
SERVER_URL="http://localhost:8585"
NUM_TABLES=10000
NUM_DATABASES=10

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --tables)
            NUM_TABLES="$2"
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
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --tables NUM       Number of tables to create (default: 10000)"
            echo "  --databases NUM    Number of databases to distribute tables across (default: 10)"
            echo "  --server URL       Target server URL (default: http://localhost:8585)"
            echo "  -h, --help         Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

echo "======================================"
echo "Loading Test Data"
echo "======================================"
echo "Server: $SERVER_URL"
echo "Tables: $NUM_TABLES"
echo "Databases: $NUM_DATABASES"
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
    service_fqn = resp["fullyQualifiedName"]
    print(f"Service created: {service_fqn}")
else:
    print(f"Failed to create service: {status} - {resp}")
    sys.exit(1)

# Create databases
print(f"Creating {NUM_DATABASES} databases...")
sys.stdout.flush()
database_fqns = []
for i in range(NUM_DATABASES):
    db_data = {"name": f"test_db_{i:04d}", "service": service_fqn}
    status, resp = make_request(f"{SERVER_URL}/api/v1/databases", data=db_data, method="PUT", headers=headers)
    if status in [200, 201] and isinstance(resp, dict):
        database_fqns.append(resp["fullyQualifiedName"])
    if (i + 1) % 10 == 0:
        print(f"  Created {i + 1}/{NUM_DATABASES} databases")
        sys.stdout.flush()

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
    print("ERROR: No schemas created. Cannot continue.")
    sys.exit(1)

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
        if total % 500 == 0 or total == len(tasks):
            elapsed = time.time() - start_time
            rate = total / elapsed if elapsed > 0 else 0
            print(f"  Progress: {total}/{NUM_TABLES} ({rate:.1f}/sec) - Created: {created}, Failed: {failed}")
            sys.stdout.flush()

elapsed = time.time() - start_time
print("")
print("======================================")
print("Test data loading complete!")
print("======================================")
print(f"Created: {created} tables")
print(f"Failed: {failed} tables")
print(f"Time: {elapsed:.1f} seconds")
if elapsed > 0:
    print(f"Rate: {created/elapsed:.1f} tables/second")
EOF

echo ""
echo "Test data loaded. You can now trigger reindexing with: ./scripts/trigger-reindex.sh"
