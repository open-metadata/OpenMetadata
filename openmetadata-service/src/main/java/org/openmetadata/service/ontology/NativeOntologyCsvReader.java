package org.openmetadata.service.ontology;

import static org.openmetadata.service.ontology.NativeOntologyCsvCodec.ROW_FORMAT;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.openmetadata.schema.api.data.ConceptMapping;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.type.OntologyAxiomType;
import org.openmetadata.schema.type.OntologyConceptType;
import org.openmetadata.schema.type.OntologyExpression;
import org.openmetadata.schema.type.OntologyExpressionKind;
import org.openmetadata.schema.type.OntologyLiteral;
import org.openmetadata.schema.type.OntologyPropertyKind;
import org.openmetadata.schema.type.RelationshipCharacteristic;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.ontology.NativeOntologyCsvCells.Cell;
import org.openmetadata.service.ontology.NativeOntologyCsvCodec.Column;
import org.openmetadata.service.ontology.NativeOntologyCsvCodec.RowKind;
import org.openmetadata.service.rdf.OwlEntityDeclarations;
import org.openmetadata.service.rdf.SafeRdfModelParser;

/**
 * Reads the native ontology CSV into a {@link NativeOntologyDocument}. Strict: the first problem
 * fails the whole read, naming the row a spreadsheet shows (the header is row 1).
 */
final class NativeOntologyCsvReader {
  private static final OwlProfileGuard SHAPE_GUARD = new OwlProfileGuard(iri -> null);

  private final long deadline = System.nanoTime() + SafeRdfModelParser.PARSE_NANOS;
  private final List<OntologyConcept> concepts = new ArrayList<>();
  private final List<OntologyProperty> properties = new ArrayList<>();
  private final List<OntologyAxiom> axioms = new ArrayList<>();
  private final Map<String, Integer> conceptRows = new HashMap<>();
  private final Map<String, Integer> propertyRows = new HashMap<>();
  private NativeOntologyDocument.Header header;
  private int headerRow;
  private int statements;

  NativeOntologyDocument read(final String csv) {
    requireWithinSize(csv);
    try (CSVParser parser = CSVParser.parse(NativeOntologyCsvCodec.stripBom(csv), ROW_FORMAT)) {
      final Iterator<CSVRecord> records = parser.iterator();
      requireHeader(records);
      while (records.hasNext()) {
        row(records.next());
      }
    } catch (IOException | UncheckedIOException | IllegalStateException exception) {
      throw new BadRequestException(
          "Failed to parse native CSV: " + firstLine(String.valueOf(exception.getMessage())));
    }
    return new NativeOntologyDocument(header, concepts, properties, axioms);
  }

  private static void requireWithinSize(final String csv) {
    if (csv == null
        || csv.isBlank()
        || csv.getBytes(StandardCharsets.UTF_8).length > SafeRdfModelParser.MAX_INPUT_BYTES) {
      throw new BadRequestException("Native ontology CSV must contain at most 10 MiB of data");
    }
  }

  private static void requireHeader(final Iterator<CSVRecord> records) {
    if (!records.hasNext() || !NativeOntologyCsvCodec.isHeaderRecord(records.next())) {
      throw new BadRequestException(
          "CSV row 1: the header must be exactly " + NativeOntologyCsvCodec.HEADER);
    }
  }

  private static String firstLine(final String message) {
    final int end = message.indexOf('\n');
    final String line = end < 0 ? message : message.substring(0, end);
    return line.substring(0, Math.min(200, line.length()));
  }

  private void row(final CSVRecord record) {
    final int number = (int) record.getRecordNumber();
    if (record.size() == 1 && record.get(0).isEmpty()) {
      return;
    }
    spend(number, 1);
    final Row row = Row.of(number, record);
    switch (row.kind()) {
      case ONTOLOGY -> ontology(row);
      case CONCEPT -> concept(row);
      case PROPERTY -> property(row);
      case AXIOM -> axiom(row);
    }
  }

  private void spend(final int row, final int count) {
    statements += count;
    if (statements > SafeRdfModelParser.MAX_TRIPLES || System.nanoTime() >= deadline) {
      throw new BadRequestException(
          "CSV row " + row + ": the file exceeds its statement or time budget");
    }
  }

  private void ontology(final Row row) {
    if (header != null) {
      throw new BadRequestException(
          "CSV row " + row.number() + ": a second ONTOLOGY row; the first is row " + headerRow);
    }
    headerRow = row.number();
    header =
        new NativeOntologyDocument.Header(
            row.filled(Column.IRI) ? NativeOntologyCsvCells.iri(row.cell(Column.IRI)) : null,
            row.text(Column.LABEL),
            row.text(Column.DESCRIPTION));
  }

  private void concept(final Row row) {
    final URI iri = definitionIri(row, conceptRows);
    concepts.add(
        new OntologyConcept()
            .withIri(iri)
            .withConceptType(
                NativeOntologyCsvCells.enumValue(
                    row.cell(Column.CONCEPT_TYPE),
                    row.text(Column.CONCEPT_TYPE),
                    OntologyConceptType.class))
            .withDisplayName(row.text(Column.LABEL))
            .withDescription(row.text(Column.DESCRIPTION))
            .withSynonyms(new LinkedHashSet<>(distinct(row, Column.SYNONYMS)))
            .withConceptMappings(mappings(row)));
    for (final URI parent : iris(row, Column.PARENTS, true)) {
      axioms.add(subclassOf(row, iri, parent));
    }
  }

  private List<ConceptMapping> mappings(final Row row) {
    final Cell cell = row.cell(Column.MAPPINGS);
    return distinct(row, Column.MAPPINGS).stream()
        .map(item -> NativeOntologyCsvCells.mapping(cell, item))
        .toList();
  }

  private OntologyAxiom subclassOf(final Row row, final URI subject, final URI parent) {
    final OntologyAxiom axiom =
        new OntologyAxiom()
            .withAxiomType(OntologyAxiomType.SUBCLASS_OF)
            .withSubjectIri(subject)
            .withExpressions(new ArrayList<>(List.of(namedClass(parent))));
    return validated(row, axiom);
  }

  static OntologyExpression namedClass(final URI iri) {
    return new OntologyExpression().withKind(OntologyExpressionKind.NAMED_CLASS).withClassIri(iri);
  }

  private void property(final Row row) {
    final URI iri = definitionIri(row, propertyRows);
    properties.add(
        new OntologyProperty()
            .withIri(iri)
            .withKind(
                NativeOntologyCsvCells.enumValue(
                    row.cell(Column.PROPERTY_KIND),
                    row.text(Column.PROPERTY_KIND),
                    OntologyPropertyKind.class))
            .withDisplayName(row.text(Column.LABEL))
            .withDescription(row.text(Column.DESCRIPTION))
            .withDomain(iris(row, Column.DOMAIN, true))
            .withRange(iris(row, Column.RANGE, true))
            .withEnumValues(enumValues(row))
            .withUnit(row.text(Column.UNIT))
            .withIsIdentifier(identifier(row))
            .withInverse(
                row.filled(Column.INVERSE)
                    ? NativeOntologyCsvCells.iri(row.cell(Column.INVERSE))
                    : null)
            .withCharacteristics(characteristics(row))
            .withPropertyChain(iris(row, Column.PROPERTY_CHAIN, false))
            .withDisjointWith(iris(row, Column.DISJOINT_WITH, true)));
  }

  private List<OntologyLiteral> enumValues(final Row row) {
    final Cell cell = row.cell(Column.ENUM_VALUES);
    return items(row, Column.ENUM_VALUES).stream()
        .map(item -> NativeOntologyCsvCells.literal(cell, item))
        .toList();
  }

  private static Boolean identifier(final Row row) {
    if (!row.filled(Column.IDENTIFIER)) {
      return false;
    }
    if (!"true".equals(row.text(Column.IDENTIFIER))) {
      throw row.cell(Column.IDENTIFIER).invalid("expected true or an empty cell");
    }
    return true;
  }

  private Set<RelationshipCharacteristic> characteristics(final Row row) {
    final Cell cell = row.cell(Column.CHARACTERISTICS);
    final Set<RelationshipCharacteristic> parsed = new LinkedHashSet<>();
    for (final String item : distinct(row, Column.CHARACTERISTICS)) {
      parsed.add(NativeOntologyCsvCells.enumValue(cell, item, RelationshipCharacteristic.class));
    }
    return parsed;
  }

  private void axiom(final Row row) {
    final OntologyAxiom axiom =
        new OntologyAxiom()
            .withAxiomType(
                NativeOntologyCsvCells.enumValue(
                    row.cell(Column.AXIOM_TYPE),
                    row.text(Column.AXIOM_TYPE),
                    OntologyAxiomType.class))
            .withSubjectIri(NativeOntologyCsvCells.iri(row.cell(Column.IRI)))
            .withExpressions(
                row.filled(Column.EXPRESSIONS)
                    ? new ArrayList<>(
                        NativeOntologyCsvCells.expressions(row.cell(Column.EXPRESSIONS)))
                    : new ArrayList<>());
    if (row.filled(Column.PROPERTY)) {
      axiom.setPropertyIri(NativeOntologyCsvCells.iri(row.cell(Column.PROPERTY)));
    }
    if (row.filled(Column.TARGET)) {
      axiom.setTargetIri(NativeOntologyCsvCells.iri(row.cell(Column.TARGET)));
    }
    if (row.filled(Column.LITERAL)) {
      axiom.setLiteral(
          NativeOntologyCsvCells.literal(row.cell(Column.LITERAL), row.text(Column.LITERAL)));
    }
    axioms.add(validated(row, axiom));
  }

  private static OntologyAxiom validated(final Row row, final OntologyAxiom axiom) {
    try {
      SHAPE_GUARD.validateOrThrow(axiom);
    } catch (jakarta.ws.rs.BadRequestException exception) {
      throw new BadRequestException("CSV row " + row.number() + ": " + exception.getMessage());
    }
    return axiom;
  }

  private URI definitionIri(final Row row, final Map<String, Integer> seenRows) {
    final Cell cell = row.cell(Column.IRI);
    final URI iri = NativeOntologyCsvCells.iri(cell);
    if (OwlEntityDeclarations.isReservedVocabulary(iri.toString())) {
      throw cell.invalid(
          "'" + iri + "' belongs to reserved RDF, RDFS, OWL, XSD, or SKOS vocabulary");
    }
    final Integer first = seenRows.putIfAbsent(iri.toString(), row.number());
    if (first != null) {
      throw cell.invalid("'" + iri + "' repeats the definition in row " + first);
    }
    return iri;
  }

  private List<String> items(final Row row, final Column column) {
    final List<String> items = NativeOntologyCsvCells.items(row.cell(column));
    spend(row.number(), items.size());
    return items;
  }

  private List<String> distinct(final Row row, final Column column) {
    final List<String> items = items(row, column);
    final Set<String> seen = new HashSet<>();
    for (final String item : items) {
      if (!seen.add(item)) {
        throw row.cell(column).invalid("'" + item + "' is listed twice");
      }
    }
    return items;
  }

  private List<URI> iris(final Row row, final Column column, final boolean unique) {
    final Cell cell = row.cell(column);
    final List<String> items = unique ? distinct(row, column) : items(row, column);
    return items.stream().map(item -> NativeOntologyCsvCells.iri(cell, item)).toList();
  }

  private record Row(int number, RowKind kind, CSVRecord record) {
    static Row of(final int number, final CSVRecord record) {
      if (record.size() != Column.values().length) {
        throw new BadRequestException(
            "CSV row "
                + number
                + ": expected "
                + Column.values().length
                + " cells but found "
                + record.size());
      }
      final Cell kindCell = new Cell(number, Column.KIND, record.get(Column.KIND.ordinal()));
      final Row row =
          new Row(
              number,
              NativeOntologyCsvCells.enumValue(kindCell, kindCell.text(), RowKind.class),
              record);
      row.checkCells();
      return row;
    }

    private void checkCells() {
      for (final Column column : Column.values()) {
        if (filled(column) && !kind.allows(column)) {
          throw cell(column).invalid("a " + kind + " row leaves this cell empty");
        }
        if (!filled(column) && kind.requires(column)) {
          throw cell(column).invalid("a " + kind + " row requires a value");
        }
      }
    }

    Cell cell(final Column column) {
      return new Cell(number, column, record.get(column.ordinal()));
    }

    boolean filled(final Column column) {
      return !record.get(column.ordinal()).isEmpty();
    }

    String text(final Column column) {
      return filled(column) ? record.get(column.ordinal()) : null;
    }
  }
}
