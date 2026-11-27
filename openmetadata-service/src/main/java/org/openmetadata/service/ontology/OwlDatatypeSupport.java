package org.openmetadata.service.ontology;

import java.net.URI;
import java.util.Set;
import org.apache.jena.datatypes.TypeMapper;
import org.apache.jena.vocabulary.OWL2;
import org.apache.jena.vocabulary.RDF;
import org.apache.jena.vocabulary.RDFS;
import org.apache.jena.vocabulary.XSD;
import org.openmetadata.schema.type.OntologyLiteral;

/** The OWL 2 datatype map; arbitrary XSD names are not necessarily OWL 2 DL datatypes. */
public final class OwlDatatypeSupport {
  /**
   * The OWL 2 datatype map has no date-only type, so a Date property ranges over this datatype,
   * defined as equivalent to {@code xsd:dateTime}; values are dateTimes at midnight. A defined
   * datatype has no lexical space of its own, so literals are typed {@code xsd:dateTime}.
   *
   * <p>See ADR:2026-11-16-ontology-date-properties-range-over-om-date.
   */
  public static final URI DATE = URI.create("https://open-metadata.org/ontology/date");

  private static final Set<String> XSD_TYPES =
      Set.of(
          "string",
          "normalizedString",
          "token",
          "language",
          "Name",
          "NCName",
          "NMTOKEN",
          "decimal",
          "integer",
          "nonNegativeInteger",
          "nonPositiveInteger",
          "positiveInteger",
          "negativeInteger",
          "long",
          "int",
          "short",
          "byte",
          "unsignedLong",
          "unsignedInt",
          "unsignedShort",
          "unsignedByte",
          "double",
          "float",
          "boolean",
          "hexBinary",
          "base64Binary",
          "anyURI",
          "dateTime",
          "dateTimeStamp");
  private static final Set<String> OTHER_TYPES =
      Set.of(
          RDFS.Literal.getURI(),
          RDF.PlainLiteral.getURI(),
          RDF.langString.getURI(),
          RDF.xmlLiteral.getURI(),
          OWL2.NS + "real",
          OWL2.NS + "rational");

  private OwlDatatypeSupport() {}

  public static boolean isSupported(final URI iri) {
    final String value = iri == null ? "" : iri.toString();
    return OTHER_TYPES.contains(value)
        || isDate(value)
        || (value.startsWith(XSD.NS) && XSD_TYPES.contains(value.substring(XSD.NS.length())));
  }

  public static boolean isDate(final String iri) {
    return DATE.toString().equals(iri);
  }

  public static boolean isValidLiteral(final OntologyLiteral literal) {
    if (literal == null || literal.getValue() == null) {
      return false;
    }
    if (literal.getDatatypeIri() == null) {
      return true;
    }
    final String iri = literal.getDatatypeIri().toString();
    final var datatype = TypeMapper.getInstance().getTypeByName(iri);
    // The literal schema has no language tag, so it cannot encode language-tagged RDF literals.
    // DATE is checked by name: parsing any om:date literal registers a permissive Jena type for it.
    return isSupported(literal.getDatatypeIri())
        && !isDate(iri)
        && !RDF.langString.getURI().equals(iri)
        && !RDF.PlainLiteral.getURI().equals(iri)
        && datatype != null
        && datatype.isValid(literal.getValue());
  }
}
