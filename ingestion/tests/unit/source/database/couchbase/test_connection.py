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
"""Unit tests for the Couchbase BaseConnection wiring (non-Engine: SDK Cluster).

The couchbase SDK is an optional dependency imported lazily inside
``_get_client``, so this module never imports it: the checks are driven against a
stand-in cluster, and the error pack matches on message text for the same reason.
"""

from collections.abc import Iterator
from contextlib import contextmanager
from unittest.mock import MagicMock, patch

import pytest

from metadata.core.connections.test_connection.check import CheckError, collect_checks
from metadata.core.connections.test_connection.checks.database import DatabaseStep
from metadata.generated.schema.entity.services.connections.database.couchbaseConnection import (
    CouchbaseConnection as CouchbaseConnectionConfig,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.database.couchbase.connection import (
    CouchbaseChecks,
    CouchbaseConnection,
)

CONNECTION_MODULE = "metadata.ingestion.source.database.couchbase.connection"


def _config(**kwargs) -> CouchbaseConnectionConfig:
    base = {"username": "user", "password": "pass", "hostport": "localhost"}
    base.update(kwargs)
    return CouchbaseConnectionConfig(**base)


def _cluster(buckets: list[str], readable: list[str]) -> MagicMock:
    """A cluster whose scope listing succeeds only for `readable` buckets"""
    cluster = MagicMock()
    # `name` is a MagicMock constructor argument, so it has to be assigned after.
    listed = []
    for name in buckets:
        handle = MagicMock()
        handle.name = name
        listed.append(handle)
    cluster.buckets.return_value.get_all_buckets.return_value = listed

    def bucket(name: str) -> MagicMock:
        handle = MagicMock()
        if name in readable:
            handle.collections.return_value.get_all_scopes.return_value = [MagicMock()]
        else:
            handle.collections.return_value.get_all_scopes.side_effect = RuntimeError(f"no access to bucket {name}")
        return handle

    cluster.bucket.side_effect = bucket
    return cluster


@contextmanager
def _checks(config: CouchbaseConnectionConfig, cluster: MagicMock) -> Iterator[CouchbaseChecks]:
    """The provider, with the SDK entry point patched for as long as its checks run"""
    with patch(f"{CONNECTION_MODULE}.CouchbaseConnection._get_client", return_value=cluster):
        yield CouchbaseConnection(config).checks()


def _probed_buckets(cluster: MagicMock) -> list[str]:
    return [call.args[0] for call in cluster.bucket.call_args_list]


def test_couchbase_connection_is_base_connection():
    assert issubclass(CouchbaseConnection, BaseConnection)


def test_couchbase_checks_cover_the_definition_steps():
    with _checks(_config(), _cluster(["travel"], ["travel"])) as checks:
        steps = collect_checks(checks)
    assert set(steps) == {DatabaseStep.GetDatabases, DatabaseStep.GetCollections}


def test_get_collections_probes_only_the_configured_bucket():
    """`bucket` pins what the ingestion reads, so it is the only bucket probed"""
    cluster = _cluster(["internal", "travel"], readable=["travel"])

    with _checks(_config(bucket="travel"), cluster) as checks:
        checks.get_databases()
        evidence = checks.get_collections()

    assert _probed_buckets(cluster) == ["travel"]
    assert "travel" in evidence.summary
    cluster.buckets.assert_not_called()


def test_get_collections_passes_when_one_bucket_can_be_read():
    """Without a pin the probe keeps going until a bucket lets us in"""
    cluster = _cluster(["internal", "travel"], readable=["travel"])

    with _checks(_config(), cluster) as checks:
        evidence = checks.get_collections()

    assert _probed_buckets(cluster) == ["internal", "travel"]
    assert "travel" in evidence.summary


def test_get_collections_fails_when_no_bucket_can_be_read():
    cluster = _cluster(["internal", "travel"], readable=[])

    with _checks(_config(), cluster) as checks, pytest.raises(CheckError):
        checks.get_collections()


def test_get_collections_without_a_bucket_is_a_caveat_not_a_failure():
    """A cluster that exposes no bucket to this user is a configuration answer"""
    cluster = _cluster([], readable=[])

    with _checks(_config(), cluster) as checks:
        evidence = checks.get_collections()

    assert _probed_buckets(cluster) == []
    assert evidence.caveat is not None


def test_get_databases_reports_the_buckets_in_scope():
    cluster = _cluster(["internal", "travel"], readable=["travel"])

    with _checks(_config(), cluster) as checks:
        evidence = checks.get_databases()

    assert "2 buckets" in evidence.summary
    assert evidence.caveat is None
