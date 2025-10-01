# Flink
In this section, we provide guides and references to use the Apache Flink connector.

## Requirements

OpenMetadata is integrated with flink up to version <a href="https://nightlies.apache.org/flink/flink-docs-master/docs/dev/table/sql/gettingstarted/" target="_blank">1.19.0</a> and will continue to work for future flink versions.

The ingestion framework uses flink REST APIs to connect to the instance and perform the API calls

## Connection Details
$$section
### Host and Port $(id="hostPort")
Pipeline Service Management URI. This should be specified as a URI string in the format `scheme://hostname:port`. E.g., `http://localhost:8083`, `http://host.docker.internal:8083`.
$$

$$section
### Flink Connection Config $(id="FlinkConnectionConfig")
OpenMetadata supports SSL config.
`Optional`.
$$


$$section
### Verify SSL $(id="verifySSL")
Whether SSL verification should be performed when authenticating.
$$
