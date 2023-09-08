# ElasticSearch

In this section, we provide guides and references to use the ElasticSearch connector. You can view the full documentation for ElasticSearch [here](https://docs.open-metadata.org/connectors/search/elasticsearch).

## Requirements

We extract ElasticSearch's metadata by using its [API](https://www.elastic.co/guide/en/elasticsearch/reference/current/rest-apis.html). To run this ingestion, you just need a user with permissions to the ElasticSearch instance.

You can find further information on the ElasticSearch connector in the [docs](https://docs.open-metadata.org/connectors/search/elasticsearch).

## Connection Details

$$section
### Host and Port $(id="hostPort")

This parameter specifies the host and port of the ElasticSearch instance. This should be specified as a string in the format `hostname:port`. For example, you might set the hostPort parameter to `localhost:9200`.

If you are running the OpenMetadata ingestion in a docker and your services are hosted on the `localhost`, then use `host.docker.internal:9200` as the value.
$$

$$section
### Username $(id="username")
Username to connect to ElasticSearch required when Basic Authentication is enabled on ElasticSearch.
$$

$$section
### Password $(id="password")
Password of the user account to connect with ElasticSearch.
$$
