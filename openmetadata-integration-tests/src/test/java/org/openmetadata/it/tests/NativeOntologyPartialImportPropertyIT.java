package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

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
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.type.OntologyChangeOperation;
import org.openmetadata.schema.type.OntologyChangeSetState;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.ListParams;

/** A partial import never leaves a property whose domain or range is a concept that was not kept. */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class NativeOntologyPartialImportPropertyIT extends BaseOntologyApprovalIT {
  private static final String MODEL =
      """
      @prefix owl: <http://www.w3.org/2002/07/owl#> .
      @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
      @prefix ex: <https://example.org/partialProperty/%s/> .
      ex:Account a owl:Class ; rdfs:label "Account" .
      ex:Ledger a owl:Class ; rdfs:label "Ledger" .
      ex:owns a owl:ObjectProperty ; rdfs:label "owns" ; rdfs:domain ex:Account ; rdfs:range ex:Ledger .
      """;

  @Test
  void anAppliedPropertyWhoseDomainConceptWasLeftOutIsRefusedNamingTheOperationAndConcept(
      TestNamespace ns) {
    final var client = SdkClients.adminClient();
    final Ontology ontology = createOntology(ns, "propRefused");
    final NativeOntologyImportPreview preview =
        client.ontologies().previewImport(ontology.getId(), file(ns));
    final UUID property = operationOf(preview, "owns");

    final var chosen =
        preview.getChangeSet().getOperations().stream()
            .filter(operation -> !operation.getId().equals(operationOf(preview, "Account")))
            .toList();
    final OpenMetadataException refusal =
        assertThrows(OpenMetadataException.class, () -> apply(ns, ontology, preview, chosen, "r"));

    assertEquals(400, refusal.getStatusCode());
    assertTrue(refusal.getMessage().contains(property.toString()), refusal.getMessage());
    assertTrue(
        refusal
            .getMessage()
            .contains("https://example.org/partialProperty/" + ns.shortPrefix() + "/Account"),
        refusal.getMessage());
    assertEquals(Set.of(), conceptNames(ontology));
  }

  @Test
  void droppingThePropertyWithItsConceptOrKeepingEverythingApplies(TestNamespace ns) {
    final var client = SdkClients.adminClient();
    final Ontology ontology = createOntology(ns, "propAccepted");
    final NativeOntologyImportPreview preview =
        client.ontologies().previewImport(ontology.getId(), file(ns));
    final UUID account = operationOf(preview, "Account");
    final UUID property = operationOf(preview, "owns");

    final var chosen =
        preview.getChangeSet().getOperations().stream()
            .filter(
                operation ->
                    !operation.getId().equals(account) && !operation.getId().equals(property))
            .toList();
    apply(ns, ontology, preview, chosen, "dropBoth");
    assertEquals(Set.of("Ledger"), conceptNames(ontology));
    assertEquals(Set.of(), propertyNames(ontology));

    final Ontology whole = createOntology(ns, "propWhole");
    final NativeOntologyImportPreview all =
        client.ontologies().previewImport(whole.getId(), file(ns));
    apply(ns, whole, all, all.getChangeSet().getOperations(), "keepAll");
    assertEquals(Set.of("Account", "Ledger"), conceptNames(whole));
    assertEquals(Set.of("owns"), propertyNames(whole));
  }

  private static Set<String> propertyNames(Ontology ontology) {
    return SdkClients.adminClient()
        .ontologyProperties()
        .list(new ListParams().addFilter("ontology", ontology.getFullyQualifiedName()))
        .getData()
        .stream()
        .map(OntologyProperty::getName)
        .collect(Collectors.toSet());
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
