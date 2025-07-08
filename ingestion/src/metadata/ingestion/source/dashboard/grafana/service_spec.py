from metadata.ingestion.source.dashboard.grafana.metadata import GrafanaSource
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=GrafanaSource)
