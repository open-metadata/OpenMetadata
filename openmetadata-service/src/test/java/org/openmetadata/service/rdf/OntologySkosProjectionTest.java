package org.openmetadata.service.rdf;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.rdf.OntologyReleaseExportFixture.CUSTOMER;
import static org.openmetadata.service.rdf.OntologyReleaseExportFixture.EX;
import static org.openmetadata.service.rdf.OntologyReleaseExportFixture.PARTY;
import static org.openmetadata.service.rdf.OntologyReleaseExportFixture.SUPPLIER;

import java.util.List;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.vocabulary.RDF;
import org.apache.jena.vocabulary.SKOS;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.OntologyConcept;
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
  void refusesAReleaseThatIsNotSealed() {
    final Sealed sealed = OntologyReleaseExportFixture.release();
    sealed.release().setContentDigest("0".repeat(64));
    assertThrows(
        BadRequestException.class,
        () -> new OntologySkosProjection(false).build(sealed.release(), sealed.members()));
  }

  private static String label(final OntologyConcept concept) {
    return OntologyReleaseExportFixture.VERSION_IRI + ":CONCEPT:" + concept.getId();
  }
}
