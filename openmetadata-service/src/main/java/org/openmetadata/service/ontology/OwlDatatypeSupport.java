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
        || (value.startsWith(XSD.NS) && XSD_TYPES.contains(value.substring(XSD.NS.length())));
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
    return isSupported(literal.getDatatypeIri())
        && !RDF.langString.getURI().equals(iri)
        && !RDF.PlainLiteral.getURI().equals(iri)
        && datatype != null
        && datatype.isValid(literal.getValue());
  }
}
