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
Databricks partner telemetry attribution.

Databricks ISV partner guidance requires every request the product makes to
Databricks to carry a User-Agent of the form ``<isv-name>_<product-name>/<version>``,
set programmatically in the connection code path (never from customer config). The
underscore between ISV name and product name is mandatory.

https://databrickslabs.github.io/partner-architecture/isv-partners/telemetry-attribution

The open source distribution and the commercial one report under different product
names so their usage can be told apart in the Databricks Query History ``Source``
column and in ``system.access.audit.user_agent``.

The resolved value is threaded through all three Databricks connection mechanisms:
- the databricks-sql / databricks-sqlalchemy engine (``user_agent_entry`` connect arg)
- the Databricks SDK ``WorkspaceClient`` (``product`` / ``product_version``)
- the Databricks REST client (``User-Agent`` HTTP header)
"""

from functools import lru_cache
from importlib.metadata import PackageNotFoundError
from importlib.metadata import version as _pkg_version

# ISV name and product name joined by the mandatory underscore separator. The ISV
# name is the company name and must stay consistent across all partner products, so
# it is Collate either way; only the product name distinguishes the open source
# distribution from the commercial one.
OSS_PARTNER_PRODUCT = "Collate_OpenMetadata"
COLLATE_PARTNER_PRODUCT = "Collate_Collate"

# Collate layers the `collate-ingestion` distribution on top of
# `openmetadata-ingestion`; an open source install never has it, so its presence is
# what tells the two runtimes apart. The reported version follows the distribution
# that was matched, so a Collate runtime reports the Collate release.
_OSS_DISTRIBUTION = "openmetadata-ingestion"
_COLLATE_DISTRIBUTION = "collate-ingestion"

_UNKNOWN_VERSION = "unknown"


def _distribution_version(distribution: str) -> str | None:
    """Installed version of `distribution`, or None when it is not installed."""
    try:
        return _pkg_version(distribution)
    except PackageNotFoundError:
        return None


@lru_cache(maxsize=1)
def _partner_product_and_version() -> tuple[str, str]:
    """Resolve the ``(product, version)`` pair for the running distribution."""
    collate_version = _distribution_version(_COLLATE_DISTRIBUTION)
    if collate_version is not None:
        return COLLATE_PARTNER_PRODUCT, collate_version
    oss_version = _distribution_version(_OSS_DISTRIBUTION) or _UNKNOWN_VERSION
    return OSS_PARTNER_PRODUCT, oss_version


def get_databricks_partner_product() -> str:
    """The ``<isv-name>_<product-name>`` name, without the version suffix."""
    return _partner_product_and_version()[0]


def get_databricks_user_agent() -> str:
    """Full ``<isv-name>_<product-name>/<version>`` User-Agent string."""
    product, product_version = _partner_product_and_version()
    return f"{product}/{product_version}"


def get_databricks_product() -> tuple[str, str]:
    """The ``(product, product_version)`` pair for the Databricks SDK, which joins
    them as ``product/product_version`` in the User-Agent it sends."""
    return _partner_product_and_version()
