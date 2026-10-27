package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.util.List;
import java.util.Set;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.vocabulary.OWL2;
import org.apache.jena.vocabulary.RDF;
import org.apache.jena.vocabulary.SKOS;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateOntologyConcept;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.type.OntologyConceptType;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.service.ontology.NativeOntologyCsvCodec;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class IndependentOntologyReleaseExportFormatsIT extends OntologyReleaseExportSupport {
  @Test
  void skosExportListsBroaderForEveryParentAndSkosXlGivesEveryLabelItsOwnNode(TestNamespace ns) {
    var client = SdkClients.adminClient();
    Ontology ontology = createOntology(ns, "skos");
    client
        .ontologyConcepts()
        .create(
            new CreateOntologyConcept()
                .withName("Customer")
                .withDisplayName("Customer account")
                .withIri(CUSTOMER)
                .withConceptType(OntologyConceptType.OWL_CLASS)
                .withSynonyms(Set.of("Client", "Buyer"))
                .withOntology(ontology.getFullyQualifiedName()));
    declareClass(ontology, "Party", PARTY);
    declareClass(ontology, "Supplier", SUPPLIER);
    client.ontologyAxioms().create(axiom(ontology));
    client
        .ontologyAxioms()
        .create(axiom(ontology).withName("supplier-is-party").withSubjectIri(SUPPLIER));
    OntologyRelease release = capture(ontology);

    Model skos = parseTurtle(export(client, release.getId(), "skos"));
    for (URI child : List.of(CUSTOMER, SUPPLIER)) {
      assertTrue(
          skos.contains(
              skos.createResource(child.toString()),
              SKOS.broader,
              skos.createResource(PARTY.toString())));
    }
    assertTrue(skos.contains(skos.createResource(PARTY.toString()), RDF.type, SKOS.Concept));
    assertEquals(
        3,
        skos.listResourcesWithProperty(SKOS.inScheme).toList().size(),
        "every concept is in the scheme");
    assertFalse(skos.contains(null, skos.createProperty(SKOSXL + "literalForm")));

    Model skosXl = parseTurtle(export(client, release.getId(), "skos-xl"));
    var labelType = skosXl.createResource(SKOSXL + "Label");
    var labels = skosXl.listResourcesWithProperty(RDF.type, labelType).toList();
    assertEquals(5, labels.size(), "three concept labels plus two synonyms");
    var customerLabel =
        skosXl
            .getResource(CUSTOMER.toString())
            .getPropertyResourceValue(skosXl.createProperty(SKOSXL + "prefLabel"));
    assertEquals(
        "Customer account",
        customerLabel.getProperty(skosXl.createProperty(SKOSXL + "literalForm")).getString());
    assertEquals(
        2,
        skosXl
            .listObjectsOfProperty(
                skosXl.getResource(CUSTOMER.toString()), skosXl.createProperty(SKOSXL + "altLabel"))
            .toList()
            .size());
  }

  @Test
  void csvExportParsesBackThroughTheNativeCodecAndHonoursInverses(TestNamespace ns) {
    var client = SdkClients.adminClient();
    Ontology ontology = createOntology(ns, "csv");
    declareClass(ontology, "Customer", CUSTOMER);
    declareClass(ontology, "Party", PARTY);
    client.ontologyAxioms().create(axiom(ontology));
    client.ontologyProperties().create(property(ontology).withInverse(KNOWN_BY));
    client.ontologyProperties().create(inverseProperty(ontology));
    OntologyRelease release = capture(ontology);

    var withInverses = NativeOntologyCsvCodec.read(export(client, release.getId(), "csv"));
    var withoutInverses =
        NativeOntologyCsvCodec.read(
            export(client, release.getId(), "csv", "&includeInverses=false"));

    assertEquals(
        List.of(CUSTOMER.toString(), PARTY.toString()),
        withInverses.concepts().stream().map(c -> c.getIri().toString()).toList());
    assertEquals(
        List.of(KNOWN_BY, KNOWS),
        withInverses.properties().stream().map(property -> property.getIri()).sorted().toList());
    assertTrue(withInverses.properties().stream().allMatch(p -> p.getInverse() != null));
    assertTrue(withoutInverses.properties().stream().allMatch(p -> p.getInverse() == null));
    assertEquals(
        400,
        assertThrows(
                OpenMetadataException.class,
                () -> export(client, release.getId(), "csv", "&includeBoundAssets=true"))
            .getStatusCode());
  }

  @Test
  void inverseOfIsWrittenOnlyWhenRequested(TestNamespace ns) {
    var client = SdkClients.adminClient();
    Ontology ontology = createOntology(ns, "inverses");
    declareClass(ontology, "Customer", CUSTOMER);
    declareClass(ontology, "Party", PARTY);
    client.ontologyProperties().create(property(ontology).withInverse(KNOWN_BY));
    client.ontologyProperties().create(inverseProperty(ontology));
    OntologyRelease release = capture(ontology);

    Model with = parseTurtle(export(client, release.getId(), "turtle"));
    Model without =
        parseTurtle(export(client, release.getId(), "turtle", "&includeInverses=false"));

    assertTrue(with.contains(with.createResource(KNOWS.toString()), OWL2.inverseOf));
    assertFalse(without.contains(null, OWL2.inverseOf));
    assertTrue(
        without.contains(without.createResource(KNOWS.toString()), RDF.type, OWL2.ObjectProperty));
  }
}
