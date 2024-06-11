"""
Utils used by OpenlineageSource connector.
"""

from functools import reduce
from typing import Dict

from metadata.generated.schema.entity.data.table import DataType
from metadata.ingestion.source.pipeline.openlineage.models import OpenLineageEvent
from metadata.utils.logger import ometa_logger

logger = ometa_logger()


def message_to_open_lineage_event(incoming_event: Dict) -> OpenLineageEvent:
    """
    Method that takes raw Open Lineage event and parses is to shape into OpenLineageEvent.

    We check whether received event (from Kafka) adheres to expected form and contains all the fields that are required
    for successful processing by OpenMetadata OpenLineage connector.

    :param incoming_event: raw event received from kafka topic by OpenlineageSource
    :return: OpenLineageEvent
    """
    fields_to_verify = [
        "inputs",
        "outputs",
        "eventType",
        "job.name",
        "job.namespace",
    ]
    try:
        for field in fields_to_verify:
            reduce(lambda x, y: x[y], field.split("."), incoming_event)

        run_facet = incoming_event["run"]
        inputs = incoming_event["inputs"]
        outputs = incoming_event["outputs"]
        event_type = incoming_event["eventType"]
        job = incoming_event["job"]

    except KeyError:
        raise ValueError("Event malformed!")

    result = OpenLineageEvent(
        run_facet=run_facet,
        event_type=event_type,
        job=job,
        inputs=inputs,
        outputs=outputs,
    )

    logger.debug(f"Created OpenLineageEvent: {result}")

    return result


def sanitize_data_type(input_data_type: str) -> DataType:
    types = sorted([x for x in DataType], key=lambda x: -len(x.value))

    for t in types:
        if input_data_type.upper().startswith(t.value):
            return t

    return DataType.UNKNOWN


class FQNNotFoundException(Exception):
    """
    Error raised when, while searching for an entity (Table, DatabaseSchema) there is no match in OM.
    """

    pass
