# Amundsen

In this section, we provide guides and references to use the Amundsen connector.

# Requirements
For Connecting to Amundsen, need to make sure to pass `hostPort` with prefix such as:
    1. `bolt`(`Recommended`)
    2. `neo4j`
    3. `neo4j+ssc`

You can find further information on the Amundsen connector in the [docs](https://docs.open-metadata.org/connectors/metadata/amundsen).

## Connection Details

### Username $(id="username")

Username to connect to the Amundsen Neo4j Connection.

### Password $(id="password")

Password to connect to the Amundsen Neo4j Connection.

### Host Port $(id="hostPort")

Host and port of the Amundsen Neo4j Connection. This expect a URI format like: `bolt://localhost:7687`.

### Max Connection Life Time $(id="maxConnectionLifeTime")

Maximum connection lifetime for the Amundsen Neo4j Connection.

### Validate SSL $(id="validateSSL")

Enable SSL validation for the Amundsen Neo4j Connection.

### Encrypted $(id="encrypted")

Enable encryption for the Amundsen Neo4j Connection.

