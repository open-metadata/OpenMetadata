"""
Mixin class containing Lineage specific methods

To be used by OpenMetadata class
"""
import logging
from typing import Any, Dict

from metadata.generated.schema.api.lineage.addLineage import AddLineage
from metadata.generated.schema.entity.data.mlmodel import MlModel
from metadata.generated.schema.type.entityLineage import EntitiesEdge
from metadata.ingestion.ometa.client import REST
from metadata.ingestion.ometa.mixins.lineage_mixin import OMetaLineageMixin

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
                AddLineage(
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
