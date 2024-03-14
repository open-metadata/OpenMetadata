"""
Utils used by OpenlineageSource connector.
"""

from functools import reduce
from typing import Dict

from metadata.ingestion.source.pipeline.openlineage.models import OpenLineageEvent


def message_to_open_lineage_event(incoming_event: Dict) -> OpenLineageEvent:
    """
    Method that takes raw Open Lineage event and parses is to shape into OpenLineageEvent.

    We check whether received event (from Kafka) adheres to expected form and contains all the fields that are required
    for successful processing by OpenMetadata OpenLineage connector.

    :param incoming_event: raw event received from kafka topic by OpenlineageSource
    :return: OpenLineageEvent
    """
    fields_to_verify = [
        "run.facets.parent.job.name",
        "run.facets.parent.job.namespace",
        "inputs",
        "outputs",
        "eventType",
        "job.name",
        "job.namespace",
    ]

    for field in fields_to_verify:
        try:
            reduce(lambda x, y: x[y], field.split("."), incoming_event)
        except KeyError:
            raise ValueError("Event malformed!")

    run_facet = incoming_event["run"]
    inputs = incoming_event["inputs"]
    outputs = incoming_event["outputs"]
    event_type = incoming_event["eventType"]
    job = incoming_event["job"]

    result = OpenLineageEvent(
        run_facet=run_facet,
        event_type=event_type,
        job=job,
        inputs=inputs,
        outputs=outputs,
    )

    return result


class FQNNotFoundException(Exception):
    """
    Error raised when, while searching for an entity (Table, DatabaseSchema) there is no match in OM.
    """

    pass
