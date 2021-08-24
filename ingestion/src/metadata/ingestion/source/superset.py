from typing import Optional

from metadata.config.common import ConfigModel
from metadata.ingestion.api.common import WorkflowContext
from metadata.ingestion.api.source import Source, SourceStatus
from metadata.ingestion.ometa.auth_provider import MetadataServerConfig


class SupersetSourceConfig(ConfigModel):
    url: str = "localhost:8088"
    username: Optional[str] = None
    password: Optional[str] = None
    provider: str = "db"
    options: dict = {}


class SupersetSource(Source):
    config: SupersetSourceConfig
    metadata_config: MetadataServerConfig
    status: SourceStatus
    platform = "superset"

    def __init__(self, config: SupersetSourceConfig, metadata_config: MetadataServerConfig, ctx: WorkflowContext):
        super().__init__(ctx)
        self.config = config
        self.metadata_config = metadata_config
        self.status = SourceStatus()

        login_response = requests.post(
            f"{self.config.connect_uri}/api/v1/security/login",
            None,
            {
                "username": self.config.username,
                "password": self.config.password,
                "refresh": True,
                "provider": self.config.provider,
            },
        )

        self.access_token = login_response.json()["access_token"]

        self.session = requests.Session()
        self.session.headers.update(
            {
                "Authorization": f"Bearer {self.access_token}",
                "Content-Type": "application/json",
                "Accept": "*/*",
            }
        )

        # Test the connection
        test_response = self.session.get(f"{self.config.connect_uri}/api/v1/database")
        if test_response.status_code == 200:
            pass
            # TODO(Gabe): how should we message about this error?

    @classmethod
    @classmethod
    def create(cls, config_dict: dict, metadata_config_dict: dict, ctx: WorkflowContext):
        config = SupersetSourceConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(config, metadata_config, ctx)
