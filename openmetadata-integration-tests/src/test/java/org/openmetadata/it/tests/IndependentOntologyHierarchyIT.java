package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.util.Arrays;
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
import org.openmetadata.schema.api.data.CreateOntologyAxiom;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.type.OntologyAxiomType;
import org.openmetadata.schema.type.OntologyConceptType;
import org.openmetadata.schema.type.OntologyExpression;
import org.openmetadata.schema.type.OntologyExpressionKind;
import org.openmetadata.schema.type.RelationProvenance;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.ListParams;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class IndependentOntologyHierarchyIT extends BaseOntologyApprovalIT {
  @Test
  void hierarchyReadsAndDeletionGuardsFollowTheStoredAxioms(TestNamespace ns) {
    final var ontology = createOntology(ns);
    final var customer = declareClass(ontology, "Customer", URI.create("urn:Customer"));
    final var party = declareClass(ontology, "Party", URI.create("urn:Party"));
    final var legal = declareClass(ontology, "LegalEntity", URI.create("urn:LegalEntity"));
    final var client = SdkClients.adminClient();
    final var concepts = client.ontologyConcepts();
    final var axiom =
        client.ontologyAxioms().create(subclass(customer, party.getIri(), legal.getIri()));
    final var revision = client.ontologies().state(ontology.getId()).getWorkingRevision();
    assertFalse(client.ontologyAxioms().validate(subclass(party, customer.getIri())).getValid());
    assertFalse(
        client.ontologyAxioms().validate(subclass(customer, URI.create("urn:Unknown"))).getValid());
    assertTrue(client.ontologyAxioms().validate(subclass(customer, party.getIri())).getValid());
    assertEquals(revision, client.ontologies().state(ontology.getId()).getWorkingRevision());
    assertEquals(
        List.of(legal.getIri(), party.getIri()),
        concepts.get(customer.getId().toString(), "superClasses").getSuperClasses());
    assertEquals(
        List.of(customer.getIri()),
        concepts.get(party.getId().toString(), "subClasses").getSubClasses());
    final var page =
        concepts.list(
            new ListParams()
                .setFields("superClasses,subClasses")
                .addFilter("ontology", ontology.getFullyQualifiedName()));
    assertEquals(
        2, page.getData().stream().filter(value -> !value.getSubClasses().isEmpty()).count());
    for (boolean hard : List.of(false, true)) {
      assertBadRequest(
          () ->
              concepts.delete(
                  party.getId().toString(), Map.of("hardDelete", String.valueOf(hard))));
    }
    assertBadRequest(
        () ->
            concepts.update(
                party.getId(), party.withConceptType(OntologyConceptType.SKOS_CONCEPT)));
    assertBadRequest(() -> client.ontologyAxioms().create(subclass(party, customer.getIri())));
    assertBadRequest(
        () -> client.ontologyAxioms().create(subclass(customer, URI.create("urn:Unknown"))));
    client.ontologyAxioms().delete(axiom.getId().toString());
    assertTrue(
        concepts.get(customer.getId().toString(), "superClasses").getSuperClasses().isEmpty());
    concepts.delete(party.getId().toString(), Map.of("hardDelete", "true"));
    assertBadRequest(() -> client.ontologyAxioms().restore(axiom.getId()));
  }

  private static void assertBadRequest(Runnable action) {
    assertEquals(400, assertThrows(OpenMetadataException.class, action::run).getStatusCode());
  }

  private static CreateOntologyAxiom subclass(OntologyConcept source, URI... targets) {
    return new CreateOntologyAxiom()
        .withName(source.getName() + UUID.randomUUID())
        .withDisplayName("Subclass assertion")
        .withDescription("A named class hierarchy")
        .withOntology(source.getOntology().getFullyQualifiedName())
        .withAxiomType(OntologyAxiomType.SUBCLASS_OF)
        .withProvenance(RelationProvenance.MANUAL)
        .withSubjectIri(source.getIri())
        .withExpressions(
            Arrays.stream(targets)
                .map(
                    iri ->
                        new OntologyExpression()
                            .withKind(OntologyExpressionKind.NAMED_CLASS)
                            .withClassIri(iri))
                .toList());
  }
}
