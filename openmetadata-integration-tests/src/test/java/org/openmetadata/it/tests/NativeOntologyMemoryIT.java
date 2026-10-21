package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.context.CreateContextMemory;
import org.openmetadata.schema.api.data.AcquireOntologyEditLock;
import org.openmetadata.schema.api.data.ApplyOntologyChangeSet;
import org.openmetadata.schema.api.data.CreateOntologyChangeSet;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.entity.data.OntologyChangeSet;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.type.OntologyAxiomType;
import org.openmetadata.schema.type.OntologyChangeOperation;
import org.openmetadata.schema.type.OntologyChangeOperationState;
import org.openmetadata.schema.type.OntologyChangeOperationType;
import org.openmetadata.schema.type.OntologyChangeSetState;
import org.openmetadata.schema.type.OntologyConceptType;
import org.openmetadata.schema.type.OntologyEditLeaseToken;
import org.openmetadata.schema.type.OntologyExpression;
import org.openmetadata.schema.type.OntologyExpressionKind;
import org.openmetadata.schema.type.OntologyPropertyKind;
import org.openmetadata.schema.type.RelationProvenance;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.services.context.ContextMemoryService;

@ExtendWith(TestNamespaceExtension.class)
class NativeOntologyMemoryIT extends BaseOntologyApprovalIT {
  @Test
  void reviewedMemoryDraftsApplyDefinitionsAndAreIncludedInTheNextCapture(TestNamespace ns) {
    final var client = SdkClients.adminClient();
    final Ontology ontology =
        ns.trackRoot(
            "ontology",
            client
                .ontologies()
                .create(
                    request(ns)
                        .withOwners(List.of(SharedEntities.get().USER2.getEntityReference()))));
    final var memories = new ContextMemoryService(client.getHttpClient());
    final var memory =
        ns.trackRoot(
            "contextMemory",
            memories.create(
                new CreateContextMemory()
                    .withName(ns.prefix("memory"))
                    .withQuestion("Who is a customer?")
                    .withAnswer("A customer is a party.")
                    .withEntityStatus(ContextMemoryStatus.APPROVED)));
    final var customer = concept(ontology, "Customer");
    final var party = concept(ontology, "Party");
    final var property =
        new OntologyProperty()
            .withId(UUID.randomUUID())
            .withName("knows")
            .withFullyQualifiedName(ontology.getFullyQualifiedName() + ".knows")
            .withOntology(ontology.getEntityReference())
            .withIri(URI.create("urn:knows"))
            .withKind(OntologyPropertyKind.OBJECT)
            .withDomain(List.of(customer.getIri()))
            .withRange(List.of(party.getIri()))
            .withVersion(0.1);
    final var axiom = axiom(ontology, customer, party);
    final var operations =
        List.of(
            upsert(customer),
            upsert(party),
            operation(OntologyChangeOperationType.UPSERT_PROPERTY).withProperty(property),
            operation(OntologyChangeOperationType.UPSERT_AXIOM).withAxiom(axiom));
    operations.forEach(operation -> operation.setSourceMemoryIds(Set.of(memory.getId())));
    final var draft = draft(ns, ontology, operations);
    final var applied = apply(draft, SdkClients.user2Client());
    assertEquals(OntologyChangeSetState.APPLIED, applied.getState());
    assertEquals(4, applied.getApplicationResult().getOperationsApplied());
    assertEquals(5, capture(ontology).getMemberCount());
    assertEquals(
        4, memories.get(memory.getId().toString(), "derivedEntities").getDerivedEntities().size());

    final var updated = client.ontologyConcepts().get(customer.getId().toString());
    updated.setDescription("A party buying products");
    final var changes =
        List.of(
            upsert(updated).withTargetId(updated.getId()).withBaseVersion(updated.getVersion()),
            operation(OntologyChangeOperationType.DELETE_AXIOM)
                .withTargetId(axiom.getId())
                .withBaseVersion(0.1),
            operation(OntologyChangeOperationType.DELETE_PROPERTY)
                .withTargetId(property.getId())
                .withBaseVersion(0.1),
            operation(OntologyChangeOperationType.DELETE_CONCEPT)
                .withTargetId(party.getId())
                .withBaseVersion(0.1));
    assertEquals(
        OntologyChangeSetState.APPLIED,
        apply(draft(ns, ontology, changes), SdkClients.user2Client()).getState());
    assertEquals(
        "A party buying products",
        client.ontologyConcepts().get(customer.getId().toString()).getDescription());
    assertEquals(2, capture(ontology).getMemberCount());
  }

  @Test
  void invalidFinalModelRollsBackTheWholeDraft(TestNamespace ns) {
    final var ontology = createOntology(ns);
    final var first = concept(ontology, "First");
    final var second = concept(ontology, "Second");
    final var draft =
        draft(
            ns,
            ontology,
            List.of(
                upsert(first),
                upsert(second),
                operation(OntologyChangeOperationType.UPSERT_AXIOM)
                    .withAxiom(axiom(ontology, first, second)),
                operation(OntologyChangeOperationType.UPSERT_AXIOM)
                    .withAxiom(axiom(ontology, second, first))));
    final long revision =
        SdkClients.adminClient().ontologies().state(ontology.getId()).getWorkingRevision();
    assertThrows(OpenMetadataException.class, () -> apply(draft));
    assertEquals(
        revision,
        SdkClients.adminClient().ontologies().state(ontology.getId()).getWorkingRevision());
    assertEquals(1, capture(ontology).getMemberCount());
    assertEquals(
        OntologyChangeSetState.DRAFT,
        SdkClients.adminClient().ontologyChangeSets().get(draft.getId().toString()).getState());
  }

  @Test
  void staleDraftsCannotOverwriteWorkingEdits(TestNamespace ns) {
    final var ontology = createOntology(ns);
    final var draft = draft(ns, ontology, List.of(upsert(concept(ontology, "Proposed"))));
    declareClass(ontology, "Concurrent", URI.create("urn:Concurrent"));
    assertEquals(
        412, assertThrows(OpenMetadataException.class, () -> apply(draft)).getStatusCode());
    assertEquals(2, capture(ontology).getMemberCount());
  }

  @Test
  void readersCannotProposeNativeDefinitionWrites(TestNamespace ns) {
    final var ontology = createOntology(ns);
    final var request = request(ns, ontology, List.of(upsert(concept(ontology, "Denied"))));
    assertEquals(
        403,
        assertThrows(
                OpenMetadataException.class,
                () -> SdkClients.user2Client().ontologyChangeSets().create(request))
            .getStatusCode());
    assertTrue(
        SdkClients.adminClient().ontologies().state(ontology.getId()).getWorkingRevision() > 0);
  }

  private static OntologyConcept concept(Ontology ontology, String name) {
    return new OntologyConcept()
        .withId(UUID.randomUUID())
        .withName(name)
        .withFullyQualifiedName(ontology.getFullyQualifiedName() + "." + name)
        .withOntology(ontology.getEntityReference())
        .withIri(URI.create("urn:" + name))
        .withConceptType(OntologyConceptType.OWL_CLASS)
        .withVersion(0.1);
  }

  private static OntologyAxiom axiom(
      Ontology ontology, OntologyConcept child, OntologyConcept parent) {
    return new OntologyAxiom()
        .withId(UUID.randomUUID())
        .withName(child.getName() + "Is" + parent.getName())
        .withFullyQualifiedName(
            ontology.getFullyQualifiedName() + "." + child.getName() + "Is" + parent.getName())
        .withDisplayName("Subclass")
        .withDescription("A named subclass assertion")
        .withProvenance(RelationProvenance.MANUAL)
        .withOntology(ontology.getEntityReference())
        .withAxiomType(OntologyAxiomType.SUBCLASS_OF)
        .withSubjectIri(child.getIri())
        .withExpressions(
            List.of(
                new OntologyExpression()
                    .withKind(OntologyExpressionKind.NAMED_CLASS)
                    .withClassIri(parent.getIri())))
        .withVersion(0.1);
  }

  private static OntologyChangeOperation upsert(OntologyConcept concept) {
    return operation(OntologyChangeOperationType.UPSERT_CONCEPT).withConcept(concept);
  }

  private static OntologyChangeOperation operation(OntologyChangeOperationType type) {
    return new OntologyChangeOperation()
        .withId(UUID.randomUUID())
        .withOperationType(type)
        .withState(OntologyChangeOperationState.ACTIVE);
  }

  private static CreateOntologyChangeSet request(
      TestNamespace ns, Ontology ontology, List<OntologyChangeOperation> operations) {
    return new CreateOntologyChangeSet()
        .withName(ns.prefix("draft") + UUID.randomUUID())
        .withDisplayName("Native memory proposal")
        .withDescription("Definitions proposed from reviewed context memories")
        .withOntology(ontology.getFullyQualifiedName())
        .withBaseWorkingRevision(
            SdkClients.adminClient().ontologies().state(ontology.getId()).getWorkingRevision())
        .withOperations(operations);
  }

  private static OntologyChangeSet draft(
      TestNamespace ns, Ontology ontology, List<OntologyChangeOperation> operations) {
    return ns.trackRoot(
        "ontologyChangeSet",
        SdkClients.adminClient().ontologyChangeSets().create(request(ns, ontology, operations)));
  }

  private static OntologyChangeSet apply(OntologyChangeSet draft) {
    return apply(draft, SdkClients.adminClient());
  }

  private static OntologyChangeSet apply(OntologyChangeSet draft, OpenMetadataClient client) {
    final var lease =
        client
            .ontologyEditLocks()
            .acquire(
                new AcquireOntologyEditLock()
                    .withResourceType("ontologyChangeSet")
                    .withResourceId(draft.getId())
                    .withSessionId(UUID.randomUUID().toString())
                    .withLeaseSeconds(60));
    return client
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
