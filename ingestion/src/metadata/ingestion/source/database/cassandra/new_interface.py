import json
from cassandra.cluster import Cluster
from cassandra.auth import PlainTextAuthProvider

class CassandraConnector:
    def __init__(self, host='127.0.0.1', port=9042, username=None, password=None):
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.cluster = None
        self.session = None

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

    def get_metadata(self):
        """
        Retrieves metadata for all keyspaces and tables,
         then formats it for OpenMetadata.
        """
        if not self.session:
            print("No active Cassandra session")
            return {}

        metadata = {
            "databaseService": "cassandra",
            "databases": []
        }

        # Get keyspaces (each keyspace is a database)
        keyspaces = self.get_keyspaces()

        for keyspace_name in keyspaces:
            keyspace_metadata = {
                "name": keyspace_name,
                "tables": []
            }

            # Get tables in the keyspace
            tables = self.get_tables(keyspace_name)

            for table_name in tables:
                table_metadata = {
                    "name": table_name,
                    "columns": []
                }

                # Get columns and their types
                columns = self.session.execute(f"""
                    SELECT column_name, type 
                    FROM system_schema.columns 
                    WHERE keyspace_name = '{keyspace_name}' AND table_name = '{table_name}';
                """)

                for column in columns:
                    column_metadata = {
                        "name": column.column_name,
                        "dataType": column.type
                    }
                    table_metadata["columns"].append(column_metadata)

                keyspace_metadata["tables"].append(table_metadata)

            metadata["databases"].append(keyspace_metadata)

        return metadata

    def disconnect(self):
        """
        Gracefully close the Cassandra connection.
        """
        if self.cluster:
            self.cluster.shutdown()
            print("Disconnected from Cassandra")

    def fetch_and_format_metadata(self):
        """
        Connect, fetch metadata, format it, and disconnect.
        """
        self.connect()
        formatted_metadata = self.get_metadata()
        self.disconnect()
        return json.dumps(formatted_metadata, indent=4)


"""
if __name__ == "__main__":
    connector = CassandraConnector(host='127.0.0.1', port=9042)
    metadata = connector.fetch_and_format_metadata()
    print(metadata)
    
"""
