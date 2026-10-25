package org.openmetadata.service.ontology;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.Arrays;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;

/**
 * The native ontology CSV: one definition per row, documented in {@code
 * docs/native-ontology-csv.md}. The column order and the cells each row kind may fill are defined
 * once here and shared by the reader, the writer, and the format detector.
 */
public final class NativeOntologyCsvCodec {
  static final char ITEM_SEPARATOR = ';';
  static final String BOM = "﻿";
  static final CSVFormat ROW_FORMAT = CSVFormat.RFC4180;
  static final CSVFormat CELL_FORMAT =
      CSVFormat.RFC4180.builder().setDelimiter(ITEM_SEPARATOR).build();
  static final List<String> HEADERS = Arrays.stream(Column.values()).map(Column::header).toList();
  static final String HEADER = String.join(",", HEADERS);

  private NativeOntologyCsvCodec() {}

  public static NativeOntologyDocument read(final String csv) {
    return new NativeOntologyCsvReader().read(csv);
  }

  public static String write(final NativeOntologyDocument document) {
    return NativeOntologyCsvWriter.write(document);
  }

  /** True when the line is this format's header row; a BOM and a trailing CR are tolerated. */
  public static boolean isHeader(final String firstLine) {
    if (firstLine == null) {
      return false;
    }
    try (CSVParser parser = CSVParser.parse(stripBom(firstLine), ROW_FORMAT)) {
      final List<CSVRecord> records = parser.getRecords();
      return records.size() == 1 && isHeaderRecord(records.getFirst());
    } catch (IOException | UncheckedIOException exception) {
      return false;
    }
  }

  static boolean isHeaderRecord(final CSVRecord record) {
    return record.toList().equals(HEADERS);
  }

  static String stripBom(final String text) {
    return text.startsWith(BOM) ? text.substring(BOM.length()) : text;
  }

  enum Column {
    KIND("kind"),
    IRI("iri"),
    LABEL("label"),
    DESCRIPTION("description"),
    CONCEPT_TYPE("conceptType"),
    PARENTS("parents"),
    SYNONYMS("synonyms"),
    MAPPINGS("mappings"),
    PROPERTY_KIND("propertyKind"),
    DOMAIN("domain"),
    RANGE("range"),
    ENUM_VALUES("enumValues"),
    UNIT("unit"),
    IDENTIFIER("identifier"),
    INVERSE("inverse"),
    CHARACTERISTICS("characteristics"),
    PROPERTY_CHAIN("propertyChain"),
    DISJOINT_WITH("disjointWith"),
    AXIOM_TYPE("axiomType"),
    PROPERTY("property"),
    TARGET("target"),
    LITERAL("literal"),
    EXPRESSIONS("expressions"),
    ABSTRACT("abstract"),
    DEFINITION_SOURCE("definitionSource"),
    DEPRECATED("deprecated"),
    REPLACED_BY("replacedBy");

    private final String header;

    Column(final String header) {
      this.header = header;
    }

    String header() {
      return header;
    }
  }

  /** What a row of each kind must fill and may fill; any other filled cell fails the row. */
  enum RowKind {
    ONTOLOGY(
        EnumSet.noneOf(Column.class), EnumSet.of(Column.IRI, Column.LABEL, Column.DESCRIPTION)),
    CONCEPT(
        EnumSet.of(Column.IRI, Column.CONCEPT_TYPE),
        EnumSet.of(
            Column.LABEL,
            Column.DESCRIPTION,
            Column.PARENTS,
            Column.SYNONYMS,
            Column.MAPPINGS,
            Column.ABSTRACT,
            Column.DEFINITION_SOURCE,
            Column.DEPRECATED,
            Column.REPLACED_BY)),
    PROPERTY(
        EnumSet.of(Column.IRI, Column.PROPERTY_KIND),
        EnumSet.of(
            Column.LABEL,
            Column.DESCRIPTION,
            Column.DOMAIN,
            Column.RANGE,
            Column.ENUM_VALUES,
            Column.UNIT,
            Column.IDENTIFIER,
            Column.INVERSE,
            Column.CHARACTERISTICS,
            Column.PROPERTY_CHAIN,
            Column.DISJOINT_WITH,
            Column.DEPRECATED,
            Column.REPLACED_BY)),
    AXIOM(
        EnumSet.of(Column.IRI, Column.AXIOM_TYPE),
        EnumSet.of(Column.PROPERTY, Column.TARGET, Column.LITERAL, Column.EXPRESSIONS));

    private final Set<Column> required;
    private final Set<Column> allowed;

    RowKind(final Set<Column> required, final Set<Column> optional) {
      final EnumSet<Column> all = EnumSet.of(Column.KIND);
      all.addAll(required);
      all.addAll(optional);
      this.required = Set.copyOf(required);
      this.allowed = Set.copyOf(all);
    }

    boolean requires(final Column column) {
      return required.contains(column);
    }

    boolean allows(final Column column) {
      return allowed.contains(column);
    }
  }
}
