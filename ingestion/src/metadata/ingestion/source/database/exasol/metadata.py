from typing import Optional, cast

from sqlalchemy.engine.reflection import Inspector
from sqlalchemy_exasol.base import EXADialect

from metadata.generated.schema.entity.services.connections.database.exasolConnection import (
    ExasolConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.common_db_source import CommonDbSourceService
from metadata.ingestion.source.database.exasol.sqla_utils import get_table_comment
from metadata.utils.sqlalchemy_utils import (
    get_all_table_comments,
    get_all_table_ddls,
    get_table_ddl,
)

Inspector.get_all_table_ddls = get_all_table_ddls
Inspector.get_table_ddl = get_table_ddl
EXADialect.get_table_comment = get_table_comment
EXADialect.get_all_table_comments = get_all_table_comments


class ExasolSource(CommonDbSourceService):
    @classmethod
    def create(cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None):  # noqa: UP045
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        if config.serviceConnection is None:
            raise InvalidSourceException("Missing service connection")
        connection = cast(ExasolConnection, config.serviceConnection.root.config)  # noqa: TC006
        if not isinstance(connection, ExasolConnection):
            raise InvalidSourceException(f"Expected ExasolConnection, but got {connection}")
        return cls(config, metadata)
