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

The same value is threaded through all three Databricks connection mechanisms:
- the databricks-sql / databricks-sqlalchemy engine (``user_agent_entry`` connect arg)
- the Databricks SDK ``WorkspaceClient`` (``product`` / ``product_version``)
- the Databricks REST client (``User-Agent`` HTTP header)
"""

from importlib.metadata import PackageNotFoundError
from importlib.metadata import version as _pkg_version

# ISV name and product name joined by the mandatory underscore separator. Change
# this single constant if Databricks registers the integration under a different
# ISV/product name (e.g. "OpenMetadata_Ingestion").
DATABRICKS_PARTNER_PRODUCT = "Collate_Ingestion"

_UNKNOWN_VERSION = "unknown"


def _ingestion_version() -> str:
    try:
        resolved_version = _pkg_version("openmetadata-ingestion")
    except PackageNotFoundError:
        resolved_version = _UNKNOWN_VERSION
    return resolved_version


def get_databricks_user_agent() -> str:
    """Full ``<isv-name>_<product-name>/<version>`` User-Agent string."""
    return f"{DATABRICKS_PARTNER_PRODUCT}/{_ingestion_version()}"


def get_databricks_product() -> tuple[str, str]:
    """The ``(product, product_version)`` pair for the Databricks SDK, which joins
    them as ``product/product_version`` in the User-Agent it sends."""
    return DATABRICKS_PARTNER_PRODUCT, _ingestion_version()
