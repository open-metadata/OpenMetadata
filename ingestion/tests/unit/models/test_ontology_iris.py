#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Semantic identifiers must survive generated-client round trips exactly."""

import pytest

from metadata.generated.schema.api.data.captureOntologyRelease import CaptureOntologyRelease
from metadata.generated.schema.api.data.createOntology import CreateOntologyRequest
from metadata.generated.schema.api.data.createOntologyAxiom import CreateOntologyAxiomRequest
from metadata.generated.schema.api.data.createOntologyConcept import (
    CreateOntologyConceptRequest,
)
from metadata.generated.schema.api.data.createOntologyProperty import (
    CreateOntologyPropertyRequest,
)
from metadata.generated.schema.api.data.ontologyReleaseDiff import OntologyReleaseDiff
from metadata.generated.schema.api.data.ontologyReleaseStructureReport import (
    OntologyReleaseStructureReport,
)
from metadata.generated.schema.type.ontologyReference import OntologyReference
from metadata.generated.schema.type.ontologyReviewTarget import OntologyReviewTarget


def test_release_comparison_preserves_snapshot_coordinates_and_bounds_pages():
    release_id = "00000000-0000-0000-0000-000000000001"
    change = {
        "entity": {"id": "00000000-0000-0000-0000-000000000002", "type": "ontologyConcept"},
        "ontologyId": "00000000-0000-0000-0000-000000000003",
        "memberKind": "CONCEPT",
        "changeType": "ADDED",
        "afterReleaseId": release_id,
    }
    payload = {
        "releaseId": release_id,
        "contentDigest": "a" * 64,
        "data": [change],
        "paging": {"after": "next-page", "total": 2000},
    }
    assert OntologyReleaseDiff.model_validate(payload).model_dump(mode="json", exclude_none=True) == payload
    with pytest.raises(ValueError):
        OntologyReleaseDiff.model_validate({**payload, "data": [change] * 1001})
    with pytest.raises(ValueError):
        OntologyReleaseDiff.model_validate({**payload, "data": [{**change, "memberKind": "GLOSSARY_TERM"}]})


def test_review_target_pins_the_submitted_entity_history_version():
    payload = {
        "entityId": "00000000-0000-0000-0000-000000000001",
        "ontologyId": "00000000-0000-0000-0000-000000000002",
        "entityVersion": 0.4,
        "contentDigest": "a" * 64,
        "author": "author",
    }
    stored = OntologyReviewTarget.model_validate(payload).model_dump(mode="json", exclude_none=True)
    assert stored == payload
    for required in ("ontologyId", "entityVersion"):
        invalid = dict(payload)
        del invalid[required]
        with pytest.raises(ValueError):
            OntologyReviewTarget.model_validate(invalid)


def test_structure_report_preserves_member_coordinates_and_bounds_diagnostics():
    issue = {
        "releaseId": "00000000-0000-0000-0000-000000000001",
        "memberId": "00000000-0000-0000-0000-000000000002",
        "memberKind": "AXIOM",
        "violation": {
            "severity": "ERROR",
            "code": "UNDECLARED_PROPERTY",
            "path": "/propertyIri",
            "message": "Declare or import the referenced property",
        },
    }
    payload = {
        "releaseId": issue["releaseId"],
        "contentDigest": "a" * 64,
        "valid": False,
        "violationCount": 1001,
        "violations": [issue] * 1000,
    }
    stored = OntologyReleaseStructureReport.model_validate(payload).model_dump(mode="json")
    assert stored == payload
    with pytest.raises(ValueError):
        OntologyReleaseStructureReport.model_validate({**payload, "violations": [issue] * 1001})
    with pytest.raises(ValueError):
        OntologyReleaseStructureReport.model_validate(
            {**payload, "violations": [{**issue, "memberKind": "GLOSSARY_TERM"}]}
        )


@pytest.mark.parametrize(
    "iri",
    ["HTTPS://EXAMPLE.org/客户%2fOriginal", "https://example.org", "urn:Example:客户"],
)
@pytest.mark.parametrize(
    "model,payload",
    [
        (CreateOntologyRequest, {"name": "Sales", "namespace": "https://example.org/"}),
        (
            CreateOntologyConceptRequest,
            {"name": "Customer", "ontology": "Sales", "conceptType": "OWL_CLASS"},
        ),
        (
            CreateOntologyPropertyRequest,
            {"name": "knows", "ontology": "Sales", "kind": "OBJECT"},
        ),
        (
            OntologyReference,
            {
                "ontologyId": "00000000-0000-0000-0000-000000000001",
                "source": {
                    "id": "00000000-0000-0000-0000-000000000002",
                    "type": "ontologyProperty",
                },
                "role": "DOMAIN",
            },
        ),
    ],
)
def test_semantic_identity_keeps_its_exact_spelling(model, payload, iri):
    request = model.model_validate({**payload, "iri": iri})

    assert request.model_dump(mode="json")["iri"] == iri


def test_property_references_do_not_normalize_or_merge_iris():
    references = ["HTTPS://EXAMPLE.org/客户%2fOriginal", "https://example.org/客户%2fOriginal"]
    request = CreateOntologyPropertyRequest(
        name="knows",
        ontology="Sales",
        kind="OBJECT",
        domain=references,
        range=references,
        disjointWith=references,
        propertyChain=references,
        inverse=references[0],
    )

    stored = request.model_dump(mode="json")
    for field in ("domain", "range", "disjointWith", "propertyChain"):
        assert stored[field] == references
    assert stored["inverse"] == references[0]


def test_data_property_values_retain_lexical_forms_and_exact_datatype_iris():
    values = [
        {"value": "01", "datatypeIri": "urn:Example:CustomerId"},
        {"value": "01", "datatypeIri": "URN:Example:CustomerId"},
    ]
    request = CreateOntologyPropertyRequest(
        name="customerId",
        ontology="Sales",
        kind="DATA",
        enumValues=values,
        unit="kg",
        isIdentifier=True,
    )

    stored = request.model_dump(mode="json")
    assert stored["enumValues"] == values
    assert stored["unit"] == "kg"
    assert stored["isIdentifier"] is True


def test_data_property_enumerations_are_bounded():
    with pytest.raises(ValueError):
        CreateOntologyPropertyRequest(
            name="code",
            ontology="Sales",
            kind="DATA",
            enumValues=[{"value": str(value)} for value in range(1001)],
        )


def test_capture_has_no_import_selection_and_native_imports_are_rejected():
    request = CaptureOntologyRelease(expectedWorkingRevision=3)
    assert request.model_dump(mode="json") == {"expectedWorkingRevision": 3}
    with pytest.raises(ValueError):
        CreateOntologyRequest(
            name="Sales",
            iri="urn:Sales",
            namespace="urn:Sales:",
            imports=["urn:Other"],
        )


def test_namespace_and_mapping_iris_keep_their_exact_spelling():
    namespace = "HTTPS://EXAMPLE.org/组织#"
    ontology = CreateOntologyRequest(
        name="Sales",
        iri=namespace,
        namespace=namespace,
        prefixes=[{"prefix": "sales", "namespace": namespace}],
    )
    concept = CreateOntologyConceptRequest(
        name="Customer",
        ontology="Sales",
        conceptType="OWL_CLASS",
        conceptMappings=[{"conceptIri": namespace + "Customer", "schemeIri": namespace, "mappingType": "EXACT_MATCH"}],
    )

    assert ontology.model_dump(mode="json")["namespace"] == namespace
    assert ontology.model_dump(mode="json")["prefixes"][0]["namespace"] == namespace
    mapping = concept.model_dump(mode="json")["conceptMappings"][0]
    assert mapping["conceptIri"] == namespace + "Customer"
    assert mapping["schemeIri"] == namespace


def test_axiom_and_nested_expression_references_keep_exact_identifiers():
    iris = ["HTTPS://EXAMPLE.org/客户%2fOriginal", "https://example.org/客户%2fOriginal"]
    request = CreateOntologyAxiomRequest(
        name="classification",
        displayName="Classification",
        description="Exact references",
        ontology="Sales",
        axiomType="EQUIVALENT_CLASS",
        subjectIri=iris[0],
        provenance="Manual",
        expressions=[{"kind": "ONE_OF", "individualIris": iris}],
    )
    stored = request.model_dump(mode="json")
    assert stored["subjectIri"] == iris[0]
    assert stored["expressions"][0]["individualIris"] == iris
    assert "glossary" not in stored
