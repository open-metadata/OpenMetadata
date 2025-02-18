import json
from cassandra.cluster import Cluster
from cassandra.auth import PlainTextAuthProvider
from metadata.generated.schema.entity.data.table import Column, Table
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.schema import Schema
from metadata.generated.schema.entity.data.materializedView import MaterializedView
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.generated.schema.metadataIngestion.workflow import Source as WorkflowSource
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

class CassandraConnector:
    def __init__(self, host='127.0.0.1', port=9042, username=None, password=None, metadata_client=None):
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.cluster = None
        self.session = None
        self.metadata_client = metadata_client or OpenMetadata

    def connect(self):
        """
        Attempts to establish a connection to the Cassandra cluster.
        """
        try:
            if self.username and self.password:
                auth_provider = PlainTextAuthProvider(self.username, self.password)
                self.cluster = Cluster([self.host], port=self.port, auth_provider=auth_provider)
            else:
                self.cluster = Cluster([self.host], port=self.port)

            self.session = self.cluster.connect()
            print("Connected to Cassandra")
        except Exception as error:
            print(f"Error connecting to Cassandra: {error}")
            self.session = None

    def get_keyspaces(self):
        """
        Retrieves all keyspaces in the Cassandra cluster.
        """
        if not self.session:
            print("No active Cassandra session")
            return []

        rows = self.session.execute("SELECT keyspace_name FROM system_schema.keyspaces;")
        return [row.keyspace_name for row in rows]

    def get_tables(self, keyspace):
        """
        Retrieves all tables in a keyspace.
        """
        if not self.session:
            print("No active Cassandra session")
            return []

        query = f"SELECT table_name FROM system_schema.tables WHERE keyspace_name = '{keyspace}';"
        rows = self.session.execute(query)
        return [row.table_name for row in rows]

    def get_table_schema(self, keyspace, table):
        """
        Retrieves schema details for a specific table.
        """
        if not self.session:
            print("No active Cassandra session")
            return {}

        query = f"SELECT column_name, type FROM system_schema.columns WHERE keyspace_name = '{keyspace}' AND table_name = '{table}';"
        rows = self.session.execute(query)

        schema = {}
        for row in rows:
            schema[row.column_name] = row.type

        return schema

    def push_keyspace(self, keyspace_name):
        try:
            keyspace_entity = Database(
                name=keyspace_name,
                description=f"Keyspace {keyspace_name}",
                service=self.metadata_client.config.serviceConnection.root.config,  # Reference the Cassandra service
            )
            self.metadata_client.create_or_update(keyspace_entity)
            logger.info(f"Keyspace {keyspace_name} pushed to OpenMetadata")
        except Exception as e:
            logger.error(f"Error pushing keyspace {keyspace_name} to OpenMetadata: {e}")

    def push_table(self, schema_name, table_name):
        try:
            schema_entity = Schema(name=schema_name)
            table_entity = Table(
                name=table_name,
                description=f"Table {table_name} in schema {schema_name}",
                database=schema_entity,  # Link table to schema
            )
            self.metadata_client.create_or_update(table_entity)
            logger.info(f"Table {table_name} pushed to OpenMetadata under schema {schema_name}")
        except Exception as e:
            logger.error(f"Error pushing table {table_name} to OpenMetadata: {e}")

    def push_column(self, schema_name, table_name, column_name, column_type):
        try:
            schema_entity = Schema(name=schema_name)
            table_entity = Table(name=table_name)
            column_entity = Column(
                name=column_name,
                dataType=column_type,
                description=f"Column {column_name} in table {table_name}",
                table=table_entity,  # Link column to table
            )
            self.metadata_client.create_or_update(column_entity)
            logger.info(f"Column {column_name} pushed to OpenMetadata in table {table_name}")
        except Exception as e:
            logger.error(f"Error pushing column {column_name} to OpenMetadata in table {table_name}: {e}")

    def push_metadata(self):
        """
        Push all metadata to OpenMetadata.
        """
        # Get keyspaces
        keyspaces = self.get_keyspaces()

        for keyspace_name in keyspaces:
            # Push keyspace to OpenMetadata
            self.push_keyspace(keyspace_name)

            # Get tables in the keyspace
            tables = self.get_tables(keyspace_name)
            for table_name in tables:
                # Push table to OpenMetadata
                self.push_table(keyspace_name, table_name)

                # Get columns for the table
                columns = self.get_table_schema(keyspace_name, table_name)
                for column_name, column_type in columns.items():
                    # Push columns to OpenMetadata
                    self.push_column(keyspace_name, table_name, column_name, column_type)

    def disconnect(self):
        """
        Gracefully close the Cassandra connection.
        """
        if self.cluster:
            self.cluster.shutdown()
            print("Disconnected from Cassandra")

    def fetch_and_push_metadata(self):
        """
        Connect to Cassandra, fetch and push metadata to OpenMetadata, then disconnect.
        """
        self.connect()
        self.push_metadata()
        self.disconnect()

