# REST API Service

REST Connection Config

$$section
### Open API Schema URL $(id="openAPISchemaURL")

Open API Schema URL.
$$

$$section
### Token $(id="token")

Generated Token to connect to OpenAPI Schema.
$$

$$section
### Ingestion with API Services

Currently, ingestion is not supported for API services. However, you can manually add collections and endpoints using the provided APIs. 

- `POST /api/v1/apiCollections` [create collection](/docs#post-/v1/apiCollections)

- `POST /api/v1/apiEndpoints` [create endpoint](/docs#post-/v1/apiEndpoints)
$$