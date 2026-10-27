package org.openmetadata.service.ontology;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.openmetadata.schema.api.data.NativeOntologyImportFormat;
import org.openmetadata.schema.api.data.PreviewNativeOntologyImport;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.type.OntologyReleaseMember.MemberKind;
import org.openmetadata.schema.type.OntologyState;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.ontology.NativeOntologyCsvCodec.Column;
import org.openmetadata.service.rdf.NativeOntologyRdfImporter;

class NativeOntologyImportListRulesTest {
  private static final String EX = "https://example.org/";
  private static final String ONE_VALUE = "An enumeration needs at least two allowed values";
  private static final String DUPLICATE = "Ontology property enum values must be unique";
  private static final String SHORT_CHAIN =
      "A property chain requires at least two object properties";

  private final NativeOntologyRdfImporter importer = new NativeOntologyRdfImporter();

  @ParameterizedTest
  @CsvSource(
      delimiter = '|',
      value = {
        "DATA|ENUM_VALUES|a|enumValues|" + ONE_VALUE,
        "DATA|ENUM_VALUES|a;a|enumValues|" + DUPLICATE,
        "OBJECT|PROPERTY_CHAIN|https://example.org/other|propertyChain|" + SHORT_CHAIN,
      })
  void csvPreviewNamesTheRowAndColumnOfAnUnusableList(
      final String kind,
      final Column column,
      final String cell,
      final String header,
      final String rule) {
    final PreviewNativeOntologyImport request = csv(property("p", kind, column, cell));

    final String expected = "CSV row 2, column " + header + ": " + rule;
    assertEquals(
        expected,
        assertThrows(
                BadRequestException.class, () -> importer.preview(importer.read(request), empty()))
            .getMessage());
    assertEquals(
        expected,
        assertThrows(BadRequestException.class, () -> importer.summarize(importer.read(request)))
            .getMessage());
  }

  @Test
  void csvPreviewStillAcceptsUsableLists() {
    final var source =
        importer.read(
            csv(
                property("e", "DATA", Column.ENUM_VALUES, "a;b"),
                property("c", "OBJECT", Column.PROPERTY_CHAIN, EX + "x;" + EX + "y")));

    assertEquals(2, importer.preview(source, empty()).getSummary().getCounts().getNewProperties());
  }

  @Test
  void aStoredOneValueEnumerationReimportsUntilItsValuesChange() {
    final PreviewNativeOntologyImport request =
        csv(property("legacy", "DATA", Column.ENUM_VALUES, "a"));
    final OntologyProperty legacy = importer.read(request).document().properties().getFirst();
    final var snapshot = withProperty(legacy);

    assertEquals(
        1,
        importer
            .preview(importer.read(request), snapshot)
            .getSummary()
            .getCounts()
            .getSkippedDefinitions());

    final var changed = importer.read(csv(property("legacy", "DATA", Column.ENUM_VALUES, "z")));
    assertEquals(
        "CSV row 2, column enumValues: " + ONE_VALUE,
        assertThrows(BadRequestException.class, () -> importer.preview(changed, snapshot))
            .getMessage());
  }

  @ParameterizedTest
  @CsvSource(
      delimiter = '|',
      value = {
        "ex:q a owl:DatatypeProperty ; rdfs:range [ a rdfs:Datatype ; owl:oneOf (\"a\") ] .|"
            + "enumValues|"
            + ONE_VALUE,
        "ex:q a owl:DatatypeProperty ; rdfs:range [ a rdfs:Datatype ; owl:oneOf (\"a\" \"a\") ] .|"
            + "enumValues|"
            + DUPLICATE,
        "ex:p a owl:ObjectProperty . ex:q a owl:ObjectProperty ; owl:propertyChainAxiom (ex:p) .|"
            + "propertyChain|"
            + SHORT_CHAIN,
      })
  void rdfPreviewRefusesTheSameLists(
      final String statements, final String field, final String rule) {
    final PreviewNativeOntologyImport request =
        new PreviewNativeOntologyImport()
            .withFormat(NativeOntologyImportFormat.TURTLE)
            .withData(
                """
                @prefix owl: <http://www.w3.org/2002/07/owl#> .
                @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
                @prefix ex: <https://example.org/> .
                """
                    + statements);

    final BadRequestException thrown =
        assertThrows(
            BadRequestException.class, () -> importer.preview(importer.read(request), empty()));
    assertEquals("Property " + EX + "q, " + field + ": " + rule, thrown.getMessage());
  }

  private static PreviewNativeOntologyImport csv(final String... rows) {
    return new PreviewNativeOntologyImport()
        .withFormat(NativeOntologyImportFormat.CSV)
        .withData(NativeOntologyCsvCodec.HEADER + "\r\n" + String.join("\r\n", rows) + "\r\n");
  }

  private static String property(
      final String name, final String kind, final Column column, final String cell) {
    final String[] cells = new String[Column.values().length];
    Arrays.fill(cells, "");
    cells[Column.KIND.ordinal()] = "PROPERTY";
    cells[Column.IRI.ordinal()] = EX + name;
    cells[Column.PROPERTY_KIND.ordinal()] = kind;
    cells[column.ordinal()] =
        NativeOntologyCsvCells.join(
            Arrays.stream(cell.split(";"))
                .map(item -> column == Column.ENUM_VALUES ? "\"" + item + "\"" : item)
                .toList());
    return NativeOntologyCsvCodec.ROW_FORMAT.format((Object[]) cells);
  }

  private static Ontology root() {
    return new Ontology()
        .withId(UUID.randomUUID())
        .withName("Imported")
        .withFullyQualifiedName("Imported")
        .withIri(java.net.URI.create(EX + "ontology"));
  }

  private static OntologyWorkingSnapshot.Snapshot empty() {
    return snapshot(root(), List.of());
  }

  private static OntologyWorkingSnapshot.Snapshot withProperty(final OntologyProperty property) {
    return snapshot(
        root(), List.of(new OntologyWorkingSnapshot.Entry(MemberKind.PROPERTY, property)));
  }

  private static OntologyWorkingSnapshot.Snapshot snapshot(
      final Ontology root, final List<OntologyWorkingSnapshot.Entry> definitions) {
    final List<OntologyWorkingSnapshot.Entry> entries = new ArrayList<>();
    entries.add(new OntologyWorkingSnapshot.Entry(MemberKind.ONTOLOGY, root));
    entries.addAll(definitions);
    return new OntologyWorkingSnapshot.Snapshot(
        new OntologyState()
            .withOntologyId(root.getId())
            .withWorkingRevision(3L)
            .withActivationRevision(1L)
            .withLastReleaseRevision(1L),
        entries);
  }
}
