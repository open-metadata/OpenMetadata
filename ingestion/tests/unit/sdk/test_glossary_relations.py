"""Unit tests for the glossary term relations + settings SDK facades."""

import json
from dataclasses import dataclass, field

import pytest

from metadata.ingestion.ometa.client import APIError
from metadata.sdk import GlossaryTerms, Settings

FROM_ID = "11111111-1111-1111-1111-111111111111"
TO_ID = "22222222-2222-2222-2222-222222222222"
RELATION_SETTINGS_PATH = "/system/settings/glossaryTermRelationSettings"


@dataclass
class FakeRestClient:
    get_response: dict[str, object] = field(default_factory=dict)
    get_responses: list[dict[str, object]] = field(default_factory=list)
    patch_response: dict[str, object] | None = None
    patch_errors: list[Exception] = field(default_factory=list)
    post_calls: list[tuple[str, dict[str, object]]] = field(default_factory=list)
    delete_calls: list[str] = field(default_factory=list)
    get_calls: list[str] = field(default_factory=list)
    patch_calls: list[tuple[str, dict[str, object]]] = field(default_factory=list)

    def post(self, path: str, **kwargs: object) -> None:
        self.post_calls.append((path, kwargs))

    def delete(self, path: str) -> None:
        self.delete_calls.append(path)

    def get(self, path: str) -> dict[str, object]:
        self.get_calls.append(path)
        if self.get_responses:
            return self.get_responses.pop(0)
        return self.get_response

    def patch(self, path: str, **kwargs: object) -> dict[str, object] | None:
        self.patch_calls.append((path, kwargs))
        if self.patch_errors:
            raise self.patch_errors.pop(0)
        return self.patch_response


@dataclass
class FakeMetadataClient:
    client: FakeRestClient

    @staticmethod
    def get_suffix(_entity_type: object) -> str:
        return "/glossaryTerms"


@pytest.fixture
def rest_client() -> FakeRestClient:
    return FakeRestClient()


@pytest.fixture(autouse=True)
def wire_client(rest_client: FakeRestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    ometa = FakeMetadataClient(rest_client)
    monkeypatch.setattr(GlossaryTerms, "_default_client", ometa)
    monkeypatch.setattr(Settings, "_default_client", ometa)


def test_add_relation_posts_typed_payload(rest_client: FakeRestClient):
    GlossaryTerms.add_relation(FROM_ID, TO_ID, "prescribes")

    assert rest_client.post_calls == [
        (
            f"/glossaryTerms/{FROM_ID}/relations",
            {
                "json": {
                    "term": {"id": TO_ID, "type": "glossaryTerm"},
                    "relationType": "prescribes",
                }
            },
        )
    ]


def test_remove_relation_targets_relation_type(rest_client: FakeRestClient):
    GlossaryTerms.remove_relation(FROM_ID, TO_ID, "prescribes")

    assert rest_client.delete_calls == [f"/glossaryTerms/{FROM_ID}/relations/{TO_ID}?relationType=prescribes"]


def test_remove_relation_encodes_special_chars(rest_client: FakeRestClient):
    GlossaryTerms.remove_relation(FROM_ID, TO_ID, "a&b")

    assert rest_client.delete_calls == [f"/glossaryTerms/{FROM_ID}/relations/{TO_ID}?relationType=a%26b"]


def test_relations_graph_builds_query(rest_client: FakeRestClient):
    rest_client.get_response = {"nodes": [], "edges": []}

    result = GlossaryTerms.relations_graph(FROM_ID, depth=2, relation_types=["prescribes", "treats"])

    assert rest_client.get_calls == [f"/glossaryTerms/{FROM_ID}/relationsGraph?depth=2&relationTypes=prescribes,treats"]
    assert result == {"nodes": [], "edges": []}


def test_relation_type_usage(rest_client: FakeRestClient):
    rest_client.get_response = {"prescribes": 3}

    usage = GlossaryTerms.relation_type_usage()

    assert rest_client.get_calls == ["/glossaryTerms/relationTypes/usage"]
    assert usage == {"prescribes": 3}


def test_define_relation_type_appends_when_absent(rest_client: FakeRestClient):
    rest_client.get_response = {"configValue": {"relationTypes": []}}

    Settings.define_glossary_relation_type({"name": "prescribes", "displayName": "prescribes"})

    assert len(rest_client.patch_calls) == 1
    path, kwargs = rest_client.patch_calls[0]
    assert path == RELATION_SETTINGS_PATH
    patch_data = kwargs["data"]
    assert isinstance(patch_data, str)
    patch = json.loads(patch_data)
    assert patch[0] == {"op": "test", "path": "/relationTypes", "value": []}
    assert patch[1]["op"] == "add"
    assert patch[1]["path"] == "/relationTypes/-"
    assert patch[1]["value"]["name"] == "prescribes"


def test_define_relation_type_is_idempotent(rest_client: FakeRestClient):
    rest_client.get_response = {"configValue": {"relationTypes": [{"name": "prescribes"}]}}

    result = Settings.define_glossary_relation_type({"name": "prescribes"})

    assert result is None
    assert not rest_client.patch_calls


def test_define_relation_type_rechecks_after_concurrent_registration(rest_client: FakeRestClient):
    rest_client.get_responses = [
        {"configValue": {"relationTypes": []}},
        {"configValue": {"relationTypes": [{"name": "prescribes"}]}},
    ]
    rest_client.patch_errors = [
        APIError(
            {
                "code": 400,
                "message": "The JSON Patch operation 'test' failed for path '/relationTypes'",
            }
        )
    ]

    result = Settings.define_glossary_relation_type({"name": "prescribes"})

    assert result is None
    assert len(rest_client.get_calls) == 2
    assert len(rest_client.patch_calls) == 1


def test_define_relation_type_does_not_retry_unrelated_bad_request(rest_client: FakeRestClient):
    rest_client.get_response = {"configValue": {"relationTypes": []}}
    rest_client.patch_errors = [APIError({"code": 400, "message": "invalid relation type"})]

    with pytest.raises(APIError, match="invalid relation type"):
        Settings.define_glossary_relation_type({"name": "prescribes"})

    assert len(rest_client.get_calls) == 1
    assert len(rest_client.patch_calls) == 1


def test_define_relation_type_requires_name():
    with pytest.raises(ValueError):
        Settings.define_glossary_relation_type({"displayName": "no name"})
