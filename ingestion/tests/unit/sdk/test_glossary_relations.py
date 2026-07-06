"""Unit tests for the glossary term relations + settings SDK facades."""

import json
from unittest.mock import MagicMock

import pytest

from metadata.sdk import GlossaryTerms, Settings

FROM_ID = "11111111-1111-1111-1111-111111111111"
TO_ID = "22222222-2222-2222-2222-222222222222"
RELATION_SETTINGS_PATH = "/system/settings/glossaryTermRelationSettings"


@pytest.fixture
def rest_client():
    return MagicMock()


@pytest.fixture(autouse=True)
def wire_client(rest_client):
    ometa = MagicMock()
    ometa.client = rest_client
    ometa.get_suffix = MagicMock(return_value="/glossaryTerms")
    GlossaryTerms.use_client(ometa)
    Settings.use_client(ometa)
    yield
    GlossaryTerms._default_client = None
    Settings._default_client = None


def test_add_relation_posts_typed_payload(rest_client):
    GlossaryTerms.add_relation(FROM_ID, TO_ID, "prescribes")

    rest_client.post.assert_called_once_with(
        f"/glossaryTerms/{FROM_ID}/relations",
        json={
            "term": {"id": TO_ID, "type": "glossaryTerm"},
            "relationType": "prescribes",
        },
    )


def test_remove_relation_targets_relation_type(rest_client):
    GlossaryTerms.remove_relation(FROM_ID, TO_ID, "prescribes")

    rest_client.delete.assert_called_once_with(f"/glossaryTerms/{FROM_ID}/relations/{TO_ID}?relationType=prescribes")


def test_remove_relation_encodes_special_chars(rest_client):
    GlossaryTerms.remove_relation(FROM_ID, TO_ID, "a&b")

    rest_client.delete.assert_called_once_with(f"/glossaryTerms/{FROM_ID}/relations/{TO_ID}?relationType=a%26b")


def test_relations_graph_builds_query(rest_client):
    rest_client.get.return_value = {"nodes": [], "edges": []}

    result = GlossaryTerms.relations_graph(FROM_ID, depth=2, relation_types=["prescribes", "treats"])

    rest_client.get.assert_called_once_with(
        f"/glossaryTerms/{FROM_ID}/relationsGraph?depth=2&relationTypes=prescribes,treats"
    )
    assert result == {"nodes": [], "edges": []}


def test_relation_type_usage(rest_client):
    rest_client.get.return_value = {"prescribes": 3}

    usage = GlossaryTerms.relation_type_usage()

    rest_client.get.assert_called_once_with("/glossaryTerms/relationTypes/usage")
    assert usage == {"prescribes": 3}


def test_define_relation_type_appends_when_absent(rest_client):
    rest_client.get.return_value = {"configValue": {"relationTypes": []}}

    Settings.define_glossary_relation_type({"name": "prescribes", "displayName": "prescribes"})

    args, kwargs = rest_client.patch.call_args
    assert args[0] == RELATION_SETTINGS_PATH
    patch = json.loads(kwargs["data"])
    assert patch[0]["op"] == "add"
    assert patch[0]["path"] == "/relationTypes/-"
    assert patch[0]["value"]["name"] == "prescribes"


def test_define_relation_type_is_idempotent(rest_client):
    rest_client.get.return_value = {"configValue": {"relationTypes": [{"name": "prescribes"}]}}

    result = Settings.define_glossary_relation_type({"name": "prescribes"})

    assert result is None
    rest_client.patch.assert_not_called()


def test_define_relation_type_requires_name(rest_client):
    with pytest.raises(ValueError):
        Settings.define_glossary_relation_type({"displayName": "no name"})
