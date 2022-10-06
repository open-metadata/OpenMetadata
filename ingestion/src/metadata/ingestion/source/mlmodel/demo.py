#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""ml flow source module"""

import ast
import json
import traceback
from typing import Iterable, List, Optional, Tuple, cast

from metadata.generated.schema.entity.services.connections.mlmodel.demoConnection import DemoConnection
from mlflow.entities import RunData
from mlflow.entities.model_registry import ModelVersion, RegisteredModel
from pydantic import ValidationError, BaseModel

from metadata.generated.schema.api.data.createMlModel import CreateMlModelRequest
from metadata.generated.schema.entity.data.mlmodel import (
    FeatureType,
    MlFeature,
    MlHyperParameter,
    MlModel,
    MlStore,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.connections.mlmodel.mlflowConnection import (
    MlflowConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.source import InvalidSourceException
from metadata.ingestion.source.mlmodel.mlmodel_service import MlModelServiceSource
from metadata.utils import fqn
from metadata.utils.filters import filter_by_mlmodel
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class DemoModel(BaseModel):
    name: str
    algorithm: str


class DemoSource(MlModelServiceSource):
    """
    Demo source for ML Models
    """

    def _get_ml_store(self, *args, **kwargs) -> Optional[MlStore]:
        """
        This demo model does not have any MLStore available
        """

    def _get_ml_features(self, *args, **kwargs) -> Optional[List[MlFeature]]:
        pass

    def _get_algorithm(self, model: DemoModel) -> str:
        return model.algorithm

    def _get_hyper_params(self, *args, **kwargs) -> Optional[List[MlHyperParameter]]:
        pass

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: DemoConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, DemoConnection):
            raise InvalidSourceException(
                f"Expected DemoConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    def get_mlmodels(self) -> Iterable[DemoModel]:
        """
        List and filters models from the registry
        """
        yield DemoModel(name="first_model", algorithm="GPT3")
        yield DemoModel(name="second_model", algorithm="NN")

    def yield_mlmodel(
        self, model: DemoModel
    ) -> Iterable[CreateMlModelRequest]:
        """
        Prepare the Request model
        """

        yield CreateMlModelRequest(
            name=model.name,
            description="hello",
            algorithm=self._get_algorithm(model=model),
            service=EntityReference(
                id=self.context.mlmodel_service.id, type="mlmodelService"
            ),
        )
