# Neo4j
In this section, we provide guides and references to use the Neo4j connector.

The connector reads the graph schema of one Neo4j database and maps it onto the OpenMetadata database hierarchy:
```
Database Service > Database > Schema > Table
```
- **Database**: the Neo4j database.
- **Schema**: `nodes` for node labels and `relationships` for relationship types.
- **Table**: one per node label or relationship type, with its properties as columns.

## Requirements
The user needs `ACCESS` on the database and permission to execute the `db.info`, `db.labels`, `db.relationshipTypes`, `db.schema.nodeTypeProperties` and `db.schema.relTypeProperties` procedures. The built-in `reader` role is enough. No node or relationship data is read beyond what the schema procedures return.

## Connection Details

$$section
### Connection Scheme $(id="scheme")
The Neo4j driver URI scheme. Use `neo4j` for a routed connection to a cluster or single server, or `bolt` for a direct connection to one server. Add `+s` to encrypt with full certificate validation, or `+ssc` to encrypt and accept a self-signed certificate.

Neo4j Aura requires `neo4j+s`.
$$

$$section
### Host and Port $(id="hostPort")
Host and port of the Neo4j server, for example `localhost:7687`. The port can be omitted to use the Bolt default, `7687`.

If you are running the OpenMetadata ingestion in a docker and your services are hosted on the `localhost`, then use `host.docker.internal:7687` as the value.
$$

$$section
### Username $(id="username")
Username to connect to Neo4j. The user needs read access to the graph schema of the database.
$$

$$section
### Password $(id="password")
Password to connect to Neo4j.
$$

$$section
### Database Name $(id="databaseName")
The Neo4j database to extract metadata from. If left blank, the user's home database is used.
$$

$$section
### Include Relationships $(id="includeRelationships")
Also ingest relationship types as tables in the `relationships` schema, with their properties as columns. Enabled by default.
$$

$$section
### Property Filter Pattern $(id="propertyFilterPattern")
Regex to only include or exclude node and relationship properties (columns). Useful to drop properties written back by graph algorithms, for example excluding `louvain.*` or `communityId`.
$$
