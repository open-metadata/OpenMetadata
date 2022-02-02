"""
Mixin class containing Lineage specific methods

To be used by OpenMetadata class
"""
import logging
from typing import Any, Dict, Optional

from metadata.generated.schema.api.data.createMlModel import CreateMlModelRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.mlmodel import (
    MlFeature,
    MlHyperParameter,
    MlModel,
)
from metadata.generated.schema.type.entityLineage import EntitiesEdge
from metadata.ingestion.ometa.client import REST
from metadata.ingestion.ometa.mixins.lineage_mixin import OMetaLineageMixin
from metadata.ingestion.ometa.utils import format_name

logger = logging.getLogger(__name__)


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
                        fromEntity=self.get_entity_reference(
                            entity=MlModel, fqdn=model.fullyQualifiedName
                        ),
                        toEntity=entity_ref,
                    ),
                )
            )

        mlmodel_lineage = self.get_lineage_by_id(MlModel, str(model.id.__root__))

        return mlmodel_lineage

    @staticmethod
    def get_mlmodel_sklearn(
        name: str, model, description: Optional[str] = None
    ) -> CreateMlModelRequest:
        """
        Get an MlModel Entity instance from a scikit-learn model.

        Sklearn estimators all extend BaseEstimator.
        :param name: MlModel name
        :param model: sklearn estimator
        :param description: MlModel description
        :return: OpenMetadata CreateMlModelRequest Entity
        """
        try:
            # pylint: disable=import-outside-toplevel
            from sklearn.base import BaseEstimator

            # pylint: enable=import-outside-toplevel
        except ModuleNotFoundError as exc:
            logger.error(
                "Cannot import BaseEstimator, please install sklearn plugin: "
                "pip install openmetadata-ingestion[sklearn], %s",
                exc,
            )
            raise exc

        if not isinstance(model, BaseEstimator):
            raise ValueError("Input model is not an instance of sklearn BaseEstimator")

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
        )
