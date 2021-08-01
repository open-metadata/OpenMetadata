from metadata.ingestion.api.registry import Registry
from metadata.ingestion.ometa.auth_provider import AuthenticationProvider, GoogleAuthenticationProvider, \
    NoOpAuthenticationProvider

auth_provider_registry = Registry[AuthenticationProvider]()
#auth_provider_registry.register("google", GoogleAuthenticationProvider.__class__)
#auth_provider_registry.register("no-auth", NoOpAuthenticationProvider.__class__)

# This source is always enabled
