/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.factories.GlossaryTestFactory;
import org.openmetadata.it.util.NamespaceCleanup;
import org.openmetadata.it.util.OntologyChangeSetTestSupport;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.context.CreateContextMemory;
import org.openmetadata.schema.api.data.AcquireOntologyEditLock;
import org.openmetadata.schema.api.data.ApplyOntologyChangeSet;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.CreateOntologyChangeSet;
import org.openmetadata.schema.api.data.OntologyChangeSetCommand;
import org.openmetadata.schema.api.data.OntologyMemoryProposalStatus;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.OntologyChangeSet;
import org.openmetadata.schema.type.OntologyAttribute;
import org.openmetadata.schema.type.OntologyAttributeDataType;
import org.openmetadata.schema.type.OntologyChangeOperation;
import org.openmetadata.schema.type.OntologyChangeOperationResult;
import org.openmetadata.schema.type.OntologyChangeOperationResultStatus;
import org.openmetadata.schema.type.OntologyChangeOperationState;
import org.openmetadata.schema.type.OntologyChangeOperationType;
import org.openmetadata.schema.type.OntologyChangeSetState;
import org.openmetadata.schema.type.OntologyEditLeaseToken;
import org.openmetadata.schema.type.OntologyEditLock;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.context.ContextMemoryService;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.OntologyChangeSetRepository;

/** Integration coverage for durable drafts, undo/redo, edit leases, and atomic application. */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class OntologyChangeSetIT {
  private static final String ONTOLOGY_CHANGE_SET = "ontologyChangeSet";

  @AfterEach
  void cleanup(TestNamespace ns) {
    NamespaceCleanup.deleteRoots(ns.drainTrackedRoots());
  }

  @Test
  void appliesOnlyTheActiveDraftTimelineWhileHoldingItsLease(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTerm term = createTerm(client, glossary, ns.prefix("governedConcept"));
    OntologyAttribute attribute = attribute();
    OntologyChangeOperation operation = operation(term, attribute);
    OntologyChangeSet changeSet = createChangeSet(client, glossary, operation, ns);
    OntologyEditLeaseToken lease = acquire(client, changeSet, ns.prefix("editorSession"));
    OntologyChangeSetCommand command = new OntologyChangeSetCommand().withLease(lease);

    OntologyChangeSet undone = client.ontologyChangeSets().undo(changeSet.getId(), command);
    OntologyChangeSet redone = client.ontologyChangeSets().redo(changeSet.getId(), command);
    OntologyChangeSet applied =
        client
            .ontologyChangeSets()
            .apply(changeSet.getId(), new ApplyOntologyChangeSet().withLease(lease));

    assertEquals(0, undone.getUndoCursor());
    assertEquals(1, redone.getUndoCursor());
    assertEquals(OntologyChangeSetState.APPLIED, applied.getState());
    assertEquals(1, applied.getApplicationResult().getOperationsApplied());
    GlossaryTerm updated = client.glossaryTerms().get(term.getId().toString(), "attributes");
    assertTrue(
        updated.getAttributes().stream()
            .anyMatch(value -> value.getId().equals(attribute.getId())));
    assertThrows(
        OpenMetadataException.class,
        () -> client.ontologyEditLocks().get(ONTOLOGY_CHANGE_SET, changeSet.getId()));
  }

  @Test
  void rejectsASecondEditorUntilTheActiveLeaseIsReleased(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    OntologyChangeSet changeSet = createChangeSet(client, glossary, null, ns);
    acquire(client, changeSet, ns.prefix("firstEditor"));

    AcquireOntologyEditLock competing = lockRequest(changeSet, ns.prefix("secondEditor"));

    assertThrows(OpenMetadataException.class, () -> client.ontologyEditLocks().acquire(competing));
  }

  @Test
  void appliedTermAppearsOnItsSourceMemory(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    ContextMemoryService memories = new ContextMemoryService(client.getHttpClient());
    ContextMemory memory =
        ns.trackRoot(
            "contextMemory",
            memories.create(
                new CreateContextMemory()
                    .withName(ns.prefix("revenueMemory"))
                    .withDescription("Subscription revenue definition")
                    .withQuestion("What is monthly recurring revenue?")
                    .withAnswer("Recurring subscription revenue in a month.")));
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    UUID termId = UUID.randomUUID();
    GlossaryTerm proposedTerm =
        new GlossaryTerm()
            .withId(termId)
            .withName(ns.prefix("monthlyRecurringRevenue"))
            .withDescription("Recurring subscription revenue in a month")
            .withGlossary(glossary.getEntityReference())
            .withVersion(0.1);
    OntologyChangeOperation operation =
        new OntologyChangeOperation()
            .withId(UUID.randomUUID())
            .withOperationType(OntologyChangeOperationType.CREATE_TERM)
            .withTerm(proposedTerm)
            .withSourceMemoryIds(Set.of(memory.getId()))
            .withState(OntologyChangeOperationState.ACTIVE);
    OntologyChangeSet changeSet = createChangeSet(client, glossary, operation, ns);

    OntologyMemoryProposalStatus proposalStatus =
        client
            .getHttpClient()
            .execute(
                HttpMethod.GET,
                "/v1/ontology/ai/memories/" + memory.getId() + "/proposals",
                null,
                OntologyMemoryProposalStatus.class);
    assertFalse(proposalStatus.getQueued());
    assertEquals(
        List.of(changeSet.getId()),
        proposalStatus.getProposals().stream()
            .map(proposal -> proposal.getChangeSet().getId())
            .toList());
    assertEquals(
        List.of(proposedTerm.getName()), proposalStatus.getProposals().getFirst().getTerms());
    assertFalse(proposalStatus.getEnabled());

    assertTrue(
        listOrEmpty(memories.get(memory.getId().toString(), "derivedEntities").getDerivedEntities())
            .isEmpty());

    OntologyEditLeaseToken lease = acquire(client, changeSet, ns.prefix("memoryEditor"));
    OntologyChangeSet applied =
        client
            .ontologyChangeSets()
            .apply(changeSet.getId(), new ApplyOntologyChangeSet().withLease(lease));

    assertEquals(OntologyChangeSetState.APPLIED, applied.getState());
    assertEquals(
        Set.of(memory.getId()), client.glossaryTerms().get(termId.toString()).getSourceMemoryIds());
    assertEquals(
        List.of(termId),
        memories.get(memory.getId().toString(), "derivedEntities").getDerivedEntities().stream()
            .map(ref -> ref.getId())
            .toList());
    assertTrue(
        client
            .getHttpClient()
            .execute(
                HttpMethod.GET,
                "/v1/ontology/ai/memories/" + memory.getId() + "/proposals",
                null,
                OntologyMemoryProposalStatus.class)
            .getProposals()
            .isEmpty());
  }

  @Test
  void rollsBackEveryMutationWhenALaterOperationFails(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTerm parent = createTerm(client, glossary, ns.prefix("atomicParent"));
    createChildTerm(client, glossary, parent, ns.prefix("atomicChild"));
    OntologyAttribute attribute = attribute();
    OntologyChangeOperation upsert = operation(parent, attribute);
    OntologyChangeOperation invalidDelete = deleteOperation(parent);
    OntologyChangeSet changeSet =
        createChangeSetWithOperations(client, glossary, List.of(upsert, invalidDelete), ns);
    OntologyEditLeaseToken lease = acquire(client, changeSet, ns.prefix("atomicEditor"));

    OntologyChangeSet failed =
        client
            .ontologyChangeSets()
            .apply(changeSet.getId(), new ApplyOntologyChangeSet().withLease(lease));

    assertEquals(OntologyChangeSetState.APPLY_FAILED, failed.getState());
    assertEquals(
        List.of(
            OntologyChangeOperationResultStatus.ROLLED_BACK,
            OntologyChangeOperationResultStatus.FAILED),
        failed.getApplicationResult().getResults().stream()
            .map(OntologyChangeOperationResult::getStatus)
            .toList());
    GlossaryTerm unchanged = client.glossaryTerms().get(parent.getId().toString(), "attributes");
    assertFalse(
        listOrEmpty(unchanged.getAttributes()).stream()
            .anyMatch(value -> value.getId().equals(attribute.getId())));
  }

  @Test
  void discardsADraftWhosePlannedGlossaryWasCreatedElsewhere(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    String glossaryName = ns.prefix("plannedGlossary");
    OntologyChangeSet changeSet =
        createNamedChangeSet(
            client,
            ns.prefix("plannedGlossaryDraft"),
            glossaryName,
            List.of(createGlossaryOperation(glossaryName)));
    ns.trackRoot(ONTOLOGY_CHANGE_SET, changeSet);
    Glossary claimed = GlossaryTestFactory.createWithName(ns, "plannedGlossary");
    OntologyEditLeaseToken lease = acquire(client, changeSet, ns.prefix("plannedEditor"));

    OntologyChangeSet failed =
        client
            .ontologyChangeSets()
            .apply(changeSet.getId(), new ApplyOntologyChangeSet().withLease(lease));
    OntologyChangeSet discarded =
        client
            .ontologyChangeSets()
            .discard(changeSet.getId(), new OntologyChangeSetCommand().withLease(lease));

    assertEquals(OntologyChangeSetState.APPLY_FAILED, failed.getState());
    assertEquals(OntologyChangeSetState.DISCARDED, discarded.getState());
    assertEquals(claimed.getId(), client.glossaries().getByName(glossaryName).getId());
  }

  @Test
  void applyFailsInsteadOfOverwritingATermThatAlreadyExists(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTerm existing = createTerm(client, glossary, ns.prefix("claimedTerm"));
    GlossaryTerm duplicate =
        new GlossaryTerm()
            .withId(UUID.randomUUID())
            .withName(existing.getName())
            .withDescription("A proposal drafted before the name was taken")
            .withGlossary(glossary.getEntityReference())
            .withVersion(0.1);
    OntologyChangeSet changeSet =
        createChangeSet(
            client,
            glossary,
            new OntologyChangeOperation()
                .withId(UUID.randomUUID())
                .withOperationType(OntologyChangeOperationType.CREATE_TERM)
                .withTerm(duplicate)
                .withState(OntologyChangeOperationState.ACTIVE),
            ns);
    OntologyEditLeaseToken lease = acquire(client, changeSet, ns.prefix("duplicateEditor"));

    OntologyChangeSet failed =
        client
            .ontologyChangeSets()
            .apply(changeSet.getId(), new ApplyOntologyChangeSet().withLease(lease));

    assertEquals(OntologyChangeSetState.APPLY_FAILED, failed.getState());
    assertEquals(
        existing.getDescription(),
        client.glossaryTerms().get(existing.getId().toString()).getDescription());
  }

  @Test
  void appliesADraftWhoseSourceMemoryWasDeleted(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    ContextMemoryService memories = new ContextMemoryService(client.getHttpClient());
    ContextMemory memory = memories.create(memoryRequest(ns.prefix("deletedSourceMemory")));
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    UUID termId = UUID.randomUUID();
    OntologyChangeSet changeSet =
        createChangeSet(client, glossary, termFromMemory(glossary, termId, memory, ns), ns);
    memories.delete(memory.getId().toString(), Map.of("hardDelete", "true"));
    OntologyEditLeaseToken lease = acquire(client, changeSet, ns.prefix("orphanEditor"));

    OntologyChangeSet applied =
        client
            .ontologyChangeSets()
            .apply(changeSet.getId(), new ApplyOntologyChangeSet().withLease(lease));

    assertEquals(OntologyChangeSetState.APPLIED, applied.getState());
    assertEquals(termId, client.glossaryTerms().get(termId.toString()).getId());
  }

  @Test
  void listsOnlyMemoryDraftsInTheRequestedStates(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    ContextMemoryService memories = new ContextMemoryService(client.getHttpClient());
    ContextMemory memory =
        ns.trackRoot("contextMemory", memories.create(memoryRequest(ns.prefix("listedMemory"))));
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    OntologyChangeSet memoryDraft =
        trackedNamedChangeSet(
            client,
            ns,
            "memoryDraft",
            glossary,
            List.of(termFromMemory(glossary, UUID.randomUUID(), memory, ns)));
    OntologyChangeSet manualDraft =
        trackedNamedChangeSet(client, ns, "manualDraft", glossary, List.of());
    OntologyChangeSet submittedMemoryDraft =
        trackedNamedChangeSet(
            client,
            ns,
            "submittedMemoryDraft",
            glossary,
            List.of(termFromMemory(glossary, UUID.randomUUID(), memory, ns)));
    OntologyEditLeaseToken lease =
        acquire(client, submittedMemoryDraft, ns.prefix("submittedEditor"));
    client
        .ontologyChangeSets()
        .submit(submittedMemoryDraft.getId(), new OntologyChangeSetCommand().withLease(lease));

    Set<UUID> drafts = listedIds(client, "memorySourced=true&state=DRAFT,SUBMITTED");
    Set<UUID> submitted = listedIds(client, "memorySourced=true&state=SUBMITTED");

    assertTrue(drafts.contains(memoryDraft.getId()));
    assertTrue(drafts.contains(submittedMemoryDraft.getId()));
    assertFalse(drafts.contains(manualDraft.getId()));
    assertTrue(submitted.contains(submittedMemoryDraft.getId()));
    assertFalse(submitted.contains(memoryDraft.getId()));

    int deletedEdges =
        TestSuiteBootstrap.getJdbi()
            .withHandle(
                handle ->
                    handle
                        .createUpdate(
                            "UPDATE entity_relationship SET deleted = TRUE "
                                + "WHERE fromId = :draftId AND toId = :memoryId "
                                + "AND fromEntity = 'ontologyChangeSet' "
                                + "AND toEntity = 'contextMemory'")
                        .bind("draftId", memoryDraft.getId().toString())
                        .bind("memoryId", memory.getId().toString())
                        .execute());
    assertEquals(1, deletedEdges);
    assertFalse(
        listedIds(client, "memorySourced=true&state=DRAFT,SUBMITTED")
            .contains(memoryDraft.getId()));
    OntologyChangeSetRepository repository =
        (OntologyChangeSetRepository) Entity.getEntityRepository(Entity.ONTOLOGY_CHANGE_SET);
    assertFalse(
        repository.findOpenBySourceMemoryId(memory.getId()).stream()
            .anyMatch(draft -> draft.getId().equals(memoryDraft.getId())));
  }

  private static Set<UUID> listedIds(OpenMetadataClient client, String query) {
    JsonNode page =
        client
            .getHttpClient()
            .execute(
                HttpMethod.GET, "/v1/ontologyChangeSets?limit=1000&" + query, null, JsonNode.class);
    Set<UUID> ids = new HashSet<>();
    page.path("data").forEach(changeSet -> ids.add(UUID.fromString(changeSet.path("id").asText())));
    return ids;
  }

  private static CreateContextMemory memoryRequest(String name) {
    return new CreateContextMemory()
        .withName(name)
        .withDescription("Memory behind an ontology draft")
        .withQuestion("What is an active subscriber?")
        .withAnswer("A customer with a paid subscription this month.");
  }

  private static OntologyChangeOperation termFromMemory(
      Glossary glossary, UUID termId, ContextMemory memory, TestNamespace ns) {
    return new OntologyChangeOperation()
        .withId(UUID.randomUUID())
        .withOperationType(OntologyChangeOperationType.CREATE_TERM)
        .withTerm(
            new GlossaryTerm()
                .withId(termId)
                .withName(ns.prefix("memoryTerm") + "_" + termId.toString().substring(0, 8))
                .withDescription("A customer with a paid subscription this month")
                .withGlossary(glossary.getEntityReference())
                .withVersion(0.1))
        .withSourceMemoryIds(Set.of(memory.getId()))
        .withState(OntologyChangeOperationState.ACTIVE);
  }

  private static OntologyChangeOperation createGlossaryOperation(String glossaryName) {
    return new OntologyChangeOperation()
        .withId(UUID.randomUUID())
        .withOperationType(OntologyChangeOperationType.CREATE_GLOSSARY)
        .withGlossary(
            new Glossary()
                .withId(UUID.randomUUID())
                .withName(glossaryName)
                .withFullyQualifiedName(glossaryName)
                .withDisplayName("Planned glossary")
                .withDescription("A glossary a memory draft plans to create")
                .withVersion(0.1))
        .withState(OntologyChangeOperationState.ACTIVE);
  }

  private static OntologyChangeSet trackedNamedChangeSet(
      OpenMetadataClient client,
      TestNamespace ns,
      String name,
      Glossary glossary,
      List<OntologyChangeOperation> operations) {
    return ns.trackRoot(
        ONTOLOGY_CHANGE_SET,
        createNamedChangeSet(
            client, ns.prefix(name), glossary.getFullyQualifiedName(), operations));
  }

  private static OntologyChangeSet createNamedChangeSet(
      OpenMetadataClient client,
      String name,
      String glossaryFqn,
      List<OntologyChangeOperation> operations) {
    return client
        .ontologyChangeSets()
        .create(
            new CreateOntologyChangeSet()
                .withName(name)
                .withDisplayName("Ontology draft")
                .withDescription("Ontology draft under review")
                .withGlossaries(Set.of(glossaryFqn))
                .withOperations(operations)
                .withUndoCursor(operations.size()));
  }

  private static GlossaryTerm createTerm(
      OpenMetadataClient client, Glossary glossary, String name) {
    return client
        .glossaryTerms()
        .create(
            new CreateGlossaryTerm()
                .withName(name)
                .withDescription("Concept governed through an ontology change set")
                .withGlossary(glossary.getFullyQualifiedName())
                .withIri(URI.create("https://example.org/change-set/" + name)));
  }

  private static GlossaryTerm createChildTerm(
      OpenMetadataClient client, Glossary glossary, GlossaryTerm parent, String name) {
    return client
        .glossaryTerms()
        .create(
            new CreateGlossaryTerm()
                .withName(name)
                .withDescription("Child concept that blocks a non-recursive delete")
                .withGlossary(glossary.getFullyQualifiedName())
                .withParent(parent.getFullyQualifiedName())
                .withIri(URI.create("https://example.org/change-set/" + name)));
  }

  private static OntologyAttribute attribute() {
    return new OntologyAttribute()
        .withId(UUID.randomUUID())
        .withName("regulatoryCode")
        .withIri(URI.create("https://example.org/change-set/regulatoryCode"))
        .withDataType(OntologyAttributeDataType.STRING)
        .withIsIdentifier(false);
  }

  private static OntologyChangeOperation operation(GlossaryTerm term, OntologyAttribute attribute) {
    return new OntologyChangeOperation()
        .withId(UUID.randomUUID())
        .withOperationType(OntologyChangeOperationType.UPSERT_ATTRIBUTE)
        .withTargetId(term.getId())
        .withBaseVersion(term.getVersion())
        .withAttribute(attribute)
        .withState(OntologyChangeOperationState.ACTIVE);
  }

  private static OntologyChangeOperation deleteOperation(GlossaryTerm term) {
    return new OntologyChangeOperation()
        .withId(UUID.randomUUID())
        .withOperationType(OntologyChangeOperationType.DELETE_TERM)
        .withTargetId(term.getId())
        .withBaseVersion(term.getVersion())
        .withState(OntologyChangeOperationState.ACTIVE);
  }

  private static OntologyChangeSet createChangeSet(
      OpenMetadataClient client,
      Glossary glossary,
      OntologyChangeOperation operation,
      TestNamespace ns) {
    List<OntologyChangeOperation> operations = operation == null ? List.of() : List.of(operation);
    return createChangeSetWithOperations(client, glossary, operations, ns);
  }

  private static OntologyChangeSet createChangeSetWithOperations(
      OpenMetadataClient client,
      Glossary glossary,
      List<OntologyChangeOperation> operations,
      TestNamespace ns) {
    CreateOntologyChangeSet request =
        new CreateOntologyChangeSet()
            .withName(ns.prefix("ontologyDraft"))
            .withDisplayName("Ontology draft")
            .withDescription("Concurrent-safe ontology authoring draft")
            .withGlossaries(Set.of(glossary.getFullyQualifiedName()))
            .withOperations(operations)
            .withUndoCursor(operations.size());
    OntologyChangeSet changeSet = client.ontologyChangeSets().create(request);
    return ns.trackRoot(ONTOLOGY_CHANGE_SET, changeSet);
  }

  private static OntologyEditLeaseToken acquire(
      OpenMetadataClient client, OntologyChangeSet changeSet, String sessionId) {
    OntologyEditLock lock = client.ontologyEditLocks().acquire(lockRequest(changeSet, sessionId));
    return new OntologyEditLeaseToken()
        .withSessionId(lock.getSessionId())
        .withVersion(lock.getVersion());
  }

  private static AcquireOntologyEditLock lockRequest(
      OntologyChangeSet changeSet, String sessionId) {
    return new AcquireOntologyEditLock()
        .withResourceType(ONTOLOGY_CHANGE_SET)
        .withResourceId(changeSet.getId())
        .withSessionId(OntologyChangeSetTestSupport.boundedSessionId(sessionId))
        .withLeaseSeconds(60);
  }
}
