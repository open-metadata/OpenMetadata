#!/bin/bash
# Setup script for Confluent CDC Integration Testing
set -e

echo "==================================================================="
echo "Confluent CDC Integration Test Setup"
echo "==================================================================="

# Wait for services to be ready
echo "Waiting for services to start..."
sleep 30

# Check Kafka Connect is ready
echo "Checking Kafka Connect status..."
until curl -f http://localhost:8083/connectors 2>/dev/null; do
  echo "Waiting for Kafka Connect to be ready..."
  sleep 5
done
echo "✓ Kafka Connect is ready"

# Create MySQL CDC Source Connector
echo ""
echo "Creating MySQL CDC Source Connector..."
curl -X POST http://localhost:8083/connectors \
  -H "Content-Type: application/json" \
  -d '{
    "name": "mysql-source-inventory",
    "config": {
      "connector.class": "io.debezium.connector.mysql.MySqlConnector",
      "database.hostname": "mysql",
      "database.port": "3306",
      "database.user": "debezium",
      "database.password": "dbz",
      "database.server.id": "184054",
      "database.server.name": "dbserver1",
      "database.include.list": "inventory",
      "table.include.list": "inventory.customers,inventory.orders",
      "database.history.kafka.bootstrap.servers": "kafka:29092",
      "database.history.kafka.topic": "schema-changes.inventory",
      "include.schema.changes": "false",
      "transforms": "unwrap",
      "transforms.unwrap.type": "io.debezium.transforms.ExtractNewRecordState",
      "transforms.unwrap.drop.tombstones": "false",
      "key.converter": "io.confluent.connect.avro.AvroConverter",
      "key.converter.schema.registry.url": "http://schema-registry:8081",
      "value.converter": "io.confluent.connect.avro.AvroConverter",
      "value.converter.schema.registry.url": "http://schema-registry:8081"
    }
  }'

echo ""
echo "✓ MySQL CDC Source Connector created"

# Wait for topics to be created
echo ""
echo "Waiting for Kafka topics to be created..."
sleep 10

# Create PostgreSQL Sink Connector
echo ""
echo "Creating PostgreSQL Sink Connector..."
curl -X POST http://localhost:8083/connectors \
  -H "Content-Type: application/json" \
  -d '{
    "name": "postgres-sink-customers",
    "config": {
      "connector.class": "io.confluent.connect.jdbc.JdbcSinkConnector",
      "connection.url": "jdbc:postgresql://postgres:5432/warehouse",
      "connection.user": "postgres",
      "connection.password": "postgres",
      "topics": "dbserver1.inventory.customers",
      "table.name.format": "customers",
      "auto.create": "true",
      "auto.evolve": "true",
      "insert.mode": "upsert",
      "pk.mode": "record_value",
      "pk.fields": "id",
      "delete.enabled": "true",
      "key.converter": "io.confluent.connect.avro.AvroConverter",
      "key.converter.schema.registry.url": "http://schema-registry:8081",
      "value.converter": "io.confluent.connect.avro.AvroConverter",
      "value.converter.schema.registry.url": "http://schema-registry:8081"
    }
  }'

echo ""
echo "✓ PostgreSQL Sink Connector created"

# Create second sink connector for orders
echo ""
echo "Creating PostgreSQL Sink Connector for orders..."
curl -X POST http://localhost:8083/connectors \
  -H "Content-Type: application/json" \
  -d '{
    "name": "postgres-sink-orders",
    "config": {
      "connector.class": "io.confluent.connect.jdbc.JdbcSinkConnector",
      "connection.url": "jdbc:postgresql://postgres:5432/warehouse",
      "connection.user": "postgres",
      "connection.password": "postgres",
      "topics": "dbserver1.inventory.orders",
      "table.name.format": "orders",
      "auto.create": "true",
      "auto.evolve": "true",
      "insert.mode": "upsert",
      "pk.mode": "record_value",
      "pk.fields": "id",
      "delete.enabled": "true",
      "key.converter": "io.confluent.connect.avro.AvroConverter",
      "key.converter.schema.registry.url": "http://schema-registry:8081",
      "value.converter": "io.confluent.connect.avro.AvroConverter",
      "value.converter.schema.registry.url": "http://schema-registry:8081"
    }
  }'

echo ""
echo "✓ PostgreSQL Sink Connector for orders created"

# List all connectors
echo ""
echo "==================================================================="
echo "CDC Connectors Status:"
echo "==================================================================="
curl -s http://localhost:8083/connectors | jq .

echo ""
echo ""
echo "Checking connector status..."
for connector in mysql-source-inventory postgres-sink-customers postgres-sink-orders; do
  echo ""
  echo "Connector: $connector"
  curl -s http://localhost:8083/connectors/$connector/status | jq '.connector.state, .tasks[0].state'
done

echo ""
echo "==================================================================="
echo "Setup Complete!"
echo "==================================================================="
echo ""
echo "Services available at:"
echo "  - MySQL:           localhost:3306 (user: root, password: debezium)"
echo "  - PostgreSQL:      localhost:5432 (user: postgres, password: postgres)"
echo "  - Kafka:           localhost:9092"
echo "  - Schema Registry: localhost:8081"
echo "  - Kafka Connect:   localhost:8083"
echo ""
echo "Sample data in MySQL inventory database:"
echo "  - inventory.customers (id, first_name, last_name, email)"
echo "  - inventory.orders (id, order_date, purchaser, quantity, product_id)"
echo ""
echo "Next steps:"
echo "  1. Ingest MySQL service into OpenMetadata"
echo "  2. Ingest PostgreSQL service into OpenMetadata"
echo "  3. Ingest Kafka service into OpenMetadata"
echo "  4. Run Confluent CDC connector workflow"
echo ""
echo "To test data flow:"
echo "  docker exec -it cdc-mysql mysql -uroot -pdebezium inventory"
echo "  > INSERT INTO customers VALUES (1005, 'John', 'Doe', 'john@example.com');"
echo ""
