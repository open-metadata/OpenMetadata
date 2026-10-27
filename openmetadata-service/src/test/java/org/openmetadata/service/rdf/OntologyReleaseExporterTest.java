package org.openmetadata.service.rdf;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.rdf.OntologyReleaseExportFixture.CUSTOMER;
import static org.openmetadata.service.rdf.OntologyReleaseExportFixture.EX;

import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.RDFNode;
import org.apache.jena.riot.Lang;
import org.apache.jena.vocabulary.OWL2;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.ontology.NativeOntologyCsvCodec;
import org.openmetadata.service.ontology.NativeOntologyDocument;
import org.openmetadata.service.rdf.OntologyReleaseExportFixture.Sealed;

class OntologyReleaseExporterTest {
  private static final Sealed SEALED = OntologyReleaseExportFixture.release();
  private static final URI TABLE =
      OntologyReleaseExporter.assetIri("table", OntologyReleaseExportFixture.id("t1"));
  private static final URI TOPIC =
      OntologyReleaseExporter.assetIri("topic", OntologyReleaseExportFixture.id("t2"));

  private static String export(
      final OntologyExportFormat format,
      final OntologyExportOptions options,
      final BoundAssetLinks links) {
    return OntologyReleaseExporter.render(
        SEALED.release(), SEALED.members(), format, options, links);
  }

  @ParameterizedTest
  @EnumSource(
      value = OntologyExportFormat.class,
      names = {"RDF_XML", "N_TRIPLES", "JSON_LD"})
  void everyGraphFormatParsesBackToTheTurtleGraph(final OntologyExportFormat format) {
    final Lang lang = format.serialization().rdfFormat().getLang();
    final Model turtle =
        OntologyReleaseExportFixture.turtle(
            export(
                OntologyExportFormat.TURTLE, OntologyExportOptions.DEFAULTS, BoundAssetLinks.NONE));
    final Model other =
        OntologyReleaseExportFixture.parse(
            export(format, OntologyExportOptions.DEFAULTS, BoundAssetLinks.NONE), lang);
    assertTrue(turtle.size() > 20);
    assertTrue(turtle.isIsomorphicWith(other), () -> "Differs: " + turtle.difference(other));
  }

  @Test
  void inversesAreWrittenOnlyWhenRequested() {
    final String with =
        export(OntologyExportFormat.TURTLE, OntologyExportOptions.DEFAULTS, BoundAssetLinks.NONE);
    final String without =
        export(
            OntologyExportFormat.TURTLE,
            new OntologyExportOptions(false, false),
            BoundAssetLinks.NONE);
    final Model included = OntologyReleaseExportFixture.turtle(with);
    final Model omitted = OntologyReleaseExportFixture.turtle(without);
    assertTrue(
        included.contains(
            included.createResource(EX + "buysFrom"),
            OWL2.inverseOf,
            included.createResource(EX + "soldTo")));
    assertFalse(omitted.contains(null, OWL2.inverseOf));
    assertFalse(omitted.contains(null, OWL2.annotatedProperty, OWL2.inverseOf));
    assertTrue(
        omitted.contains(omitted.createResource(EX + "buysFrom"), null, OWL2.ObjectProperty));
  }

  @ParameterizedTest
  @EnumSource(
      value = OntologyExportFormat.class,
      names = {"TURTLE", "SKOS", "SKOS_XL"})
  void boundAssetsAreLinkedOncePerBindingAndOnlyWhenRequested(final OntologyExportFormat format) {
    final BoundAssetLinks links =
        concept -> concept.getId().equals(CUSTOMER.getId()) ? List.of(TABLE, TOPIC) : List.of();
    final Model linked =
        OntologyReleaseExportFixture.turtle(
            export(format, new OntologyExportOptions(true, true), links));
    final Model plain =
        OntologyReleaseExportFixture.turtle(
            export(format, new OntologyExportOptions(true, false), links));
    final Set<String> targets =
        linked.listObjectsOfProperty(OntologyRdfVocabulary.BOUND_ASSET).toList().stream()
            .map(Object::toString)
            .collect(Collectors.toSet());
    assertEquals(Set.of(TABLE.toString(), TOPIC.toString()), targets);
    assertEquals(
        List.of(linked.createResource(EX + "Customer")),
        linked.listSubjectsWithProperty(OntologyRdfVocabulary.BOUND_ASSET).toList());
    assertEquals(
        2,
        linked
            .listStatements(null, OntologyRdfVocabulary.BOUND_ASSET, (RDFNode) null)
            .toList()
            .size());
    assertFalse(plain.contains(null, OntologyRdfVocabulary.BOUND_ASSET));
  }

  @Test
  void csvCarriesEveryDefinitionAndHonoursTheInverseOption() {
    final NativeOntologyDocument with =
        NativeOntologyCsvCodec.read(
            export(OntologyExportFormat.CSV, OntologyExportOptions.DEFAULTS, BoundAssetLinks.NONE));
    final NativeOntologyDocument without =
        NativeOntologyCsvCodec.read(
            export(
                OntologyExportFormat.CSV,
                new OntologyExportOptions(false, false),
                BoundAssetLinks.NONE));
    assertEquals(
        List.of(EX + "Customer", EX + "Party", EX + "Supplier"),
        with.concepts().stream().map(concept -> concept.getIri().toString()).toList());
    assertEquals(
        Map.of(EX + "buysFrom", EX + "soldTo", EX + "soldTo", EX + "buysFrom"), inverses(with));
    assertTrue(inverses(without).isEmpty());
    assertEquals("Model", with.header().label());
    assertEquals(2, with.axioms().size());
  }

  @Test
  void csvCannotCarryBoundAssetLinks() {
    assertThrows(
        BadRequestException.class,
        () ->
            export(
                OntologyExportFormat.CSV,
                new OntologyExportOptions(true, true),
                BoundAssetLinks.NONE));
  }

  @ParameterizedTest
  @CsvSource({
    "turtle,TURTLE",
    "text/turtle,TURTLE",
    "rdfxml,RDF_XML",
    "application/rdf+xml,RDF_XML",
    "ntriples,N_TRIPLES",
    "jsonld,JSON_LD",
    "skos,SKOS",
    "SKOS-XL,SKOS_XL",
    "skosxl,SKOS_XL",
    "csv,CSV",
    "text/csv,CSV"
  })
  void parsesEveryExternalNameAndMediaType(
      final String requested, final OntologyExportFormat format) {
    assertEquals(format, OntologyExportFormat.parse(requested));
    assertEquals(format, OntologyExportFormat.parse(format.externalName()));
  }

  @Test
  void defaultsToTurtleAndRejectsUnknownFormats() {
    assertEquals(OntologyExportFormat.TURTLE, OntologyExportFormat.parse(null));
    assertEquals(OntologyExportFormat.TURTLE, OntologyExportFormat.parse(" "));
    assertThrows(IllegalArgumentException.class, () -> OntologyExportFormat.parse("docx"));
  }

  @Test
  void skosFormatsAreTurtleAndCsvHasNoSerialization() {
    assertEquals("text/turtle", OntologyExportFormat.SKOS_XL.mediaType());
    assertEquals("ttl", OntologyExportFormat.SKOS.extension());
    assertEquals("text/csv", OntologyExportFormat.CSV.mediaType());
    assertEquals("csv", OntologyExportFormat.CSV.extension());
    assertThrows(IllegalStateException.class, OntologyExportFormat.CSV::serialization);
  }

  private static Map<String, String> inverses(final NativeOntologyDocument document) {
    return document.properties().stream()
        .filter(property -> property.getInverse() != null)
        .collect(
            Collectors.toMap(
                property -> property.getIri().toString(),
                property -> property.getInverse().toString()));
  }
}
