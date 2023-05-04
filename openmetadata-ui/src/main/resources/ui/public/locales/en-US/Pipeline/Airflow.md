# Airflow

In this section, we provide guides and references to use the Airflow connector.

## Requirements

We support different approaches to extracting metadata from Airflow:
1. **Airflow Connector**: which we will configure in this section and requires access to the underlying database.
2. **Airflow Lineage Backend**: which can be configured in your Airflow instance. You can read more about the Lineage Backend [here](https://docs.open-metadata.org/connectors/pipeline/airflow/lineage-backend).
3. **Airflow Lineage Operator**: To send metadata directly from your Airflow DAGs. You can read more about the Lineage Operator [here](https://docs.open-metadata.org/connectors/pipeline/airflow/lineage-operator).

You can find further information on the Kafka connector in the [docs](https://docs.open-metadata.org/connectors/pipeline/airflow).

## Connection Details

$$section
### Host and Port $(id="hostPort")

Pipeline Service Management URI. This should be specified as a URI string in the format `scheme://hostname:port`. E.g., `http://localhost:8080`, `http://host.docker.internal:8080`.

$$

$$section
### Number Of Status $(id="numberOfStatus")

Number of past task status to read every time the ingestion runs. By default, we will pick up and update the last 10 runs.
$$

$$section
### Metadata Database Connection $(id="connection")

Select your underlying database connection. We support the [official](https://airflow.apache.org/docs/apache-airflow/stable/howto/set-up-database.html) backends from Airflow.

Note that the **Backend Connection** is only used to extract metadata from a DAG running directly in your instance, for example to get the metadata out of [GCS Composer](https://docs.open-metadata.org/connectors/pipeline/airflow/gcs).

$$

$$section
### Connection Options $(id="connectionOptions")
Additional connection options to build the URL that can be sent to the service during the connection.

$$

$$section
### Connection Arguments $(id="connectionArguments")
Additional connection arguments such as security or protocol configs that can be sent to the service during connection.

$$
