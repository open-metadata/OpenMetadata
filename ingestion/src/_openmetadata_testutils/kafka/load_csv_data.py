"""
pip install confluent_kafka pandas requests avro-python3
"""

import json
import os
from typing import Dict, List

import pandas as pd
import requests
from confluent_kafka import Producer
from confluent_kafka.schema_registry import SchemaRegistryClient
from confluent_kafka.schema_registry.avro import AvroSerializer
from confluent_kafka.serialization import MessageField, SerializationContext


class Kafka:
    def __init__(self, broker: str):
        self.broker = broker

    def get_producer(self):
        return Producer({"bootstrap.servers": self.broker})


class SchemaRegistry:
    def __init__(self, url: str):
        self.url = url

    def register_schema(self, schema: str, topic: str):
        """Register the schema with the Schema Registry"""
        url = f"{self.url}/subjects/{sanitize_name(topic)}-value/versions"
        headers = {"Content-Type": "application/vnd.schemaregistry.v1+json"}
        data = json.dumps({"schema": schema})
        response = requests.post(url, headers=headers, data=data)
        if response.status_code == 200:
            print(f"Schema registered for topic {topic}")
        else:
            print(f"Failed to register schema for topic {topic}: {response.text}")

    def get_avro_serializer(self, schema: str) -> AvroSerializer:
        schema_registry_conf = {"url": self.url}
        schema_registry_client = SchemaRegistryClient(schema_registry_conf)
        return AvroSerializer(schema_registry_client, schema_str=schema)


def delivery_report(err, msg):
    """Called once for each message produced to indicate delivery result.
    Triggered by poll() or flush()."""
    if err is not None:
        print(f"Message delivery failed: {err}")
    else:
        print(f"Message delivered to {msg.topic()} [{msg.partition()}]")


def sanitize_name(name):
    """Sanitize the name to conform to Avro naming rules"""
    return name.replace("-", "_").replace(" ", "_")


def generate_avro_schema(df: pd.DataFrame, topic: str) -> str:
    """Generate an Avro schema from a pandas DataFrame"""
    fields: List[Dict[str, str]] = []
    for column in df.columns:
        fields.append(
            {"name": sanitize_name(column), "type": "string"}
        )  # Assuming all columns are of type string
    schema_dict: Dict[str, any] = {
        "namespace": "example.avro",
        "type": "record",
        "name": sanitize_name(topic),
        "fields": fields,
    }
    return json.dumps(schema_dict)


def send_csv_to_kafka(kafka: Kafka, schema_registry: SchemaRegistry, file_path: str):
    # Read the CSV file
    df = pd.read_csv(file_path)

    # Sanitize column names
    df.columns = [sanitize_name(col) for col in df.columns]

    # Convert all fields to string
    df = df.astype(str)

    # Get the file name without extension to use as the topic name
    topic = os.path.splitext(os.path.basename(file_path))[0]

    # Generate and register the Avro schema
    schema = generate_avro_schema(df, topic)
    schema_registry.register_schema(schema, topic)

    # Create an Avro serializer with the generated schema
    avro_serializer = schema_registry.get_avro_serializer(schema)

    # Create a Kafka producer
    producer = kafka.get_producer()

    # Iterate over the rows of the DataFrame and send each row as an Avro message
    for _, row in df.iterrows():
        message = row.to_dict()
        try:
            producer.produce(
                topic=topic,
                value=avro_serializer(
                    message, SerializationContext(topic, MessageField.VALUE)
                ),
                callback=delivery_report,
            )
        except Exception as e:
            print(f"Message serialization failed: {e}")
            break

    # Wait for any outstanding messages to be delivered and delivery reports to be received
    producer.flush()


def main(kafka_broker: str, schema_registry_url: str, csv_directory: str):
    # Iterate over all files in the directory
    kafka = Kafka(kafka_broker)
    schema_registry = SchemaRegistry(schema_registry_url)
    for file_name in os.listdir(csv_directory):
        if file_name.endswith(".csv"):
            file_path = os.path.join(csv_directory, file_name)
            send_csv_to_kafka(kafka, schema_registry, file_path)


if __name__ == "__main__":
    main(
        kafka_broker="localhost:9092",
        schema_registry_url="http://localhost:8081",
        csv_directory="./data",
    )
