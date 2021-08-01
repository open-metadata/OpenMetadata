from typing import Optional
from urllib.parse import quote_plus

from .sql_source import SQLAlchemyConfig, SQLAlchemySource
from ..ometa.auth_provider import MetadataServerConfig


class AthenaConfig(SQLAlchemyConfig):
    scheme: str = "awsathena+rest"
    username: Optional[str] = None
    password: Optional[str] = None
    database: Optional[str] = None
    aws_region: str
    s3_staging_dir: str
    work_group: str

    def get_sql_alchemy_url(self):
        url = f"{self.scheme}://"
        if self.username:
            url += f"{quote_plus(self.username)}"
            if self.password:
                url += f":{quote_plus(self.password)}"
        else:
            url += ":"
        url += f"@athena.{self.aws_region}.amazonaws.com:443/"
        if self.database:
            url += f"{self.database}"
        url += f"?s3_staging_dir={quote_plus(self.s3_staging_dir)}"
        url += f"&work_group={self.work_group}"

        return url


class AthenaSource(SQLAlchemySource):
    def __init__(self, config, metadata_config, ctx):
        super().__init__(config, metadata_config, ctx, "athena")

    @classmethod
    def create(cls, config_dict, metadata_config_dict, ctx):
        config = AthenaConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(config, metadata_config, ctx)