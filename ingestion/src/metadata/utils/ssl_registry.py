#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
Register SSL verification results
"""
from typing import Callable, Optional

from metadata.generated.schema.security.ssl.verifySSLConfig import SslConfig, VerifySSL
from metadata.utils.dispatch import enum_register


class InvalidSSLVerificationException(Exception):
    """
    Raised when we cannot find a valid SSL verification
    in the registry
    """


ssl_verification_registry = enum_register()


@ssl_verification_registry.add(VerifySSL.no_ssl.value)
def no_ssl_init(_: Optional[SslConfig]) -> None:
    return None


@ssl_verification_registry.add(VerifySSL.ignore.value)
def ignore_ssl_init(_: Optional[SslConfig]) -> bool:
    return False


@ssl_verification_registry.add(VerifySSL.validate.value)
def validate_ssl_init(ssl_config: Optional[SslConfig]) -> str:
    if ssl_config is None:
        raise InvalidSSLVerificationException(
            "You have Verify SSL but the SSL Config is missing. Make sure to inform the CA Certificate path."
        )
    return ssl_config.root.caCertificate.get_secret_value()


def get_verify_ssl_fn(verify_ssl: VerifySSL) -> Callable:
    """
    Pick up the right registered function
    """
    verify_ssl_fn = ssl_verification_registry.registry.get(verify_ssl.value)
    if not verify_ssl_fn:
        raise InvalidSSLVerificationException(
            f"Cannot find {verify_ssl.value} in {ssl_verification_registry.registry}"
        )

    return verify_ssl_fn
