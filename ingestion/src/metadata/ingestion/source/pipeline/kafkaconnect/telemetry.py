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
Confluent Cloud Telemetry API: how to ask it for a connector's topics, and how to read
what it answers.

Confluent Cloud answers KIP-558 with 404, so a connector whose destination topic is chosen
from a row value resolves nothing from its configuration. The telemetry Data Flow dataset
reports which topic a producer client wrote to, and a managed connector produces under a
client id carrying its own connector id, which is what ties the two together.

Everything here is pure. The HTTP session, pagination and per-run caching live with the
client, so this module can be reasoned about and tested without a network.
"""

import re
from datetime import datetime, timedelta, timezone
from http import HTTPStatus

DATAFLOW_QUERY_URL = "https://api.telemetry.confluent.cloud/v2/metrics/dataflow/query"

# Named from the CLUSTER's perspective, not the client's: received_records counts records
# the cluster received, which is what a producer wrote. The mirrored sent_records counts
# what the cluster sent to consumers and returns no producer clients at all, so it is the
# wrong end of the pipe for a source connector. The value itself is unused, only the
# topic-to-client pairing matters.
METRIC = "received_records"

# Confluent retains metrics for seven days. A shorter window keeps the response small and
# reduces how far back a since-deleted connector can appear.
WINDOW_HOURS = 24

TIMEOUT_SECONDS = 60

# The documented maximum number of groups per response. Higher values are currently
# tolerated by the service but are out of spec, and the response is paginated regardless,
# so there is nothing to gain by asking for more than the contract allows.
PAGE_LIMIT = 1000

# A cluster busy enough to need more pages than this is not one we can usefully enumerate,
# and an unbounded follow-the-cursor loop would hang ingestion on a malformed response.
MAX_PAGES = 50

# A managed connector's producer client is named connector-producer-<connector-id>-<task>.
# The convention is not documented, so it is matched rather than constructed, and a client
# id that does not match yields no attribution instead of a guess.
PRODUCER_CLIENT_PATTERN = re.compile(r"connector-producer-(?P<connector_id>lcc-[a-z0-9]+)-\d+$")

# Confluent Cloud Connect URLs end in /clusters/<kafka-cluster-id>, which is the id the
# telemetry query filters on.
CLUSTER_ID_PATTERN = re.compile(r"/clusters/(?P<cluster_id>lkc-[a-z0-9]+)")

# Confluent's error bodies are short, but this is an unbounded remote string being put into
# a log line, so it is capped rather than trusted.
MAX_ERROR_CHARS = 300


def cluster_id_from_connect_url(url: str) -> str | None:
    """The Kafka cluster id a Confluent Connect URL points at, which scopes the query."""
    match = CLUSTER_ID_PATTERN.search(url or "")
    return match.group("cluster_id") if match else None


def connector_id_from_client_id(client_id: str) -> str | None:
    """The connector a producer client belongs to, or None when it is not a connector."""
    match = PRODUCER_CLIENT_PATTERN.match(client_id or "")
    return match.group("connector_id") if match else None


def build_dataflow_query(cluster_id: str, now: datetime | None = None) -> dict:
    """
    The Data Flow query for one cluster's producer-to-topic pairs.

    Grouping by topic and client together is what makes the result attributable. The metric
    value is discarded, since the presence of the pair is the whole signal.
    """
    now = (now or datetime.now(timezone.utc)).replace(microsecond=0)
    start = now - timedelta(hours=WINDOW_HOURS)
    interval = f"{start.isoformat().replace('+00:00', 'Z')}/{now.isoformat().replace('+00:00', 'Z')}"
    return {
        "aggregations": [{"metric": METRIC, "aggregations": ["SUM"]}],
        "filter": {
            "op": "AND",
            "filters": [{"field": "resource.kafka.id", "op": "EQ", "value": cluster_id}],
        },
        "granularity": "ALL",
        "group_by": ["metric.topic", "metric.client_id"],
        "intervals": [interval],
        "limit": PAGE_LIMIT,
    }


def single_log_line(text: str) -> str:
    """
    Collapse remote text into one bounded log line.

    The body comes from whatever answered the request, which on a failure may be a proxy
    returning HTML rather than Confluent returning JSON. Newlines in it would split one
    warning into several lines that each look like their own log record, so a crafted body
    could forge entries and any body at all could break line-oriented parsing.
    """
    return " ".join((text or "").split())[:MAX_ERROR_CHARS]


def error_detail(response) -> str:
    """
    What Confluent said, which the raised HTTPError does not carry.

    ``raise_for_status`` renders only the status line, so the body is lost even though it
    is the part that identifies the failure: "Invalid credentials" and "Query must filter
    by at least one of your authorized resources" arrive under the same 4xx otherwise.
    """
    if response is None:
        return ""

    try:
        body = response.json()
    except Exception:
        return single_log_line(getattr(response, "text", ""))

    # Confluent's error envelope puts the useful sentence in errors[].detail. Anything else
    # is rendered as-is rather than dropped, because an unexpected shape is itself worth
    # seeing when diagnosing, and a body we chose not to print cannot be recovered later.
    if isinstance(body, dict):
        details = [
            str(err.get("detail")).strip()
            for err in (body.get("errors") or [])
            if isinstance(err, dict) and err.get("detail")
        ]
        if details:
            return single_log_line(", ".join(details))
    return single_log_line(str(body))


def failure_hint(exc: Exception) -> str:
    """
    Confluent's own error text plus the operator-facing next step, for a failed lookup.

    The two authentication failures need opposite fixes and were indistinguishable in the
    log. Confluent answers 401 when the credential is not a Cloud API key at all, which no
    role grant repairs, and 403 when the credential is valid but its account holds no role
    granting metrics on the cluster, which no key change repairs.

    The status to cause mapping is measured against the live API rather than taken from
    documentation. A Kafka cluster-scoped key, a wrong secret and an unknown key all give
    401. A Cloud key lacking a metrics role, or one querying a cluster in another
    organization, gives 403.
    """
    response = getattr(exc, "response", None)
    parts = []

    detail = error_detail(response)
    if detail:
        parts.append(f"Confluent said: {detail}")

    status = getattr(response, "status_code", None)
    if status == HTTPStatus.UNAUTHORIZED:
        parts.append(
            "The Kafka Connect credential is not accepted by the Telemetry API. It has to be a "
            "Confluent Cloud API key, because a Kafka cluster-scoped key cannot authenticate here"
        )
    elif status == HTTPStatus.FORBIDDEN:
        parts.append(
            "The credential authenticated but is not authorized for metrics on this cluster. Grant "
            "its account the MetricsViewer role, or use an account that already holds one conferring "
            "metrics access"
        )

    return f". {'. '.join(parts)}" if parts else ""
