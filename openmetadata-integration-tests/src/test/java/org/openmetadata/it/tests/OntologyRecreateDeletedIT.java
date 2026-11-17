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

import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.AcquireOntologyEditLock;
import org.openmetadata.schema.api.data.ApplyOntologyChangeSet;
import org.openmetadata.schema.api.data.CreateOntologyChangeSet;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyChangeSet;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.type.OntologyChangeOperation;
import org.openmetadata.schema.type.OntologyChangeOperationState;
import org.openmetadata.schema.type.OntologyChangeOperationType;
import org.openmetadata.schema.type.OntologyConceptType;
import org.openmetadata.schema.type.OntologyEditLeaseToken;
import org.openmetadata.sdk.exceptions.OpenMetadataException;

/** Re-creating a name held only by a soft-deleted definition restores that definition alone. */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class OntologyRecreateDeletedIT extends BaseOntologyApprovalIT {
  private static final URI PATIENT = URI.create("https://example.org/model/Patient");

  @Test
  void recreatedOntologyComesBackEmptyUntilItIsRestored(final TestNamespace ns) {
    final var ontologies = SdkClients.adminClient().ontologies();
    final Ontology ontology = createOntology(ns, "recreatedOntology");
    final String conceptId = declareClass(ontology, "Patient", PATIENT).getId().toString();
    capture(ontology);
    ontologies.delete(ontology.getId().toString(), Map.of("recursive", "true"));

    final Ontology recreated =
        ontologies.create(
            request(ns).withName(ontology.getName()).withDescription("Re-created ontology"));

    assertEquals(ontology.getId(), recreated.getId());
    assertFalse(recreated.getDeleted());
    assertEquals("Re-created ontology", recreated.getDescription());
    assertEquals(404, conceptLookupStatus(conceptId));

    ontologies.restore(ontology.getId());

    assertFalse(SdkClients.adminClient().ontologyConcepts().get(conceptId).getDeleted());
    assertEquals(
        "Re-created ontology", ontologies.get(ontology.getId().toString()).getDescription());
  }

  @Test
  void changeSetUpsertRestoresADeletedConceptWithTheNewValues(final TestNamespace ns) {
    final var concepts = SdkClients.adminClient().ontologyConcepts();
    final Ontology ontology = createOntology(ns, "changeSetOntology");
    final OntologyConcept deleted = declareClass(ontology, "Patient", PATIENT);
    concepts.delete(deleted.getId().toString());

    apply(
        draft(
            ns,
            ontology,
            new OntologyConcept()
                .withId(UUID.randomUUID())
                .withName("Patient")
                .withFullyQualifiedName(ontology.getFullyQualifiedName() + ".Patient")
                .withOntology(ontology.getEntityReference())
                .withIri(PATIENT)
                .withDescription("A person receiving care")
                .withConceptType(OntologyConceptType.OWL_CLASS)
                .withVersion(0.1)));

    final OntologyConcept restored = concepts.get(deleted.getId().toString());
    assertFalse(restored.getDeleted());
    assertEquals("A person receiving care", restored.getDescription());
  }

  private static int conceptLookupStatus(final String id) {
    final OpenMetadataException missing =
        assertThrows(
            OpenMetadataException.class, () -> SdkClients.adminClient().ontologyConcepts().get(id));
    assertTrue(SdkClients.adminClient().ontologyConcepts().get(id, null, "deleted").getDeleted());
    return missing.getStatusCode();
  }

  private static OntologyChangeSet draft(
      final TestNamespace ns, final Ontology ontology, final OntologyConcept concept) {
    final var client = SdkClients.adminClient();
    final OntologyChangeOperation upsert =
        new OntologyChangeOperation()
            .withId(UUID.randomUUID())
            .withOperationType(OntologyChangeOperationType.UPSERT_CONCEPT)
            .withState(OntologyChangeOperationState.ACTIVE)
            .withConcept(concept);
    return ns.trackRoot(
        "ontologyChangeSet",
        client
            .ontologyChangeSets()
            .create(
                new CreateOntologyChangeSet()
                    .withName(ns.prefix("recreate") + UUID.randomUUID())
                    .withDisplayName("Re-create a deleted concept")
                    .withDescription("Restates a concept that was deleted")
                    .withOntology(ontology.getFullyQualifiedName())
                    .withBaseWorkingRevision(
                        client.ontologies().state(ontology.getId()).getWorkingRevision())
                    .withOperations(List.of(upsert))));
  }

  private static void apply(final OntologyChangeSet draft) {
    final var client = SdkClients.adminClient();
    final var lease =
        client
            .ontologyEditLocks()
            .acquire(
                new AcquireOntologyEditLock()
                    .withResourceType("ontologyChangeSet")
                    .withResourceId(draft.getId())
                    .withSessionId(UUID.randomUUID().toString())
                    .withLeaseSeconds(60));
    client
        .ontologyChangeSets()
        .apply(
            draft.getId(),
            new ApplyOntologyChangeSet()
                .withLease(
                    new OntologyEditLeaseToken()
                        .withSessionId(lease.getSessionId())
                        .withVersion(lease.getVersion())));
  }
}
