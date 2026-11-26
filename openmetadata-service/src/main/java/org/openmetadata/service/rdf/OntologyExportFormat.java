package org.openmetadata.service.rdf;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.Arrays;
import java.util.Locale;
import org.openmetadata.schema.type.NativeOntologyExportFormat;

/**
 * Every serialization a captured ontology release can be exported as. The RDF graph formats reuse
 * {@link RdfSerializationFormat}; SKOS and SKOS-XL are concept projections written as Turtle, and
 * CSV is the native ontology spreadsheet, which has no RDF serialization.
 */
public enum OntologyExportFormat {
  TURTLE(NativeOntologyExportFormat.TURTLE, RdfSerializationFormat.TURTLE),
  RDF_XML(NativeOntologyExportFormat.RDFXML, RdfSerializationFormat.RDF_XML),
  N_TRIPLES(NativeOntologyExportFormat.NTRIPLES, RdfSerializationFormat.N_TRIPLES),
  JSON_LD(NativeOntologyExportFormat.JSONLD, RdfSerializationFormat.JSON_LD),
  SKOS(NativeOntologyExportFormat.SKOS, RdfSerializationFormat.TURTLE),
  SKOS_XL(NativeOntologyExportFormat.SKOS_XL, RdfSerializationFormat.TURTLE),
  CSV(NativeOntologyExportFormat.CSV, null);

  private final NativeOntologyExportFormat wire;
  private final RdfSerializationFormat serialization;

  OntologyExportFormat(
      final NativeOntologyExportFormat wire, final RdfSerializationFormat serialization) {
    this.wire = wire;
    this.serialization = serialization;
  }

  /** Accepts the schema's format values, plus {@code skosxl}, media types and RDF aliases. */
  public static OntologyExportFormat parse(final String requested) {
    if (nullOrEmpty(requested) || requested.isBlank()) {
      return TURTLE;
    }
    final String name = requested.trim().toLowerCase(Locale.ROOT);
    return Arrays.stream(values())
        .filter(format -> format.wire.value().equals(name))
        .findFirst()
        .orElseGet(() -> alias(name, requested));
  }

  private static OntologyExportFormat alias(final String name, final String requested) {
    return switch (name) {
      case "skosxl" -> SKOS_XL;
      case "text/csv" -> CSV;
      default -> fromSerialization(RdfSerializationFormat.parse(requested));
    };
  }

  private static OntologyExportFormat fromSerialization(final RdfSerializationFormat format) {
    return switch (format) {
      case TURTLE -> TURTLE;
      case RDF_XML -> RDF_XML;
      case N_TRIPLES -> N_TRIPLES;
      case JSON_LD -> JSON_LD;
    };
  }

  public NativeOntologyExportFormat wire() {
    return wire;
  }

  public boolean isGraph() {
    return serialization != null;
  }

  /** The RDF serialization of a graph format; a CSV export has none. */
  public RdfSerializationFormat serialization() {
    if (serialization == null) {
      throw new IllegalStateException(wire.value() + " is not an RDF serialization");
    }
    return serialization;
  }

  public String mediaType() {
    return isGraph() ? serialization.mediaType() : "text/csv";
  }

  public String extension() {
    return isGraph() ? serialization.extension() : "csv";
  }
}
