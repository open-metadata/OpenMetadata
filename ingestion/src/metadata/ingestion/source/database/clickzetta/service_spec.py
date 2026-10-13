"""ClickZetta service specification."""

from metadata.ingestion.source.database.clickzetta.connection import (
    ClickzettaConnection,
)
from metadata.ingestion.source.database.clickzetta.data_diff.table_parameter import (
    ClickzettaTableParameter,
)
from metadata.ingestion.source.database.clickzetta.lineage import (
    ClickzettaLineageSource,
)
from metadata.ingestion.source.database.clickzetta.metadata import (
    ClickzettaSource,
)
from metadata.ingestion.source.database.clickzetta.usage import (
    ClickzettaUsageSource,
)
from metadata.sampler.sqlalchemy.clickzetta.sampler import ClickzettaSampler
from metadata.utils.importer import get_class_path
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=get_class_path(ClickzettaSource),
    lineage_source_class=get_class_path(ClickzettaLineageSource),
    usage_source_class=get_class_path(ClickzettaUsageSource),
    connection_class=get_class_path(ClickzettaConnection),
    sampler_class=get_class_path(ClickzettaSampler),
    data_diff=get_class_path(ClickzettaTableParameter),
)
