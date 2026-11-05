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
Naming for ``Metric`` entities produced by a semantic layer.

``MetricRepository.setFullyQualifiedName`` assigns the FQN from the name verbatim, so the
``Metric`` namespace is global: a name must be unique across every service in the deployment
and must remain a single FQN-safe segment. Connectors therefore cannot name a metric after the
source object; they hash its canonical identity instead and keep the human name in
``displayName``.

This lives in ``utils`` rather than in a connector because the constraint is the server's, not
any one source's -- Snowflake semantic views and Looker LookML measures must not be able to
collide with each other.
"""

import hashlib

# A metric name is prefixed with its service so the global Metric namespace stays browsable by
# service; the digest after it carries the identity. Cap the prefix so a long service name
# cannot push the name past the 256-character entityName limit.
SERVICE_PREFIX_MAX_LEN = 64

# NUL separates identity components: no source system permits it in an identifier, so part
# boundaries stay unambiguous and ("a.b", "c") cannot hash to the same value as ("a", "b.c").
_IDENTITY_SEPARATOR = "\x00"


def service_prefix(service: str, fallback: str) -> str:
    """FQN-safe prefix derived from the OpenMetadata service name.

    A service name is user-defined and may carry ``.``, spaces, or ``::``, any of which would
    stop the metric name from being a single FQN segment -- ``MetricRepository`` assigns the FQN
    from the raw name without quoting it. Map everything outside ``[alnum]``/``_``/``-`` to
    ``-``. This is deliberately lossy: the digest is what makes the name unique, so two services
    that flatten to the same prefix still produce different names.
    """
    safe = "".join(char if char.isalnum() or char in "_-" else "-" for char in service or "")
    return safe[:SERVICE_PREFIX_MAX_LEN].strip("-") or fallback


def build_metric_name(service: str, identity: tuple[str, ...], fallback_prefix: str) -> str:
    """Stable ``<service-prefix>-<digest>`` name for a semantic-layer metric.

    ``identity`` is the full canonical path of the metric within its source, already normalized
    by the caller (quoting rules are source-specific). Hashing it, rather than exposing a lossy
    separator-joined path, keeps the name one FQN segment and free of source-specific
    punctuation. The full digest avoids introducing a truncation collision of our own and stays
    well below the entity-name length limit.
    """
    digest = hashlib.sha256(_IDENTITY_SEPARATOR.join((service, *identity)).encode("utf-8")).hexdigest()
    return f"{service_prefix(service, fallback_prefix)}-{digest}"
