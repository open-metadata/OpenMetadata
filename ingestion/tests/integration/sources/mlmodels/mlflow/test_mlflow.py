#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""mlflow integration tests"""
import os
import sys
from urllib.parse import urlparse

import mlflow
import mlflow.sklearn
import numpy as np
import pandas as pd
import pytest
from mlflow.models import infer_signature
from sklearn.linear_model import ElasticNet
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split

from metadata.generated.schema.api.services.createMlModelService import (
    CreateMlModelServiceRequest,
)
from metadata.generated.schema.entity.data.mlmodel import MlModel
from metadata.generated.schema.entity.services.connections.mlmodel.mlflowConnection import (
    MlflowConnection,
)
from metadata.generated.schema.entity.services.mlmodelService import (
    MlModelConnection,
    MlModelService,
    MlModelServiceType,
)
from metadata.generated.schema.metadataIngestion.mlmodelServiceMetadataPipeline import (
    MlModelServiceMetadataPipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
    Sink,
    Source,
    SourceConfig,
    WorkflowConfig,
)
from metadata.workflow.metadata import MetadataWorkflow

MODEL_HYPERPARAMS = {
    "alpha": {"name": "alpha", "value": "0.5", "description": None},
    "l1_ratio": {"name": "l1_ratio", "value": "1.0", "description": None},
}

MODEL_NAME = "ElasticnetWineModel"

SERVICE_NAME = "docker_test_mlflow"


def eval_metrics(actual, pred):
    rmse = np.sqrt(mean_squared_error(actual, pred))
    mae = mean_absolute_error(actual, pred)
    r2 = r2_score(actual, pred)
    return rmse, mae, r2


@pytest.fixture(scope="module")
def create_data(mlflow_environment):
    mlflow_uri = f"http://localhost:{mlflow_environment.mlflow_configs.exposed_port}"
    mlflow.set_tracking_uri(mlflow_uri)

    os.environ["AWS_ACCESS_KEY_ID"] = "minio"
    os.environ["AWS_SECRET_ACCESS_KEY"] = "password"
    os.environ[
        "MLFLOW_S3_ENDPOINT_URL"
    ] = f"http://localhost:{mlflow_environment.minio_configs.exposed_port}"

    np.random.seed(40)

    # Read the wine-quality csv file from the URL
    csv_url = "https://raw.githubusercontent.com/open-metadata/openmetadata-demo/main/resources/winequality-red.csv"
    data = pd.read_csv(csv_url, sep=";")

    # Split the data into training and test sets. (0.75, 0.25) split.
    train, test = train_test_split(data)

    # The predicted column is "quality" which is a scalar from [3, 9]
    train_x = train.drop(["quality"], axis=1)
    test_x = test.drop(["quality"], axis=1)
    train_y = train[["quality"]]
    test_y = test[["quality"]]

    alpha = float(MODEL_HYPERPARAMS["alpha"]["value"])
    l1_ratio = float(MODEL_HYPERPARAMS["l1_ratio"]["value"])

    with mlflow.start_run():
        lr = ElasticNet(alpha=alpha, l1_ratio=l1_ratio, random_state=42)
        lr.fit(train_x, train_y)

        signature = infer_signature(train_x, lr.predict(train_x))

        predicted_qualities = lr.predict(test_x)

        (rmse, mae, r2) = eval_metrics(test_y, predicted_qualities)

        mlflow.log_param("alpha", alpha)
        mlflow.log_param("l1_ratio", l1_ratio)
        mlflow.log_metric("rmse", rmse)
        mlflow.log_metric("r2", r2)
        mlflow.log_metric("mae", mae)

        tracking_url_type_store = urlparse(mlflow.get_tracking_uri()).scheme

        # Model registry does not work with file store
        if tracking_url_type_store != "file":
            # Register the model
            # There are other ways to use the Model Registry, which depends on the use case,
            # please refer to the doc for more information:
            # https://mlflow.org/docs/latest/model-registry.html#api-workflow
            mlflow.sklearn.log_model(
                lr,
                "model",
                registered_model_name=MODEL_NAME,
                signature=signature,
            )
        else:
            mlflow.sklearn.log_model(lr, "model")


@pytest.fixture(scope="module")
def service(metadata, mlflow_environment):
    service = CreateMlModelServiceRequest(
        name=SERVICE_NAME,
        serviceType=MlModelServiceType.Mlflow,
        connection=MlModelConnection(
            config=MlflowConnection(
                type="Mlflow",
                trackingUri=f"http://localhost:{mlflow_environment.mlflow_configs.exposed_port}",
                registryUri=f"mysql+pymysql://mlflow:password@localhost:{mlflow_environment.mysql_configs.exposed_port}/experiments",
            )
        ),
    )

    service_entity = metadata.create_or_update(data=service)
    yield service_entity
    metadata.delete(MlModelService, service_entity.id, recursive=True, hard_delete=True)


@pytest.fixture(scope="module")
def ingest_mlflow(metadata, service, create_data):
    workflow_config = OpenMetadataWorkflowConfig(
        source=Source(
            type=service.connection.config.type.value.lower(),
            serviceName=service.fullyQualifiedName.root,
            serviceConnection=service.connection,
            sourceConfig=SourceConfig(config=MlModelServiceMetadataPipeline()),
        ),
        sink=Sink(type="metadata-rest", config={}),
        workflowConfig=WorkflowConfig(openMetadataServerConfig=metadata.config),
    )

    metadata_ingestion = MetadataWorkflow.create(workflow_config)
    metadata_ingestion.execute()
    return


@pytest.mark.skipif(
    sys.version_info < (3, 9),
    reason="testcontainers Network feature requires python3.9 or higher",
)
def test_mlflow(ingest_mlflow, metadata):
    ml_models = metadata.list_all_entities(entity=MlModel)

    # Check we only get the same amount of models we should have ingested
    filtered_ml_models = [
        ml_model for ml_model in ml_models if ml_model.service.name == SERVICE_NAME
    ]

    assert len(filtered_ml_models) == 1

    # Assert inner information about the model
    model = filtered_ml_models[0]

    # Assert name is as expected
    assert model.name.root == MODEL_NAME

    # Assert HyperParameters are as expected
    assert len(model.mlHyperParameters) == 2

    for i, hp in enumerate(MODEL_HYPERPARAMS.values()):
        assert model.mlHyperParameters[i].name == hp["name"]
        assert model.mlHyperParameters[i].value == hp["value"]
        assert model.mlHyperParameters[i].description == hp["description"]

    # Assert MLStore is as expected
    assert "mlops.local.com" in model.mlStore.storage
