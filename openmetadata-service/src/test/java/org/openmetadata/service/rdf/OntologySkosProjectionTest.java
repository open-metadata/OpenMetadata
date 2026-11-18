package org.openmetadata.service.rdf;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.rdf.OntologyReleaseExportFixture.CUSTOMER;
import static org.openmetadata.service.rdf.OntologyReleaseExportFixture.EX;
import static org.openmetadata.service.rdf.OntologyReleaseExportFixture.PARTY;
import static org.openmetadata.service.rdf.OntologyReleaseExportFixture.SUPPLIER;

import java.net.URI;
import java.util.List;
import java.util.Set;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.vocabulary.RDF;
import org.apache.jena.vocabulary.SKOS;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.type.OntologyExpression;
import org.openmetadata.schema.type.OntologyExpressionKind;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.rdf.OntologyReleaseExportFixture.Sealed;

class OntologySkosProjectionTest {
  private static final String SKOS_TURTLE =
      """
      @prefix skos: <http://www.w3.org/2004/02/skos/core#> .
      @prefix ex: <https://example.org/model/> .

      <https://example.org/model/> a skos:ConceptScheme ;
        skos:prefLabel "Model" ;
        skos:definition "The shared model" .
      ex:Customer a skos:Concept ;
        skos:inScheme <https://example.org/model/> ;
        skos:prefLabel "Customer account" ;
        skos:definition "Someone who buys" ;
        skos:altLabel "Client", "Buyer" ;
        skos:exactMatch <https://other.example/Client> ;
        skos:broader ex:Party .
      ex:Supplier a skos:Concept ;
        skos:inScheme <https://example.org/model/> ;
        skos:prefLabel "Supplier" ;
        skos:broader ex:Party .
      ex:Party a skos:Concept ;
        skos:inScheme <https://example.org/model/> ;
        skos:prefLabel "Party" .
      """;

  @Test
  void projectsConceptsParentsLabelsAndMappingsAsSkos() {
    final Sealed sealed = OntologyReleaseExportFixture.release();
    final Model actual =
        new OntologySkosProjection(false).build(sealed.release(), sealed.members());
    final Model expected = OntologyReleaseExportFixture.turtle(SKOS_TURTLE);
    assertTrue(
        expected.isIsomorphicWith(actual),
        () -> "Unexpected SKOS graph, missing " + expected.difference(actual));
  }

  @Test
  void extendedLabelsGiveEveryLabelItsOwnNodeAndKeepThePlainLabels() {
    final Sealed sealed = OntologyReleaseExportFixture.release();
    final String customer = label(CUSTOMER);
    final String expectedExtension =
        """
        @prefix skosxl: <http://www.w3.org/2008/05/skos-xl#> .
        @prefix ex: <https://example.org/model/> .

        ex:Customer skosxl:prefLabel <%1$s:prefLabel> ;
          skosxl:altLabel <%1$s:altLabel:0>, <%1$s:altLabel:1> .
        <%1$s:prefLabel> a skosxl:Label ; skosxl:literalForm "Customer account" .
        <%1$s:altLabel:0> a skosxl:Label ; skosxl:literalForm "Buyer" .
        <%1$s:altLabel:1> a skosxl:Label ; skosxl:literalForm "Client" .
        ex:Supplier skosxl:prefLabel <%2$s:prefLabel> .
        <%2$s:prefLabel> a skosxl:Label ; skosxl:literalForm "Supplier" .
        ex:Party skosxl:prefLabel <%3$s:prefLabel> .
        <%3$s:prefLabel> a skosxl:Label ; skosxl:literalForm "Party" .
        """
            .formatted(customer, label(SUPPLIER), label(PARTY));
    final Model actual = new OntologySkosProjection(true).build(sealed.release(), sealed.members());
    final Model expected = OntologyReleaseExportFixture.turtle(SKOS_TURTLE);
    expected.add(OntologyReleaseExportFixture.turtle(expectedExtension));
    assertTrue(
        expected.isIsomorphicWith(actual),
        () -> "Unexpected SKOS-XL graph, missing " + expected.difference(actual));
    assertEquals(
        5,
        actual
            .listSubjectsWithProperty(
                RDF.type, actual.createResource(OntologySkosProjection.SKOSXL_NAMESPACE + "Label"))
            .toList()
            .size());
  }

  @Test
  void leavesOutParentsThatAreNotNamedClassesOfAConceptInTheRelease() {
    final OntologyConcept orphan = OntologyReleaseExportFixture.concept("Orphan", null);
    final Sealed sealed =
        OntologyReleaseExportFixture.seal(
            List.of(
                CUSTOMER,
                OntologyReleaseExportFixture.parent("orphan-is-party", orphan, PARTY),
                OntologyReleaseExportFixture.property("buysFrom", "soldTo")));
    final Model actual =
        new OntologySkosProjection(false).build(sealed.release(), sealed.members());
    assertFalse(actual.containsResource(actual.createResource(EX + "Orphan")));
    assertFalse(actual.contains(null, SKOS.broader));
    assertFalse(actual.containsResource(actual.createResource(EX + "buysFrom")));
  }

  @Test
  void everyNamedParentOfAMultiExpressionAxiomBecomesBroader() {
    final OntologyConcept agent = OntologyReleaseExportFixture.concept("Agent", null);
    final Sealed sealed =
        OntologyReleaseExportFixture.seal(
            List.of(
                CUSTOMER,
                PARTY,
                agent,
                OntologyReleaseExportFixture.parents(
                    "customer-parents",
                    CUSTOMER,
                    List.of(
                        OntologyReleaseExportFixture.named(PARTY),
                        OntologyReleaseExportFixture.named(agent)))));
    final Model actual =
        new OntologySkosProjection(false).build(sealed.release(), sealed.members());
    final Model expected =
        OntologyReleaseExportFixture.turtle(
            """
            @prefix skos: <http://www.w3.org/2004/02/skos/core#> .
            @prefix ex: <https://example.org/model/> .
            ex:Customer skos:broader ex:Party, ex:Agent .
            """);
    assertTrue(actual.containsAll(expected), () -> "Missing " + expected.difference(actual));
    assertEquals(2, actual.listObjectsOfProperty(SKOS.broader).toList().size());
  }

  @Test
  void aNamedParentBesideARestrictionStillBecomesBroader() {
    final Sealed sealed =
        OntologyReleaseExportFixture.seal(
            List.of(
                CUSTOMER,
                PARTY,
                OntologyReleaseExportFixture.parents(
                    "customer-parents",
                    CUSTOMER,
                    List.of(
                        OntologyReleaseExportFixture.named(PARTY),
                        new OntologyExpression()
                            .withKind(OntologyExpressionKind.RESTRICTION)
                            .withPropertyIri(URI.create(EX + "buysFrom"))))));
    final Model actual =
        new OntologySkosProjection(false).build(sealed.release(), sealed.members());
    assertEquals(
        List.of(actual.createResource(PARTY.getIri().toString())),
        actual.listObjectsOfProperty(SKOS.broader).toList());
  }

  @Test
  void aSynonymThatRepeatsThePreferredLabelIsNotAnAlternativeLabel() {
    final OntologyConcept client =
        OntologyReleaseExportFixture.concept("Client", "Client")
            .withSynonyms(Set.of("Client", "Buyer"));
    final Sealed sealed = OntologyReleaseExportFixture.seal(List.of(client));
    final Model actual = new OntologySkosProjection(true).build(sealed.release(), sealed.members());
    final Resource subject = actual.createResource(EX + "Client");
    assertEquals(
        List.of("Buyer"),
        actual.listObjectsOfProperty(subject, SKOS.altLabel).toList().stream()
            .map(node -> node.asLiteral().getString())
            .toList());
    assertEquals(
        2, actual.listSubjectsWithProperty(RDF.type, actual.createResource(LABEL)).toList().size());
  }

  @Test
  void refusesAReleaseThatIsNotSealed() {
    final Sealed sealed = OntologyReleaseExportFixture.release();
    sealed.release().setContentDigest("0".repeat(64));
    assertThrows(
        BadRequestException.class,
        () -> new OntologySkosProjection(false).build(sealed.release(), sealed.members()));
  }

  private static final String LABEL = OntologySkosProjection.SKOSXL_NAMESPACE + "Label";

  private static String label(final OntologyConcept concept) {
    return OntologyReleaseExportFixture.VERSION_IRI + ":CONCEPT:" + concept.getId();
  }
}
