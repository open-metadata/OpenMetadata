"""
Utils used by OpenlineageSource connector.
"""
from typing import Dict

from pydantic.error_wrappers import ValidationError

from metadata.ingestion.source.pipeline.openlineage.models import OpenLineageEvent


def message_to_open_lineage_event(incoming_event: Dict) -> OpenLineageEvent:
    """
    Method that takes raw Open Lineage event and parses is to shape into OpenLineageEvent.

    We check whether received event (from Kafka) adheres to expected form and contains all the fields that are required
    for successful processing by OpenMetadata OpenLineage connector.

    :param incoming_event: raw event received from kafka topic by OpenlineageSource
    :return: OpenLineageEvent
    """
    try:
        return OpenLineageEvent(**incoming_event)
    except ValidationError:
        raise ValueError(f"Event malformed! {incoming_event}")


class FQNNotFoundException(Exception):
    """
    Error raised when, while searching for an entity (Table, DatabaseSchema) there is no match in OM.
    """

    pass
