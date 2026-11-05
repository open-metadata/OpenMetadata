package org.openmetadata.service.ontology;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.service.ontology.NativeOntologyCsvCodec.ROW_FORMAT;

import java.io.IOException;
import java.net.URI;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.HashSet;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.apache.commons.csv.CSVPrinter;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.type.OntologyAxiomType;
import org.openmetadata.schema.type.OntologyLiteral;
import org.openmetadata.schema.type.RelationshipCharacteristic;
import org.openmetadata.service.ontology.NativeOntologyCsvCodec.Column;
import org.openmetadata.service.ontology.NativeOntologyCsvCodec.RowKind;

/**
 * Writes a {@link NativeOntologyDocument} as the canonical native CSV, so that writing what was
 * read gives the same text.
 */
final class NativeOntologyCsvWriter {
  private final NativeOntologyDocument document;
  private final Map<String, TreeSet<String>> foldedParents = new HashMap<>();
  private final Set<OntologyAxiom> folded = Collections.newSetFromMap(new IdentityHashMap<>());

  private NativeOntologyCsvWriter(final NativeOntologyDocument document) {
    this.document = document;
  }

  static String write(final NativeOntologyDocument document) {
    return new NativeOntologyCsvWriter(document).write();
  }

  private String write() {
    foldParents();
    final StringBuilder out = new StringBuilder();
    try (CSVPrinter printer = new CSVPrinter(out, ROW_FORMAT)) {
      printer.printRecord(NativeOntologyCsvCodec.HEADERS);
      if (document.header() != null) {
        print(printer, ontologyRow());
      }
      for (final OntologyConcept concept : document.concepts()) {
        print(printer, conceptRow(concept));
      }
      for (final OntologyProperty property : document.properties()) {
        print(printer, propertyRow(property));
      }
      for (final OntologyAxiom axiom : document.axioms()) {
        if (!folded.contains(axiom)) {
          print(printer, axiomRow(axiom));
        }
      }
    } catch (IOException exception) {
      throw new IllegalStateException("Writing to memory cannot fail", exception);
    }
    return out.toString();
  }

  private static void print(final CSVPrinter printer, final Map<Column, String> row)
      throws IOException {
    final List<String> cells = new ArrayList<>();
    for (final Column column : Column.values()) {
      cells.add(row.getOrDefault(column, ""));
    }
    printer.printRecord(cells);
  }

  /** A parent folds into its child's row once; a repeat stays an axiom row so no statement is lost. Identity, not equality: a repeat equals the axiom it repeats. */
  private void foldParents() {
    final Set<String> conceptIris = new HashSet<>();
    document.concepts().forEach(concept -> conceptIris.add(concept.getIri().toString()));
    for (final OntologyAxiom axiom : document.axioms()) {
      final URI parent = namedParent(axiom);
      if (parent != null
          && conceptIris.contains(axiom.getSubjectIri().toString())
          && foldedParents
              .computeIfAbsent(axiom.getSubjectIri().toString(), ignored -> new TreeSet<>())
              .add(parent.toString())) {
        folded.add(axiom);
      }
    }
  }

  private static URI namedParent(final OntologyAxiom axiom) {
    if (axiom.getAxiomType() != OntologyAxiomType.SUBCLASS_OF
        || axiom.getPropertyIri() != null
        || axiom.getTargetIri() != null
        || axiom.getLiteral() != null
        || listOrEmpty(axiom.getExpressions()).size() != 1) {
      return null;
    }
    final var expression = axiom.getExpressions().getFirst();
    final boolean plain =
        expression.getClassIri() != null
            && NativeOntologyCsvReader.namedClass(expression.getClassIri()).equals(expression);
    return plain ? expression.getClassIri() : null;
  }

  private Map<Column, String> ontologyRow() {
    final Map<Column, String> row = row(RowKind.ONTOLOGY);
    final NativeOntologyDocument.Header header = document.header();
    put(row, Column.IRI, header.iri() == null ? null : header.iri().toString());
    put(row, Column.LABEL, header.label());
    put(row, Column.DESCRIPTION, header.description());
    return row;
  }

  private Map<Column, String> conceptRow(final OntologyConcept concept) {
    final Map<Column, String> row = row(RowKind.CONCEPT);
    put(row, Column.IRI, concept.getIri().toString());
    put(row, Column.LABEL, concept.getDisplayName());
    put(row, Column.DESCRIPTION, concept.getDescription());
    put(row, Column.CONCEPT_TYPE, concept.getConceptType().toString());
    put(
        row,
        Column.PARENTS,
        NativeOntologyCsvCells.join(
            List.copyOf(foldedParents.getOrDefault(concept.getIri().toString(), new TreeSet<>()))));
    put(row, Column.SYNONYMS, sortedJoin(orEmpty(concept.getSynonyms()), Function.identity()));
    put(
        row,
        Column.MAPPINGS,
        sortedJoin(listOrEmpty(concept.getConceptMappings()), NativeOntologyCsvCells::mapping));
    put(row, Column.ABSTRACT, Boolean.TRUE.equals(concept.getAbstract()) ? "true" : null);
    put(
        row,
        Column.DEFINITION_SOURCE,
        concept.getDefinitionSource() == null ? null : concept.getDefinitionSource().toString());
    put(row, Column.DEPRECATED, Boolean.TRUE.equals(concept.getDeprecated()) ? "true" : null);
    put(
        row,
        Column.REPLACED_BY,
        concept.getReplacedBy() == null ? null : concept.getReplacedBy().toString());
    return row;
  }

  private Map<Column, String> propertyRow(final OntologyProperty property) {
    final Map<Column, String> row = row(RowKind.PROPERTY);
    put(row, Column.IRI, property.getIri().toString());
    put(row, Column.LABEL, property.getDisplayName());
    put(row, Column.DESCRIPTION, property.getDescription());
    put(row, Column.PROPERTY_KIND, property.getKind().toString());
    put(row, Column.DOMAIN, sortedJoin(listOrEmpty(property.getDomain()), URI::toString));
    put(row, Column.RANGE, sortedJoin(listOrEmpty(property.getRange()), URI::toString));
    put(
        row,
        Column.ENUM_VALUES,
        NativeOntologyCsvCells.join(
            listOrEmpty(property.getEnumValues()).stream()
                .map(NativeOntologyCsvCells::literal)
                .toList()));
    put(row, Column.UNIT, property.getUnit());
    put(row, Column.IDENTIFIER, Boolean.TRUE.equals(property.getIsIdentifier()) ? "true" : null);
    put(
        row,
        Column.INVERSE,
        property.getInverse() == null ? null : property.getInverse().toString());
    put(row, Column.CHARACTERISTICS, characteristics(property));
    put(
        row,
        Column.PROPERTY_CHAIN,
        NativeOntologyCsvCells.join(
            listOrEmpty(property.getPropertyChain()).stream().map(URI::toString).toList()));
    put(
        row,
        Column.DISJOINT_WITH,
        sortedJoin(listOrEmpty(property.getDisjointWith()), URI::toString));
    put(row, Column.DEPRECATED, Boolean.TRUE.equals(property.getDeprecated()) ? "true" : null);
    put(
        row,
        Column.REPLACED_BY,
        property.getReplacedBy() == null ? null : property.getReplacedBy().toString());
    return row;
  }

  private static String characteristics(final OntologyProperty property) {
    final List<String> items =
        orEmpty(property.getCharacteristics()).stream()
            .sorted(Comparator.comparingInt(RelationshipCharacteristic::ordinal))
            .map(RelationshipCharacteristic::toString)
            .toList();
    return NativeOntologyCsvCells.join(items);
  }

  private Map<Column, String> axiomRow(final OntologyAxiom axiom) {
    final Map<Column, String> row = row(RowKind.AXIOM);
    put(row, Column.IRI, axiom.getSubjectIri().toString());
    put(row, Column.AXIOM_TYPE, axiom.getAxiomType().toString());
    put(
        row,
        Column.PROPERTY,
        axiom.getPropertyIri() == null ? null : axiom.getPropertyIri().toString());
    put(row, Column.TARGET, axiom.getTargetIri() == null ? null : axiom.getTargetIri().toString());
    put(row, Column.LITERAL, literal(axiom.getLiteral()));
    put(
        row,
        Column.EXPRESSIONS,
        listOrEmpty(axiom.getExpressions()).isEmpty()
            ? null
            : NativeOntologyCsvCells.expressions(axiom.getExpressions()));
    return row;
  }

  private static String literal(final OntologyLiteral literal) {
    return literal == null ? null : NativeOntologyCsvCells.literal(literal);
  }

  private static <T> String sortedJoin(final Collection<T> values, final Function<T, String> text) {
    return NativeOntologyCsvCells.join(
        values.stream().map(text).sorted().collect(Collectors.toList()));
  }

  private static <T> Collection<T> orEmpty(final Set<T> values) {
    return values == null ? Set.of() : values;
  }

  private static Map<Column, String> row(final RowKind kind) {
    final Map<Column, String> row = new EnumMap<>(Column.class);
    row.put(Column.KIND, kind.toString());
    return row;
  }

  private static void put(final Map<Column, String> row, final Column column, final String text) {
    if (text != null && !text.isEmpty()) {
      row.put(column, text);
    }
  }
}
