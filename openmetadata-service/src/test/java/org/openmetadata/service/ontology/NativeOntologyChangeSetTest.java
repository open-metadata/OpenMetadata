package org.openmetadata.service.ontology;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.ws.rs.BadRequestException;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.entity.data.OntologyChangeSet;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.type.OntologyChangeOperationType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.governance.approval.ApprovalGate;

class NativeOntologyChangeSetTest {
  private static final String DRAFT =
      """
      {
        "ontology": {"id":"2ecf752a-956d-4a44-95ec-cce029f5c1d7", "type":"ontology"},
        "baseWorkingRevision": 0,
        "glossaries": [],
        "undoCursor": 1,
        "operations": [{
          "id":"83762099-0b59-4125-9fe1-252becb42185", "operationType":"UPSERT_CONCEPT",
          "concept": {
            "id":"5b7de8e7-9daa-4162-9659-a9318113c968", "name":"Customer",
            "fullyQualifiedName":"Sales.Customer", "conceptType":"OWL_CLASS", "iri":"urn:Customer",
            "ontology":{"id":"2ecf752a-956d-4a44-95ec-cce029f5c1d7", "type":"ontology"}
          }
        }]
      }
      """;

  @Test
  void nativeConceptProposalsUseTheExistingChangeSetLifecycle() {
    final var draft = draft();
    assertDoesNotThrow(() -> OntologyChangeSetValidator.normalizeAndValidate(draft));
  }

  @Test
  void nativeProposalsCannotTargetAnotherOntology() {
    final var json = JsonUtils.readTree(DRAFT);
    ((ObjectNode) json.path("operations").get(0).path("concept").path("ontology"))
        .put("id", "56b0cc3a-1139-41dd-a16d-bcd12e597eb9");
    final var draft = JsonUtils.convertValue(json, OntologyChangeSet.class);
    assertThrows(
        BadRequestException.class, () -> OntologyChangeSetValidator.normalizeAndValidate(draft));
  }

  @Test
  void nativeAndGlossaryScopesCannotBeMixed() {
    final var draft =
        JsonUtils.readValue(
            DRAFT.replace(
                "\"glossaries\": []",
                "\"glossaries\": [{\"id\":\"56b0cc3a-1139-41dd-a16d-bcd12e597eb9\",\"type\":\"glossary\"}]"),
            OntologyChangeSet.class);
    assertThrows(
        BadRequestException.class, () -> OntologyChangeSetValidator.normalizeAndValidate(draft));
  }

  @Test
  void oneDraftCannotMutateTheSameDefinitionTwice() {
    final var draft = draft();
    final var first = draft.getOperations().getFirst();
    final var duplicate = JsonUtils.deepCopy(first, first.getClass()).withId(UUID.randomUUID());
    draft.setOperations(List.of(first, duplicate));
    assertThrows(
        BadRequestException.class, () -> OntologyChangeSetValidator.normalizeAndValidate(draft));
  }

  @Test
  void deletesRequireAVersionedTargetAndNoDefinitionPayload() {
    final var draft = draft();
    final var operation = draft.getOperations().getFirst();
    operation.setOperationType(OntologyChangeOperationType.DELETE_CONCEPT);
    operation.setTargetId(operation.getConcept().getId());
    operation.setBaseVersion(0.1);
    assertThrows(
        BadRequestException.class, () -> OntologyChangeSetValidator.normalizeAndValidate(draft));
    operation.setConcept(null);
    assertDoesNotThrow(() -> OntologyChangeSetValidator.normalizeAndValidate(draft));
    operation.setBaseVersion(null);
    assertThrows(
        BadRequestException.class, () -> OntologyChangeSetValidator.normalizeAndValidate(draft));
  }

  @Test
  void changedDefinitionsFailPreflightBeforeAnyOperationRuns() {
    final var draft = draft();
    final var operation = draft.getOperations().getFirst();
    operation.setTargetId(operation.getConcept().getId());
    operation.setBaseVersion(0.1);
    final var current = JsonUtils.deepCopy(operation.getConcept(), OntologyConcept.class);
    current.setVersion(0.2);
    final var preflight = new OntologyChangePreflight((type, id) -> current);
    assertThrows(BadRequestException.class, () -> preflight.validate(draft, draft.getOperations()));
    current.setVersion(0.1);
    assertDoesNotThrow(() -> preflight.validate(draft, draft.getOperations()));
    current.setDeleted(true);
    assertThrows(BadRequestException.class, () -> preflight.validate(draft, draft.getOperations()));
  }

  @Test
  void nativeProposalsRequireAnActiveSourceMemory() {
    final var draft = draft();
    final var source = new ContextMemory().withId(UUID.randomUUID());
    draft.getOperations().getFirst().setSourceMemoryIds(Set.of(source.getId()));
    final var preflight = new OntologyChangePreflight((type, id) -> source);
    assertThrows(BadRequestException.class, () -> preflight.validate(draft, draft.getOperations()));
    source.setEntityStatus(ContextMemoryStatus.APPROVED);
    assertDoesNotThrow(() -> preflight.validate(draft, draft.getOperations()));
    source.setDeleted(true);
    assertThrows(BadRequestException.class, () -> preflight.validate(draft, draft.getOperations()));
  }

  @Test
  void nativeWorkingEditsAreGovernedByTheReleaseInsteadOfHeldIndividually() {
    final var before = new OntologyConcept().withId(UUID.randomUUID()).withName("Customer");
    final var after =
        new OntologyConcept()
            .withId(before.getId())
            .withName("Customer")
            .withDescription("Updated working definition");
    assertTrue(
        ApprovalGate.admit(before, after, "steward", null, ApprovalGate.Edit.put()).isEmpty());
    assertTrue(ApprovalGate.preview(before, after, "steward", ApprovalGate.Edit.put()).isEmpty());
    assertFalse(ApprovalGate.mayHold("ontologyConcept", "steward"));
  }

  private static OntologyChangeSet draft() {
    return JsonUtils.readValue(DRAFT, OntologyChangeSet.class);
  }
}
