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
FIPS compatibility of the MD5 call sites.

On a FIPS-enabled host ``hashlib.md5()`` raises unless ``usedforsecurity=False`` is passed, and
``generate_source_hash`` swallows that error and returns ``None`` -- so a connector silently
ingests nothing instead of failing loudly. Reproduced on ``registry.access.redhat.com/ubi8/python-39``
with ``OPENSSL_FORCE_FIPS_MODE=1``:

    ValueError: [digital envelope routines: EVP_DigestInit_ex] disabled for FIPS

None of these digests authenticate anything -- they fingerprint entities for change detection and
name queries for de-duplication -- so declaring them non-security is accurate, not a policy bypass.
"""

import ast
import hashlib
from pathlib import Path
from unittest.mock import patch

import pytest

from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.entity.data.table import Column, DataType
from metadata.ingestion.lineage.parser import LineageParser
from metadata.ingestion.ometa.mixins.query_mixin import OMetaQueryMixin
from metadata.utils.fqn import get_query_checksum
from metadata.utils.helpers import get_query_hash
from metadata.utils.source_hash import generate_source_hash

SOURCE_ROOT = Path(__file__).parents[2] / "src"

FIPS_ERROR = "[digital envelope routines: EVP_DigestInit_ex] disabled for FIPS"

_REAL_MD5 = hashlib.md5


def _fips_md5(*args, **kwargs):
    """Stand-in for hashlib.md5 on a FIPS host: rejects anything not flagged non-security."""
    if kwargs.pop("usedforsecurity", True):
        raise ValueError(FIPS_ERROR)
    return _REAL_MD5(*args, **kwargs)


def _hashlib_md5_aliases(tree: ast.Module) -> tuple[set[str], set[str]]:
    """Names bound to hashlib.md5 in a module, as (bare names, hashlib module aliases)."""
    bare_names: set[str] = set()
    module_aliases: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            module_aliases.update(a.asname or a.name for a in node.names if a.name == "hashlib")
        elif isinstance(node, ast.ImportFrom) and node.module == "hashlib":
            bare_names.update(a.asname or a.name for a in node.names if a.name == "md5")
    return bare_names, module_aliases


def _is_md5_call(node: ast.Call, bare_names: set[str], module_aliases: set[str]) -> bool:
    """True only for hashlib's md5 -- never for SQL-side helpers such as ``func.md5(...)``."""
    func = node.func
    if isinstance(func, ast.Name):
        return func.id in bare_names
    if isinstance(func, ast.Attribute) and func.attr == "md5":
        return isinstance(func.value, ast.Name) and func.value.id in module_aliases
    return False


def _unflagged_md5_call_sites() -> list[str]:
    """Every hashlib.md5 call under ingestion/src missing usedforsecurity=False."""
    offenders = []
    for path in SOURCE_ROOT.rglob("*.py"):
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        bare_names, module_aliases = _hashlib_md5_aliases(tree)
        if not bare_names and not module_aliases:
            continue
        for node in ast.walk(tree):
            if not isinstance(node, ast.Call) or not _is_md5_call(node, bare_names, module_aliases):
                continue
            flagged = any(
                kw.arg == "usedforsecurity" and isinstance(kw.value, ast.Constant) and kw.value.value is False
                for kw in node.keywords
            )
            if not flagged:
                offenders.append(f"{path.relative_to(SOURCE_ROOT)}:{node.lineno}")
    return sorted(offenders)


def test_no_unflagged_md5_call_sites_remain():
    """Guards every module at once, including `from hashlib import md5` aliases.

    A grep for ``hashlib.md5`` misses those, which is how the DataLake call site survived the
    first pass at this fix.
    """
    offenders = _unflagged_md5_call_sites()
    assert offenders == [], "hashlib.md5 without usedforsecurity=False breaks FIPS hosts: " + ", ".join(offenders)


def test_fips_stub_rejects_unflagged_calls():
    """The stub only proves something if an unflagged call really does fail under it."""
    with patch("hashlib.md5", _fips_md5), pytest.raises(ValueError, match="disabled for FIPS"):
        hashlib.md5(b"payload")


def test_generate_source_hash_survives_fips():
    """Returns None instead of a digest when MD5 is rejected -- the silent-no-output bug."""
    request = CreateTableRequest(
        name="fips_probe",
        databaseSchema="service.database.schema",
        columns=[Column(name="id", dataType=DataType.INT)],
    )
    with patch("hashlib.md5", _fips_md5):
        source_hash = generate_source_hash(create_request=request)

    assert source_hash is not None
    assert source_hash == generate_source_hash(create_request=request)


@pytest.mark.parametrize(
    "hash_function",
    [
        get_query_checksum,
        get_query_hash,
        LineageParser.get_query_hash,
        lambda query: OMetaQueryMixin._get_query_hash(None, query=query),
    ],
    ids=["fqn.get_query_checksum", "helpers.get_query_hash", "parser.get_query_hash", "query_mixin._get_query_hash"],
)
def test_query_hashes_survive_fips(hash_function):
    query = "SELECT id FROM fips_probe"
    with patch("hashlib.md5", _fips_md5):
        assert hash_function(query)


def test_sampler_table_name_survives_fips():
    from metadata.sampler.sqlalchemy.sampler import SQASampler

    class _RawDataset:
        __tablename__ = "fips_probe"

    sampler = type("_Sampler", (), {"raw_dataset": _RawDataset})()
    with patch("hashlib.md5", _fips_md5):
        assert SQASampler.get_sampler_table_name(sampler)


@pytest.mark.parametrize("payload", [b"", b"a", b"openmetadata", b"x" * 10000, bytes(range(256))])
def test_flag_does_not_change_the_digest(payload):
    """Stored sourceHash values stay valid across the upgrade, so no re-ingestion is triggered."""
    assert hashlib.md5(payload, usedforsecurity=False).hexdigest() == hashlib.md5(payload).hexdigest()
