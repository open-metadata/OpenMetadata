package org.openmetadata.service.rdf;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.Locale;

/**
 * Every serialization a captured ontology release can be exported as. The RDF graph formats reuse
 * {@link RdfSerializationFormat}; SKOS and SKOS-XL are concept projections written as Turtle, and
 * CSV is the native ontology spreadsheet, which has no RDF serialization.
 */
public enum OntologyExportFormat {
  TURTLE("turtle", RdfSerializationFormat.TURTLE),
  RDF_XML("rdfxml", RdfSerializationFormat.RDF_XML),
  N_TRIPLES("ntriples", RdfSerializationFormat.N_TRIPLES),
  JSON_LD("jsonld", RdfSerializationFormat.JSON_LD),
  SKOS("skos", RdfSerializationFormat.TURTLE),
  SKOS_XL("skos-xl", RdfSerializationFormat.TURTLE),
  CSV("csv", null);

  private final String externalName;
  private final RdfSerializationFormat serialization;

  OntologyExportFormat(final String externalName, final RdfSerializationFormat serialization) {
    this.externalName = externalName;
    this.serialization = serialization;
  }

  public static OntologyExportFormat parse(final String requested) {
    if (nullOrEmpty(requested) || requested.isBlank()) {
      return TURTLE;
    }
    return switch (requested.trim().toLowerCase(Locale.ROOT)) {
      case "skos" -> SKOS;
      case "skos-xl", "skosxl" -> SKOS_XL;
      case "csv", "text/csv" -> CSV;
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

  public String externalName() {
    return externalName;
  }

  public boolean isGraph() {
    return serialization != null;
  }

  /** The RDF serialization of a graph format; a CSV export has none. */
  public RdfSerializationFormat serialization() {
    if (serialization == null) {
      throw new IllegalStateException(externalName + " is not an RDF serialization");
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
