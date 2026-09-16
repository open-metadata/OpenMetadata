from metadata.ingestion.source.storage.gcs.connection import GcsConnection
from metadata.ingestion.source.storage.gcs.metadata import GcsSource
from metadata.sampler.storage.gcs.sampler import GCSSampler
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=GcsSource, sampler_class=GCSSampler, connection_class=GcsConnection)  # pyright: ignore[reportArgumentType]
