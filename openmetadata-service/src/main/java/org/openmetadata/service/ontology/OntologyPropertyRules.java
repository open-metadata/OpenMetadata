package org.openmetadata.service.ontology;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.net.URI;
import java.util.Collection;
import java.util.EnumSet;
import java.util.List;
import java.util.Objects;
import java.util.function.BooleanSupplier;
import java.util.function.Supplier;
import java.util.stream.Stream;
import org.apache.jena.datatypes.RDFDatatype;
import org.apache.jena.datatypes.TypeMapper;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.type.OntologyLiteral;
import org.openmetadata.schema.type.OntologyPropertyKind;
import org.openmetadata.schema.type.RelationshipCharacteristic;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * The rules a property must meet on its own. The repository enforces them on every write and the
 * import preview runs them on every parsed property, so a preview never counts a property that
 * apply refuses.
 */
public final class OntologyPropertyRules {
  private static final int MAX_UNIT_LENGTH = 256;
  private static final int MAX_ENUM_VALUES = 1000;

  private OntologyPropertyRules() {}

  /** The first rule a property breaks, naming the field the author has to change. */
  public record Violation(String field, String message) {}

  /**
   * @param keepsStoredEnumeration whether the stored property already holds exactly these enum
   *     values. A one-value enumeration saved before that rule stays editable until its values
   *     change.
   */
  public static Violation firstViolation(
      final OntologyProperty property, final BooleanSupplier keepsStoredEnumeration) {
    if (property.getKind() == null) {
      return new Violation("kind", "Ontology property kind is required");
    }
    return Stream.<Supplier<Violation>>of(
            () -> distinctIris(property.getDomain(), "domain"),
            () -> distinctIris(property.getRange(), "range"),
            () -> absoluteIris(property.getPropertyChain(), "propertyChain"),
            () -> distinctIris(property.getDisjointWith(), "disjointWith"),
            () -> optionalIri(property.getInverse(), "inverse"),
            () -> optionalIri(property.getReplacedBy(), "replacedBy"),
            () -> kind(property),
            () -> dataMetadata(property),
            () -> lists(property, keepsStoredEnumeration))
        .map(Supplier::get)
        .filter(Objects::nonNull)
        .findFirst()
        .orElse(null);
  }

  /** The message for an IRI that is missing or relative, or null when it is absolute. */
  public static String relativeIriMessage(final URI iri, final String name) {
    return iri == null || !iri.isAbsolute()
        ? "Ontology " + name + " must be an absolute IRI"
        : null;
  }

  private static Violation absoluteIri(final URI iri, final String field, final String name) {
    final String message = relativeIriMessage(iri, name);
    return message == null ? null : new Violation(field, message);
  }

  private static Violation optionalIri(final URI iri, final String field) {
    return iri == null ? null : absoluteIri(iri, field, field);
  }

  private static Violation absoluteIris(final Collection<URI> iris, final String field) {
    if (iris == null) {
      return null;
    }
    return iris.stream()
        .map(iri -> absoluteIri(iri, field, field))
        .filter(Objects::nonNull)
        .findFirst()
        .orElse(null);
  }

  private static Violation distinctIris(final Collection<URI> iris, final String field) {
    final Violation violation = absoluteIris(iris, field);
    if (violation != null) {
      return violation;
    }
    if (!nullOrEmpty(iris) && iris.stream().map(URI::toString).distinct().count() != iris.size()) {
      return new Violation(field, field + " requires unique IRIs");
    }
    return null;
  }

  private static Violation kind(final OntologyProperty property) {
    final OntologyPropertyKind kind = property.getKind();
    if (kind != OntologyPropertyKind.OBJECT
        && (property.getInverse() != null || !nullOrEmpty(property.getPropertyChain()))) {
      return new Violation(
          property.getInverse() != null ? "inverse" : "propertyChain",
          "Only object properties can have inverses or property chains");
    }
    final EnumSet<RelationshipCharacteristic> allowed =
        switch (kind) {
          case OBJECT -> EnumSet.allOf(RelationshipCharacteristic.class);
          case DATA -> EnumSet.of(RelationshipCharacteristic.FUNCTIONAL);
          case ANNOTATION -> EnumSet.noneOf(RelationshipCharacteristic.class);
        };
    if (!nullOrEmpty(property.getCharacteristics())
        && !allowed.containsAll(property.getCharacteristics())) {
      return new Violation(
          "characteristics", "Unsupported characteristics for " + kind + " property");
    }
    if (kind == OntologyPropertyKind.ANNOTATION && !nullOrEmpty(property.getDisjointWith())) {
      return new Violation("disjointWith", "Annotation properties cannot declare disjointness");
    }
    return null;
  }

  private static Violation dataMetadata(final OntologyProperty property) {
    final List<OntologyLiteral> values = property.getEnumValues();
    final String unit = property.getUnit();
    if (property.getKind() != OntologyPropertyKind.DATA) {
      final String field = dataOnlyField(property);
      if (field != null) {
        return new Violation(
            field, "Only data properties can define enum values, units or identifier intent");
      }
    }
    if (unit != null && (unit.isBlank() || unit.length() > MAX_UNIT_LENGTH)) {
      return new Violation("unit", "An ontology property unit requires 1 to 256 characters");
    }
    if (values != null && values.size() > MAX_ENUM_VALUES) {
      return new Violation("enumValues", "An ontology property supports at most 1000 enum values");
    }
    return listOrEmpty(values).stream()
        .map(OntologyPropertyRules::literal)
        .filter(Objects::nonNull)
        .findFirst()
        .orElse(null);
  }

  private static String dataOnlyField(final OntologyProperty property) {
    if (!nullOrEmpty(property.getEnumValues())) {
      return "enumValues";
    }
    if (property.getUnit() != null) {
      return "unit";
    }
    return Boolean.TRUE.equals(property.getIsIdentifier()) ? "isIdentifier" : null;
  }

  private static Violation literal(final OntologyLiteral literal) {
    if (literal == null || literal.getValue() == null) {
      return new Violation("enumValues", "An ontology enum literal requires a value");
    }
    if (literal.getDatatypeIri() == null) {
      return null;
    }
    final Violation relative = absoluteIri(literal.getDatatypeIri(), "enumValues", "enum datatype");
    if (relative != null) {
      return relative;
    }
    final RDFDatatype datatype =
        TypeMapper.getInstance().getTypeByName(literal.getDatatypeIri().toString());
    return datatype != null && !datatype.isValid(literal.getValue())
        ? new Violation("enumValues", "An ontology enum value is invalid for its datatype")
        : null;
  }

  private static Violation lists(
      final OntologyProperty property, final BooleanSupplier keepsStoredEnumeration) {
    final List<OntologyLiteral> values = listOrEmpty(property.getEnumValues());
    if (values.size() == 1 && !keepsStoredEnumeration.getAsBoolean()) {
      return new Violation("enumValues", "An enumeration needs at least two allowed values");
    }
    if (values.stream().map(JsonUtils::pojoToJson).distinct().count() != values.size()) {
      return new Violation("enumValues", "Ontology property enum values must be unique");
    }
    final List<URI> chain = listOrEmpty(property.getPropertyChain());
    if (!nullOrEmpty(chain) && chain.size() < 2) {
      return new Violation(
          "propertyChain", "A property chain requires at least two object properties");
    }
    return null;
  }
}
