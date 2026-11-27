package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.OntologyChangeSetTestSupport;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.NativeOntologyImportFormat;
import org.openmetadata.schema.api.data.NativeOntologyImportItem;
import org.openmetadata.schema.api.data.NativeOntologyImportPreview;
import org.openmetadata.schema.api.data.PreviewNativeOntologyImport;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.type.OntologyChangeOperation;
import org.openmetadata.schema.type.OntologyChangeSetState;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.ListParams;

/** A partial import never leaves a relationship or rule pointing at a concept that was not kept. */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class NativeOntologyPartialImportIT extends BaseOntologyApprovalIT {
  private static final String MODEL =
      """
      @prefix owl: <http://www.w3.org/2002/07/owl#> .
      @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
      @prefix ex: <https://example.org/partial/%s/> .
      ex:Account a owl:Class ; rdfs:label "Account" .
      ex:Ledger a owl:Class ; rdfs:label "Ledger" .
      ex:Ledger rdfs:subClassOf ex:Account .
      """;

  private static final String INDIVIDUAL_MODEL =
      """
      @prefix owl: <http://www.w3.org/2002/07/owl#> .
      @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
      @prefix ex: <https://example.org/partial/%s/> .
      ex:A a owl:Class ; rdfs:label "A" .
      ex:owns a owl:ObjectProperty ; rdfs:label "owns" .
      ex:i a owl:Class, owl:NamedIndividual ; rdfs:label "i" .
      ex:A rdfs:subClassOf [ a owl:Restriction ; owl:onProperty ex:owns ; owl:hasValue ex:i ] .
      """;

  @Test
  void anAppliedRelationshipWhoseConceptWasLeftOutIsRefusedNamingTheOperationAndConcept(
      TestNamespace ns) {
    final var client = SdkClients.adminClient();
    final Ontology ontology = createOntology(ns, "partialRefused");
    final NativeOntologyImportPreview preview =
        client.ontologies().previewImport(ontology.getId(), file(ns));
    final UUID relationship = operationOf(preview, "Ledger is a kind of Account");

    final var chosen =
        preview.getChangeSet().getOperations().stream()
            .filter(operation -> !operation.getId().equals(operationOf(preview, "Account")))
            .toList();
    final OpenMetadataException refusal =
        assertThrows(OpenMetadataException.class, () -> apply(ns, ontology, preview, chosen, "r"));

    assertEquals(400, refusal.getStatusCode());
    assertTrue(refusal.getMessage().contains(relationship.toString()), refusal.getMessage());
    assertTrue(
        refusal
            .getMessage()
            .contains("https://example.org/partial/" + ns.shortPrefix() + "/Account"),
        refusal.getMessage());
    assertEquals(Set.of(), conceptNames(ontology));
  }

  @Test
  void aClientThatDropsRequiresConceptIrisStillCannotLeaveAConceptBehind(TestNamespace ns) {
    final var client = SdkClients.adminClient();
    final Ontology ontology = createOntology(ns, "partialNoDeclaredNeeds");
    final NativeOntologyImportPreview preview =
        client.ontologies().previewImport(ontology.getId(), file(ns));
    final UUID relationship = operationOf(preview, "Ledger is a kind of Account");
    final UUID account = operationOf(preview, "Account");

    final var chosen =
        preview.getChangeSet().getOperations().stream()
            .filter(operation -> !operation.getId().equals(account))
            .map(operation -> operation.withRequiresConceptIris(null))
            .toList();
    final OpenMetadataException refusal =
        assertThrows(
            OpenMetadataException.class, () -> apply(ns, ontology, preview, chosen, "noNeeds"));

    assertEquals(400, refusal.getStatusCode());
    assertTrue(refusal.getMessage().contains(relationship.toString()), refusal.getMessage());
    assertTrue(
        refusal
            .getMessage()
            .contains("https://example.org/partial/" + ns.shortPrefix() + "/Account"),
        refusal.getMessage());
    assertEquals(Set.of(), conceptNames(ontology));
  }

  @Test
  void aRestrictionWhoseImportedIndividualWasLeftOutIsRefusedUnlessTheIndividualIsKept(
      TestNamespace ns) {
    final var client = SdkClients.adminClient();
    final Ontology ontology = createOntology(ns, "partialIndividual");
    final String individual = "https://example.org/partial/" + ns.shortPrefix() + "/i";
    final NativeOntologyImportPreview preview =
        client
            .ontologies()
            .previewImport(
                ontology.getId(),
                new PreviewNativeOntologyImport()
                    .withFormat(NativeOntologyImportFormat.TURTLE)
                    .withData(INDIVIDUAL_MODEL.formatted(ns.shortPrefix())));
    final UUID individualConcept = operationOf(preview, "i");
    final UUID restriction =
        preview.getSummary().getItems().stream()
            .filter(item -> item.getDependsOnIris().contains(java.net.URI.create(individual)))
            .map(NativeOntologyImportItem::getOperationId)
            .findFirst()
            .orElseThrow();

    final var everything = List.copyOf(preview.getChangeSet().getOperations());
    final var withoutIndividual =
        everything.stream()
            .filter(operation -> !operation.getId().equals(individualConcept))
            .toList();
    final OpenMetadataException refusal =
        assertThrows(
            OpenMetadataException.class,
            () -> apply(ns, ontology, preview, withoutIndividual, "noIndividual"));

    assertEquals(400, refusal.getStatusCode());
    assertTrue(refusal.getMessage().contains(restriction.toString()), refusal.getMessage());
    assertTrue(refusal.getMessage().contains(individual), refusal.getMessage());
    assertEquals(Set.of(), conceptNames(ontology));

    apply(ns, ontology, preview, everything, "withIndividual");
    assertTrue(conceptNames(ontology).contains("i"), conceptNames(ontology).toString());
  }

  @Test
  void droppingTheRelationshipWithItsConceptOrKeepingEverythingApplies(TestNamespace ns) {
    final var client = SdkClients.adminClient();
    final Ontology ontology = createOntology(ns, "partialAccepted");
    final NativeOntologyImportPreview preview =
        client.ontologies().previewImport(ontology.getId(), file(ns));
    final UUID account = operationOf(preview, "Account");
    final UUID relationship = operationOf(preview, "Ledger is a kind of Account");

    final var chosen =
        preview.getChangeSet().getOperations().stream()
            .filter(
                operation ->
                    !operation.getId().equals(account) && !operation.getId().equals(relationship))
            .toList();
    apply(ns, ontology, preview, chosen, "dropBoth");
    assertEquals(Set.of("Ledger"), conceptNames(ontology));

    final Ontology whole = createOntology(ns, "partialWhole");
    final NativeOntologyImportPreview all =
        client.ontologies().previewImport(whole.getId(), file(ns));
    apply(ns, whole, all, all.getChangeSet().getOperations(), "keepAll");
    assertEquals(Set.of("Account", "Ledger"), conceptNames(whole));
    assertTrue(
        client
            .ontologyAxioms()
            .list(new ListParams().addFilter("ontologyId", whole.getId().toString()))
            .getData()
            .stream()
            .anyMatch(axiom -> axiom.getSubjectIri().toString().endsWith("/Ledger")));
  }

  @Test
  void aRelationshipMayUseAConceptThatAlreadyExists(TestNamespace ns) {
    final var client = SdkClients.adminClient();
    final Ontology ontology = createOntology(ns, "partialExisting");
    final NativeOntologyImportPreview first =
        client.ontologies().previewImport(ontology.getId(), file(ns));
    final UUID ledger = operationOf(first, "Ledger");
    final UUID relationship = operationOf(first, "Ledger is a kind of Account");
    apply(
        ns,
        ontology,
        first,
        first.getChangeSet().getOperations().stream()
            .filter(op -> !op.getId().equals(ledger) && !op.getId().equals(relationship))
            .toList(),
        "accountFirst");

    final NativeOntologyImportPreview second =
        client.ontologies().previewImport(ontology.getId(), file(ns));
    apply(ns, ontology, second, second.getChangeSet().getOperations(), "restOfIt");

    assertEquals(Set.of("Account", "Ledger"), conceptNames(ontology));
  }

  private static UUID operationOf(NativeOntologyImportPreview preview, String label) {
    return preview.getSummary().getItems().stream()
        .filter(item -> item.getLabel().equals(label))
        .map(NativeOntologyImportItem::getOperationId)
        .findFirst()
        .orElseThrow();
  }

  private static Set<String> conceptNames(Ontology ontology) {
    return SdkClients.adminClient()
        .ontologyConcepts()
        .list(new ListParams().addFilter("ontology", ontology.getFullyQualifiedName()))
        .getData()
        .stream()
        .map(OntologyConcept::getName)
        .collect(Collectors.toSet());
  }

  private static void apply(
      TestNamespace ns,
      Ontology ontology,
      NativeOntologyImportPreview preview,
      java.util.List<OntologyChangeOperation> chosen,
      String name) {
    final var client = SdkClients.adminClient();
    final var draft =
        ns.trackRoot(
            "ontologyChangeSet",
            client
                .ontologyChangeSets()
                .create(
                    preview
                        .getChangeSet()
                        .withName(ns.prefix(name))
                        .withOperations(chosen)
                        .withUndoCursor(chosen.size())));
    assertEquals(
        OntologyChangeSetState.APPLIED,
        OntologyChangeSetTestSupport.applyOntologyChangeSet(client, draft, ns, name + "Editor")
            .getState());
  }

  private static PreviewNativeOntologyImport file(TestNamespace ns) {
    return new PreviewNativeOntologyImport()
        .withFormat(NativeOntologyImportFormat.TURTLE)
        .withData(MODEL.formatted(ns.shortPrefix()));
  }
}
