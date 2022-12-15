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
"""
Mixin class containing Lineage specific methods

To be used by OpenMetadata class
"""
import traceback
from typing import Any, Dict, Optional

from metadata.generated.schema.api.data.createMlModel import CreateMlModelRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.mlmodel import (
    MlFeature,
    MlHyperParameter,
    MlModel,
)
from metadata.generated.schema.entity.services.connections.mlmodel.sklearnConnection import (
    SklearnConnection,
)
from metadata.generated.schema.entity.services.mlmodelService import (
    MlModelConnection,
    MlModelService,
)
from metadata.generated.schema.metadataIngestion.mlmodelServiceMetadataPipeline import (
    MlModelServiceMetadataPipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.metadataIngestion.workflow import SourceConfig
from metadata.generated.schema.type.entityLineage import EntitiesEdge
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.ometa.client import REST
from metadata.ingestion.ometa.mixins.lineage_mixin import OMetaLineageMixin
from metadata.ingestion.ometa.utils import format_name, ometa_logger

logger = ometa_logger()


class OMetaMlModelMixin(OMetaLineageMixin):
    """
    OpenMetadata API methods related to MlModel.

    To be inherited by OpenMetadata
    """

    client: REST

    def add_mlmodel_lineage(self, model: MlModel) -> Dict[str, Any]:
        """
        Iterates over MlModel's Feature Sources and
        add the lineage information.
        :param model: MlModel containing EntityReferences
        :return: List of added lineage information
        """

        # Fetch all informed dataSource values
        refs = [
            source.dataSource
            for feature in model.mlFeatures
            if model.mlFeatures
            for source in feature.featureSources
            if feature.featureSources
            if source.dataSource
        ]

        # Iterate on the references to add lineage
        for entity_ref in refs:
            self.add_lineage(
                AddLineageRequest(
                    description="MlModel uses FeatureSource",
                    edge=EntitiesEdge(
                        fromEntity=entity_ref,
                        toEntity=self.get_entity_reference(
                            entity=MlModel, fqn=model.fullyQualifiedName
                        ),
                    ),
                )
            )

        mlmodel_lineage = self.get_lineage_by_id(MlModel, str(model.id.__root__))

        return mlmodel_lineage

    def get_mlmodel_sklearn(
        self,
        name: str,
        model,
        description: Optional[str] = None,
        service_name: str = "scikit-learn",
    ) -> CreateMlModelRequest:
        """
        Get an MlModel Entity instance from a scikit-learn model.

        Sklearn estimators all extend BaseEstimator.
        :param name: MlModel name
        :param model: sklearn estimator
        :param description: MlModel description
        :param service_name: Service name to use when creating sklearn service
        :return: OpenMetadata CreateMlModelRequest Entity
        """
        try:
            # pylint: disable=import-outside-toplevel
            from sklearn.base import BaseEstimator

            # pylint: enable=import-outside-toplevel
        except ModuleNotFoundError as err:
            logger.debug(traceback.format_exc())
            logger.error(
                "Cannot import BaseEstimator, please install sklearn plugin: "
                "pip install openmetadata-ingestion[sklearn], %s",
                err,
            )
            raise err

        if not isinstance(model, BaseEstimator):
            raise ValueError("Input model is not an instance of sklearn BaseEstimator")

        # Prepare a sklearn source configuration
        source_config = WorkflowSource(
            type="sklearn",
            serviceName=service_name,
            serviceConnection=MlModelConnection(config=SklearnConnection()),
            sourceConfig=SourceConfig(config=MlModelServiceMetadataPipeline()),
        )

        service = self.get_service_or_create(
            entity=MlModelService, config=source_config
        )

        return CreateMlModelRequest(
            name=name,
            description=description,
            algorithm=model.__class__.__name__,
            mlFeatures=[
                MlFeature(name=format_name(feature))
                for feature in model.feature_names_in_
            ],
            mlHyperParameters=[
                MlHyperParameter(
                    name=key,
                    value=value,
                )
                for key, value in model.get_params().items()
            ],
            service=EntityReference(id=service.id, type="mlmodelService"),
        )
