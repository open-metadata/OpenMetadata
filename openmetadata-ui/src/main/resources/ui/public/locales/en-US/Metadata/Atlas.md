# Atlas

In this section, we provide guides and references to use the Atlas connector.

## Requirements
You can find further information on the Kafka connector in the <a href="https://docs.open-metadata.org/connectors/metadata/atlas" target="_blank">docs</a>.

## Connection Details

$$section
### Username $(id="username")

Username to connect to the Atlas. This user should have privileges to read all the metadata in Atlas.
$$

$$section
### Password $(id="password")

Password to connect to the Atlas.
$$

$$section
### Host Port $(id="hostPort")

Host and port of the Atlas service.
$$

$$section
### Database Service Name $(id="databaseServiceName")

Service Name of the Database Service, present in OpenMetadata, for which metadata will be ingested from Atlas.
$$

$$section
### Messaging Service Name $(id="messagingServiceName")

Service Name of the Messaging Service, present in OpenMetadata, for which metadata will be ingested from Atlas.
$$

$$section
### Entity_type $(id="entity_type")

Name of the Entity Type available in Atlas.
$$

$$section
### Connection Options $(id="connectionOptions")

Additional connection options to build the URL that can be sent to service during the connection.
$$

$$section
### Connection Arguments $(id="connectionArguments")

Additional connection arguments such as security or protocol configs that can be sent to service during connection.
$$
