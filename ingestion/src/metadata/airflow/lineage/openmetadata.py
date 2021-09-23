import json
from typing import TYPE_CHECKING, Dict, List, Optional

from airflow.configuration import conf
from airflow.lineage.backend import LineageBackend

from airflow.models.baseoperator import BaseOperator

from metadata.config.common import ConfigModel


class OpenMetadataLineageConfig(ConfigModel):
    openmetadata_conn_id: str = "openmetadata_api_default"


def get_lineage_config() -> OpenMetadataLineageConfig:
    """Load the lineage config from airflow.cfg."""

    openmetadata_conn_id = conf.get("lineage", "openmetadata_conn_id", fallback=None)
    return OpenMetadataLineageConfig.parse_obj({'openmetadata_conn_id': openmetadata_conn_id})


class OpenMetadataLineageBackend(LineageBackend):
    """
        Sends lineage data from tasks to OpenMetadata.
        Configurable via ``airflow.cfg`` as follows: ::
            # For REST-based:
            airflow connections add  --conn-type 'openmetadata_api' 'openmetadata_api_default' --conn-host 'http://localhost:8585'
            [lineage]
            backend = metadata.airflow.lineage.OpenMetadataLineageBackend
            openmetadata_conn_id = "openmetadata_api_default"
    """

    def __init__(self) -> None:
        super().__init__()
        _ = get_lineage_config()

    @staticmethod
    def send_lineage(
            operator: "BaseOperator",
            inlets: Optional[List] = None,
            outlets: Optional[List] = None,
            context: Dict = None,
    ) -> None:
        config = get_lineage_config()

        try:
            parse_lineage_to_openmetadata(
                config, operator, operator.inlets, operator.outlets, context
            )
        except Exception as e:
            if config.graceful_exceptions:
                operator.log.error(e)
                operator.log.info("Supressing error because graceful_exceptions is set")
            else:
                raise

