"""
Configuration management using Pydantic Settings.
Loads configuration from environment variables with sensible defaults.
"""

from functools import lru_cache
from typing import Optional
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )
    
    # Application
    app_name: str = "ThirdEye Analytics Service"
    app_version: str = "0.1.0"
    debug: bool = Field(default=False, description="Debug mode")
    environment: str = Field(default="development", description="Environment: development, staging, production")
    
    # Server
    host: str = Field(default="0.0.0.0", description="Host to bind")
    port: int = Field(default=8586, description="Port to bind")
    reload: bool = Field(default=False, description="Auto-reload on code changes (dev only)")
    
    # MySQL Database (shared instance with OpenMetadata)
    # OpenMetadata schema - read-only access
    om_mysql_host: str = Field(default="localhost", description="MySQL host (shared with OpenMetadata)")
    om_mysql_port: int = Field(default=3306, description="MySQL port")
    om_mysql_db: str = Field(default="openmetadata_db", description="OpenMetadata database/schema name")
    om_mysql_user_ro: str = Field(default="openmetadata_user", description="Read-only user for OM schema")
    om_mysql_pw_ro: str = Field(default="openmetadata_password", description="Read-only password")
    
    # ThirdEye schema - read-write access (same MySQL instance)
    thirdeye_mysql_schema: str = Field(default="thirdeye", description="ThirdEye schema name (in same MySQL)")
    thirdeye_mysql_user: str = Field(default="thirdeye", description="Read-write user for thirdeye schema")
    thirdeye_mysql_pw: str = Field(default="thirdeye123", description="Read-write password")
    
    # Connection pool settings
    sqlalchemy_pool_size: int = Field(default=10, description="SQLAlchemy connection pool size")
    sqlalchemy_max_overflow: int = Field(default=20, description="SQLAlchemy max overflow connections")
    db_echo: bool = Field(default=False, description="Echo SQL queries (debug)")
    
    # OpenMetadata API Integration
    om_base_url: str = Field(
        default="http://localhost:8585",
        description="OpenMetadata service base URL"
    )
    om_api_timeout: int = Field(default=30, description="OpenMetadata API timeout (seconds)")
    
    # JWT Authentication
    jwt_enabled: bool = Field(default=True, description="Enable JWT authentication")
    jwt_jwks_url: Optional[str] = Field(
        default=None,
        description="JWT JWKS URL for key discovery (e.g., http://localhost:8585/.well-known/jwks.json)"
    )
    jwt_public_key: Optional[str] = Field(
        default=None,
        description="JWT public key (PEM format) - alternative to JWKS URL"
    )
    jwt_secret: Optional[str] = Field(
        default=None,
        description="JWT secret key for HS256 (shared with OpenMetadata) - use for dev only"
    )
    jwt_algorithm: str = Field(default="RS256", description="JWT algorithm: RS256, HS256, etc.")
    jwt_audiences: list[str] = Field(
        default=["openmetadata"],
        description="Accepted JWT audience claims"
    )
    jwt_issuer: Optional[str] = Field(default="openmetadata", description="Expected JWT issuer claim")
    
    @field_validator("jwt_enabled")
    @classmethod
    def validate_jwt_config(cls, v, info):
        """Validate that at least one JWT verification method is configured when enabled."""
        if v:  # If JWT is enabled
            values = info.data
            has_jwks = values.get("jwt_jwks_url") is not None
            has_public_key = values.get("jwt_public_key") is not None
            has_secret = values.get("jwt_secret") is not None
            
            if not (has_jwks or has_public_key or has_secret):
                raise ValueError(
                    "When jwt_enabled=true, at least one of jwt_jwks_url, jwt_public_key, or jwt_secret must be provided"
                )
        return v
    
    # Logging
    log_level: str = Field(default="INFO", description="Logging level: DEBUG, INFO, WARNING, ERROR, CRITICAL")
    log_format: str = Field(
        default="<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
        description="Loguru format string"
    )
    
    # Metrics
    metrics_enabled: bool = Field(default=True, description="Enable Prometheus metrics")
    
    # CORS
    cors_origins: list[str] = Field(
        default=["http://localhost:3000", "http://localhost:8585"],
        description="Allowed CORS origins"
    )
    
    # ThirdEye specific configs
    refresh_minutes: int = Field(default=60, description="ZI Score recompute cadence (minutes)")
    campaign_expiration_days: int = Field(default=30, description="Default campaign expiration (days)")
    
    @property
    def thirdeye_database_url(self) -> str:
        """
        Async MySQL connection URL for ThirdEye schema (read-write).
        Uses thirdeye_mysql_schema as the default database/schema.
        """
        return (
            f"mysql+asyncmy://{self.thirdeye_mysql_user}:{self.thirdeye_mysql_pw}"
            f"@{self.om_mysql_host}:{self.om_mysql_port}/{self.thirdeye_mysql_schema}"
            f"?charset=utf8mb4"
        )
    
    @property
    def om_database_url(self) -> str:
        """
        Async MySQL connection URL for OpenMetadata schema (read-only).
        """
        return (
            f"mysql+asyncmy://{self.om_mysql_user_ro}:{self.om_mysql_pw_ro}"
            f"@{self.om_mysql_host}:{self.om_mysql_port}/{self.om_mysql_db}"
            f"?charset=utf8mb4"
        )
    
    @property
    def refresh_interval_seconds(self) -> int:
        """Convert refresh_minutes to seconds."""
        return self.refresh_minutes * 60


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()

