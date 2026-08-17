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
"""Custom MlModel connector yielding a deterministic in-memory model."""

from collections.abc import Iterable

from metadata.generated.schema.api.data.createMlModel import CreateMlModelRequest
from metadata.generated.schema.api.services.createMlModelService import (
    CreateMlModelServiceRequest,
)
from metadata.generated.schema.entity.data.mlmodel import (
    FeatureType,
    MlFeature,
    MlHyperParameter,
    MlStore,
)
from metadata.generated.schema.entity.services.connections.mlmodel.customMlModelConnection import (
    CustomMlModelConnection,
)
from metadata.generated.schema.entity.services.mlmodelService import MlModelServiceType
from metadata.generated.schema.metadataIngestion.workflow import Source as WorkflowSource
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException, Source
from metadata.ingestion.ometa.ometa_api import OpenMetadata

MODEL_NAME = "my_churn_classifier"


class CustomMlModelSource(Source):
    """Yields one ML model with described features, hyper parameters and a model store."""

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__()
        self.config = config
        self.metadata = metadata
        self.service_connection = config.serviceConnection.root.config

    @classmethod
    def create(
        cls,
        config_dict: dict,
        metadata: OpenMetadata,
        pipeline_name: str | None = None,
    ) -> "CustomMlModelSource":
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection = config.serviceConnection.root.config
        if not isinstance(connection, CustomMlModelConnection):
            raise InvalidSourceException(f"Expected CustomMlModelConnection, but got {connection}")
        return cls(config, metadata)

    def prepare(self):
        """Nothing to prepare"""

    def test_connection(self) -> None:
        """No external system to reach"""

    def close(self) -> None:
        """Nothing to close"""

    def _iter(self, *_, **__) -> Iterable[Either]:
        service_name = self.config.serviceName
        yield Either(
            right=CreateMlModelServiceRequest(
                name=service_name,
                serviceType=MlModelServiceType.CustomMlModel,
                connection=self.config.serviceConnection.root,
                displayName="Custom MlModel Demo",
                description="Model registry served by the custom mlmodel connector",
            )
        )
        yield Either(
            right=CreateMlModelRequest(
                name=MODEL_NAME,
                displayName="My Churn Classifier",
                description="Model produced by the custom mlmodel connector",
                algorithm="GradientBoostingClassifier",
                service=service_name,
                target="churned",
                mlFeatures=[
                    MlFeature(
                        name="tenure_months",
                        dataType=FeatureType.numerical,
                        description="Months since the account was opened",
                        featureSources=[],
                    ),
                    MlFeature(
                        name="plan_tier",
                        dataType=FeatureType.categorical,
                        description="Subscription tier at scoring time",
                        featureSources=[],
                    ),
                ],
                mlHyperParameters=[
                    MlHyperParameter(
                        name="n_estimators",
                        value="200",
                        description="Number of boosting stages",
                    ),
                    MlHyperParameter(
                        name="max_depth",
                        value="5",
                        description="Maximum depth of each tree",
                    ),
                ],
                mlStore=MlStore(
                    storage="s3://bucket/models/my_churn_classifier",
                    imageRepository="registry.example.com/models",
                ),
                server="https://models.example.com/my_churn_classifier/invocations",
            )
        )
