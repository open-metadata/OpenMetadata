# MLflow

In this section, we provide guides and references to use the MLflow connector. You can view the full documentation for MLflow [here](https://docs.open-metadata.org/connectors/ml-model/mlflow).

## Requirements
To extract metadata, OpenMetadata needs two elements:
- **Tracking URI**: Address of local or remote tracking server. More information can be found in the MLFlow documentation [here](https://www.mlflow.org/docs/latest/tracking.html#where-runs-are-recorded)
- **Registry URI**: Address of local or remote model registry server.

You can find further information on the MLflow connector in the [docs](https://docs.open-metadata.org/connectors/ml-model/mlflow).

## Connection Details

$$section
### Tracking URI $(id="trackingUri")
Mlflow Experiment tracking URI. E.g., `http://localhost:5000`
$$

$$section
### Registry URI $(id="registryUri")
Mlflow Model registry backend. E.g., `mysql+pymysql://mlflow:password@localhost:3307/experiments`
$$
