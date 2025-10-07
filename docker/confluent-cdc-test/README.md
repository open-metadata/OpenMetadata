# Confluent CDC Integration Testing

This directory contains a complete setup for testing the Confluent CDC connector with real services.

## Quick Start

### 1. Start All Services

```bash
cd docker/confluent-cdc-test
docker-compose up -d
```

This starts:
- MySQL (source database with sample data)
- PostgreSQL (target database)
- Kafka + Zookeeper
- Schema Registry
- Kafka Connect with Debezium

### 2. Setup CDC Connectors

```bash
./setup-cdc.sh
```

This creates:
- MySQL CDC source connector (Debezium)
- PostgreSQL sink connector for customers table
- PostgreSQL sink connector for orders table

### 3. Verify CDC is Working

```bash
# Check connector status
curl http://localhost:8083/connectors | jq .

# Check specific connector
curl http://localhost:8083/connectors/mysql-source-inventory/status | jq .

# List Kafka topics
docker exec -it cdc-kafka kafka-topics --bootstrap-server localhost:9092 --list

# Consume from a topic to see CDC events
docker exec -it cdc-kafka kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic dbserver1.inventory.customers \
  --from-beginning \
  --max-messages 5
```

### 4. Ingest Services into OpenMetadata

Create workflow files for each service:

#### MySQL Workflow (`mysql-source.yaml`)

```yaml
source:
  type: mysql
  serviceName: mysql_cdc_source
  serviceConnection:
    config:
      type: Mysql
      hostPort: localhost:3306
      username: root
      password: debezium
      databaseSchema: inventory
  sourceConfig:
    config:
      type: DatabaseMetadata
      schemaFilterPattern:
        includes:
          - inventory

sink:
  type: metadata-rest
  config: {}

workflowConfig:
  openMetadataServerConfig:
    hostPort: http://localhost:8585/api
    authProvider: openmetadata
    securityConfig:
      jwtToken: <your-token>
```

Run:
```bash
metadata ingest -c mysql-source.yaml
```

#### PostgreSQL Workflow (`postgres-target.yaml`)

```yaml
source:
  type: postgres
  serviceName: postgres_cdc_target
  serviceConnection:
    config:
      type: Postgres
      hostPort: localhost:5432
      username: postgres
      password: postgres
      database: warehouse
  sourceConfig:
    config:
      type: DatabaseMetadata
      schemaFilterPattern:
        includes:
          - public

sink:
  type: metadata-rest
  config: {}

workflowConfig:
  openMetadataServerConfig:
    hostPort: http://localhost:8585/api
    authProvider: openmetadata
    securityConfig:
      jwtToken: <your-token>
```

Run:
```bash
metadata ingest -c postgres-target.yaml
```

#### Kafka Workflow (`kafka-messaging.yaml`)

```yaml
source:
  type: kafka
  serviceName: kafka_cdc_broker
  serviceConnection:
    config:
      type: Kafka
      bootstrapServers: localhost:9092
      schemaRegistryURL: http://localhost:8081
  sourceConfig:
    config:
      type: MessagingMetadata
      topicFilterPattern:
        includes:
          - "dbserver1.*"

sink:
  type: metadata-rest
  config: {}

workflowConfig:
  openMetadataServerConfig:
    hostPort: http://localhost:8585/api
    authProvider: openmetadata
    securityConfig:
      jwtToken: <your-token>
```

Run:
```bash
metadata ingest -c kafka-messaging.yaml
```

### 5. Run Confluent CDC Workflow

Create `confluent-cdc-test.yaml`:

```yaml
source:
  type: confluentcdc
  serviceName: cdc_pipeline_test
  serviceConnection:
    config:
      type: ConfluentCDC
      hostPort: http://localhost:8083
      verifySSL: false
  sourceConfig:
    config:
      type: PipelineMetadata

sink:
  type: metadata-rest
  config: {}

workflowConfig:
  loggerLevel: DEBUG
  openMetadataServerConfig:
    hostPort: http://localhost:8585/api
    authProvider: openmetadata
    securityConfig:
      jwtToken: <your-token>
```

Run:
```bash
metadata ingest -c confluent-cdc-test.yaml
```

### 6. Verify in OpenMetadata UI

1. Go to http://localhost:8585
2. Navigate to **Pipeline Services** → `cdc_pipeline_test`
3. You should see 3 pipelines:
   - `mysql-source-inventory`
   - `postgres-sink-customers`
   - `postgres-sink-orders`

4. Click on any pipeline and go to **Lineage** tab
5. You should see:
   - **Entity Lineage**: MySQL table → Kafka topic → PostgreSQL table
   - **Column Lineage**: Individual column mappings

## Testing Data Flow

### Insert Test Data

```bash
# Connect to MySQL
docker exec -it cdc-mysql mysql -uroot -pdebezium inventory

# Insert new customer
INSERT INTO customers VALUES (1005, 'Jane', 'Smith', 'jane@example.com');

# Insert new order
INSERT INTO orders VALUES (10005, '2024-01-15', 1005, 2, 102);

# Exit MySQL
exit
```

### Verify Data Propagation

```bash
# Check Kafka topic
docker exec -it cdc-kafka kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic dbserver1.inventory.customers \
  --from-beginning \
  --max-messages 1

# Check PostgreSQL
docker exec -it cdc-postgres psql -U postgres -d warehouse

warehouse=# SELECT * FROM customers WHERE id = 1005;
warehouse=# SELECT * FROM orders WHERE id = 10005;
warehouse=# \q
```

## Sample Data

The MySQL `inventory` database includes sample data:

### Customers Table
```sql
CREATE TABLE customers (
  id INTEGER NOT NULL AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE
);

-- Sample data
INSERT INTO customers VALUES
  (1001, 'Sally', 'Thomas', 'sally.thomas@acme.com'),
  (1002, 'George', 'Bailey', 'gbailey@foobar.com'),
  (1003, 'Edward', 'Walker', 'ed@walker.com'),
  (1004, 'Anne', 'Kretchmar', 'annek@noanswer.org');
```

### Orders Table
```sql
CREATE TABLE orders (
  id INTEGER NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_date DATE NOT NULL,
  purchaser INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  product_id INTEGER NOT NULL
);

-- Sample data
INSERT INTO orders VALUES
  (10001, '2016-01-16', 1001, 1, 102),
  (10002, '2016-01-17', 1002, 2, 105),
  (10003, '2016-02-19', 1002, 2, 106),
  (10004, '2016-02-21', 1003, 1, 107);
```

## Expected Column-Level Lineage

### Customers Table

```
mysql_cdc_source.inventory.customers.id
  → kafka_cdc_broker.dbserver1.inventory.customers.id
    → postgres_cdc_target.warehouse.public.customers.id

mysql_cdc_source.inventory.customers.first_name
  → kafka_cdc_broker.dbserver1.inventory.customers.first_name
    → postgres_cdc_target.warehouse.public.customers.first_name

mysql_cdc_source.inventory.customers.last_name
  → kafka_cdc_broker.dbserver1.inventory.customers.last_name
    → postgres_cdc_target.warehouse.public.customers.last_name

mysql_cdc_source.inventory.customers.email
  → kafka_cdc_broker.dbserver1.inventory.customers.email
    → postgres_cdc_target.warehouse.public.customers.email
```

## Troubleshooting

### Connector Not Starting

```bash
# Check connector status
curl http://localhost:8083/connectors/mysql-source-inventory/status | jq .

# Check logs
docker logs cdc-kafka-connect

# Restart connector
curl -X POST http://localhost:8083/connectors/mysql-source-inventory/restart
```

### No Data in PostgreSQL

```bash
# Check if Kafka topics exist
docker exec -it cdc-kafka kafka-topics --bootstrap-server localhost:9092 --list

# Check topic has data
docker exec -it cdc-kafka kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic dbserver1.inventory.customers \
  --from-beginning --max-messages 1

# Check sink connector status
curl http://localhost:8083/connectors/postgres-sink-customers/status | jq .
```

### Schema Registry Issues

```bash
# List all schemas
curl http://localhost:8081/subjects

# Get specific schema
curl http://localhost:8081/subjects/dbserver1.inventory.customers-value/versions/latest | jq .
```

## Cleanup

```bash
# Stop all services
docker-compose down

# Remove volumes (WARNING: deletes all data)
docker-compose down -v

# Remove specific connector
curl -X DELETE http://localhost:8083/connectors/mysql-source-inventory
```

## Advanced Testing

### Test Column Transformations

Add SMTs (Single Message Transforms) to test column mapping:

```bash
curl -X PUT http://localhost:8083/connectors/mysql-source-inventory/config \
  -H "Content-Type: application/json" \
  -d '{
    "transforms": "unwrap,renameField",
    "transforms.unwrap.type": "io.debezium.transforms.ExtractNewRecordState",
    "transforms.renameField.type": "org.apache.kafka.connect.transforms.ReplaceField$Value",
    "transforms.renameField.renames": "first_name:fname,last_name:lname"
  }'
```

This will test if column-level lineage handles renamed fields correctly.

### Monitor Performance

```bash
# Check connector metrics
curl http://localhost:8083/connectors/mysql-source-inventory/status | jq '.tasks[0].worker_id'

# Monitor Kafka lag
docker exec -it cdc-kafka kafka-consumer-groups --bootstrap-server localhost:9092 --describe --group connect-postgres-sink-customers
```

## Architecture Diagram

```
┌─────────────┐     CDC      ┌──────────────┐    Consume    ┌──────────────┐
│   MySQL     │────────────> │    Kafka     │─────────────> │  PostgreSQL  │
│  inventory  │   Debezium   │   Topics     │  JDBC Sink    │   warehouse  │
└─────────────┘              └──────────────┘               └──────────────┘
      │                             │                              │
      │                             │                              │
      └─────────────────────────────┴──────────────────────────────┘
                                    │
                              OpenMetadata
                           (Column-level lineage)
```
