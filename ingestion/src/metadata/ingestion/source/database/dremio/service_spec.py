# Derived from https://github.com/TIKI-Institut/openmetadata-dremio-connector
# Copyright TIKI GmbH, licensed under the Apache License, Version 2.0.
# Imported unchanged as the starting point of the Dremio connector; see the
# following commits for the adaptations made to it.


from metadata.ingestion.source.database.dremio.connection import DremioConnection
from metadata.ingestion.source.database.dremio.metadata import DremioSource
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=DremioSource,
    connection_class=DremioConnection,
)
