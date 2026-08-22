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

import java.net.URI;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.GlossaryTestFactory;
import org.openmetadata.it.util.NamespaceCleanup;
import org.openmetadata.it.util.OntologyChangeSetTestSupport;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.AcquireOntologyEditLock;
import org.openmetadata.schema.api.data.ApplyOntologyChangeSet;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.CreateOntologyChangeSet;
import org.openmetadata.schema.api.data.OntologyChangeSetCommand;
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
