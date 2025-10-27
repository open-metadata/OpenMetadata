"""Configuration management for ThirdEye service."""

from typing import Literal
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )
    
    # Service configuration
    environment: Literal["development", "staging", "production"] = "development"
    log_level: str = "INFO"
    service_name: str = "thirdeye-py-service"
    service_port: int = 8586
    
    # OpenMetadata MySQL (read-only)
    om_mysql_host: str = "localhost"
    om_mysql_port: int = 3306
    om_mysql_user: str = "openmetadata_user"
    om_mysql_password: str = "openmetadata_password"
    om_mysql_db: str = "thirdeye"
    om_mysql_pool_size: int = 10
    om_mysql_max_overflow: int = 20
    
    # ThirdEye MySQL (read-write)
    te_mysql_host: str = "localhost"
    te_mysql_port: int = 3306
    te_mysql_user: str = "openmetadata_user"
    te_mysql_password: str = "openmetadata_password"
    te_mysql_db: str = "thirdeye"
    te_mysql_schema: str = "thirdeye"
    te_mysql_pool_size: int = 10
    te_mysql_max_overflow: int = 20
    
    # Authentication
    jwt_secret: str = "changeme-shared-with-openmetadata"
    jwt_algorithm: str = "HS256"
    
    # GraphQL
    graphql_introspection_enabled: bool = True  # Disable in production
    graphql_max_depth: int = 10
    graphql_max_cost: int = 10000
    
    @property
    def om_mysql_url(self) -> str:
        """OpenMetadata database URL (read-only)."""
        return (
            f"mysql+aiomysql://{self.om_mysql_user}:{self.om_mysql_password}"
            f"@{self.om_mysql_host}:{self.om_mysql_port}/{self.om_mysql_db}"
        )
    
    @property
    def te_mysql_url(self) -> str:
        """ThirdEye database URL (read-write)."""
        return (
            f"mysql+aiomysql://{self.te_mysql_user}:{self.te_mysql_password}"
            f"@{self.te_mysql_host}:{self.te_mysql_port}/{self.te_mysql_db}"
        )
    
    @property
    def is_production(self) -> bool:
        """Check if running in production."""
        return self.environment == "production"


# Global settings instance
settings = Settings()
