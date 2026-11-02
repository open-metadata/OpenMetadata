package org.openmetadata.service.rdf;

import static java.util.stream.Collectors.toSet;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.rdf.OntologyReleaseExportFixture.CUSTOMER;
import static org.openmetadata.service.rdf.OntologyReleaseExportFixture.EX;

import java.net.URI;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.RDFNode;
import org.apache.jena.riot.Lang;
import org.apache.jena.vocabulary.OWL2;
import org.apache.jena.vocabulary.RDF;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.schema.OntologyDefinition;
import org.openmetadata.schema.api.data.OntologyReleaseExportOptions;
import org.openmetadata.schema.type.NativeOntologyExportFormat;
import org.openmetadata.schema.type.OntologyReleaseMember;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.OntologyReleaseDAO;
import org.openmetadata.service.jdbi3.OntologyReleaseRepository;
import org.openmetadata.service.ontology.NativeOntologyCsvCodec;
import org.openmetadata.service.ontology.NativeOntologyDocument;
import org.openmetadata.service.ontology.OntologyBoundAssetLinks;
import org.openmetadata.service.rdf.OntologyReleaseExportFixture.Sealed;
import org.openmetadata.service.security.AuthorizationException;

class OntologyReleaseExporterTest {
  private static final Sealed SEALED = OntologyReleaseExportFixture.release();
  private static final URI BASE = URI.create("https://open-metadata.org/");
  private static final URI TABLE =
      OntologyBoundAssetLinks.assetIri(BASE, "table", OntologyReleaseExportFixture.id("t1"));
  private static final URI TOPIC =
      OntologyBoundAssetLinks.assetIri(BASE, "topic", OntologyReleaseExportFixture.id("t2"));

  private static OntologyReleaseExportOptions options(
      final boolean includeInverses, final boolean includeBoundAssets) {
    return new OntologyReleaseExportOptions()
        .withIncludeInverses(includeInverses)
        .withIncludeBoundAssets(includeBoundAssets);
  }

  private static String export(
      final OntologyExportFormat format,
      final OntologyReleaseExportOptions options,
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
            export(OntologyExportFormat.TURTLE, options(true, false), BoundAssetLinks.NONE));
    final Model other =
        OntologyReleaseExportFixture.parse(
            export(format, options(true, false), BoundAssetLinks.NONE), lang);
    assertTrue(turtle.size() > 20);
    assertTrue(turtle.isIsomorphicWith(other), () -> "Differs: " + turtle.difference(other));
  }

  @Test
  void inversesAreWrittenOnlyWhenRequested() {
    final String with =
        export(OntologyExportFormat.TURTLE, options(true, false), BoundAssetLinks.NONE);
    final String without =
        export(OntologyExportFormat.TURTLE, options(false, false), BoundAssetLinks.NONE);
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
        OntologyReleaseExportFixture.turtle(export(format, options(true, true), links));
    final Model plain =
        OntologyReleaseExportFixture.turtle(export(format, options(true, false), links));
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
            export(OntologyExportFormat.CSV, options(true, false), BoundAssetLinks.NONE));
    final NativeOntologyDocument without =
        NativeOntologyCsvCodec.read(
            export(OntologyExportFormat.CSV, options(false, false), BoundAssetLinks.NONE));
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
  void exportAuthorizesTheReleaseAndEveryMemberBeforeItWritesAnything() {
    final OntologyReleaseDAO dao = storedMembers();
    final List<OntologyDefinition> authorized = new ArrayList<>();
    final String turtle =
        new OntologyReleaseExporter(repositoryOver(dao))
            .export(
                SEALED.release(),
                OntologyExportFormat.TURTLE,
                options(true, false),
                authorized::addAll,
                BoundAssetLinks.NONE);

    assertSame(SEALED.release(), authorized.getFirst());
    assertEquals(
        SEALED.members().stream().map(OntologyReleaseMember::getMemberId).collect(toSet()),
        authorized.stream().skip(1).map(OntologyDefinition::getId).collect(toSet()));
    assertTrue(
        OntologyReleaseExportFixture.turtle(turtle)
            .contains(
                OntologyReleaseExportFixture.turtle(turtle).createResource(EX + "Customer"),
                RDF.type,
                OWL2.Class));
  }

  @Test
  void exportReadsNoMemberWhenTheCallerMayNotViewTheRelease() {
    final OntologyReleaseDAO dao = storedMembers();
    final OntologyReleaseExporter exporter = new OntologyReleaseExporter(repositoryOver(dao));

    assertThrows(
        AuthorizationException.class,
        () ->
            exporter.export(
                SEALED.release(),
                OntologyExportFormat.TURTLE,
                options(true, false),
                definitions -> {
                  throw new AuthorizationException("denied");
                },
                BoundAssetLinks.NONE));
    verifyNoInteractions(dao);
  }

  @Test
  void exportRefusesAnUnsupportedOptionBeforeReadingTheRelease() {
    final OntologyReleaseDAO dao = storedMembers();
    final OntologyReleaseExporter exporter = new OntologyReleaseExporter(repositoryOver(dao));

    assertThrows(
        BadRequestException.class,
        () ->
            exporter.export(
                SEALED.release(),
                OntologyExportFormat.CSV,
                options(true, true),
                definitions -> {},
                BoundAssetLinks.NONE));
    verifyNoInteractions(dao);
  }

  @Test
  void csvCannotCarryBoundAssetLinks() {
    assertThrows(
        BadRequestException.class,
        () -> export(OntologyExportFormat.CSV, options(true, true), BoundAssetLinks.NONE));
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
    assertEquals(format, OntologyExportFormat.parse(format.wire().value()));
  }

  @Test
  void everySchemaFormatValueMapsToExactlyOneJavaFormat() {
    for (final NativeOntologyExportFormat wire : NativeOntologyExportFormat.values()) {
      final List<OntologyExportFormat> matches =
          Arrays.stream(OntologyExportFormat.values())
              .filter(format -> format.wire() == wire)
              .toList();
      assertEquals(1, matches.size(), wire.value());
      assertEquals(matches.getFirst(), OntologyExportFormat.parse(wire.value()), wire.value());
    }
    assertEquals(NativeOntologyExportFormat.values().length, OntologyExportFormat.values().length);
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

  private static OntologyReleaseDAO storedMembers() {
    final OntologyReleaseDAO dao = mock(OntologyReleaseDAO.class);
    when(dao.listMembers(eq(SEALED.release().getId()), anyString(), eq(""), eq(100)))
        .thenAnswer(
            invocation ->
                SEALED.members().stream()
                    .filter(
                        member -> member.getMemberKind().value().equals(invocation.getArgument(1)))
                    .toList());
    return dao;
  }

  private static OntologyReleaseRepository repositoryOver(final OntologyReleaseDAO dao) {
    final CollectionDAO collection = mock(CollectionDAO.class);
    when(collection.ontologyReleaseDAO()).thenReturn(dao);
    final OntologyReleaseRepository repository = mock(OntologyReleaseRepository.class);
    when(repository.getDaoCollection()).thenReturn(collection);
    return repository;
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
