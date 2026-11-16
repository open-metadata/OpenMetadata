package org.openmetadata.service.glossary;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.apache.jena.vocabulary.XSD;
import org.openmetadata.schema.type.GlossaryTermProperty;
import org.openmetadata.service.ontology.OwlDatatypeSupport;

/** Checks the values a term stores for a property against the property's definition. */
public final class GlossaryTermPropertyValues {
  public static final int MAX_VALUE_LENGTH = 2048;
  public static final int MAX_MULTI_VALUES = 100;
  private static final Set<String> BOOLEAN_LITERALS = Set.of("true", "false");
  private static final Set<String> WEB_SCHEMES = Set.of("http", "https");

  private GlossaryTermPropertyValues() {}

  /** The first reason {@code values} do not fit {@code property}, or empty when they fit. */
  public static Optional<String> problem(
      final GlossaryTermProperty property, final List<String> values) {
    final List<String> checked = listOrEmpty(values);
    final int limit = Boolean.TRUE.equals(property.getMultiValued()) ? MAX_MULTI_VALUES : 1;
    if (checked.size() > limit) {
      return Optional.of(
          "Property '%s' holds at most %d value%s, got %d"
              .formatted(property.getName(), limit, limit == 1 ? "" : "s", checked.size()));
    }
    return checked.stream()
        .map(value -> valueProblem(property, value))
        .flatMap(Optional::stream)
        .findFirst();
  }

  public static void validate(final GlossaryTermProperty property, final List<String> values) {
    problem(property, values)
        .ifPresent(
            reason -> {
              throw new IllegalArgumentException(reason);
            });
  }

  private static Optional<String> valueProblem(
      final GlossaryTermProperty property, final String value) {
    final boolean valid =
        value != null && isWithinLength(value) && isValidForDatatype(property, value);
    return valid
        ? Optional.empty()
        : Optional.of(
            "Value '%s' is not a valid %s for property '%s'"
                .formatted(abbreviate(value), property.getDatatype().value(), property.getName()));
  }

  private static boolean isWithinLength(final String value) {
    return value.length() <= MAX_VALUE_LENGTH;
  }

  private static boolean isValidForDatatype(
      final GlossaryTermProperty property, final String value) {
    return switch (property.getDatatype()) {
      case STRING -> true;
      case INTEGER -> OwlDatatypeSupport.isValidXsdLexicalForm(XSD.integer.getURI(), value);
      case DECIMAL -> OwlDatatypeSupport.isValidXsdLexicalForm(XSD.decimal.getURI(), value);
      case BOOLEAN -> BOOLEAN_LITERALS.contains(value);
      case DATE -> OwlDatatypeSupport.isValidXsdLexicalForm(XSD.date.getURI(), value);
      case DATE_TIME -> OwlDatatypeSupport.isValidXsdLexicalForm(XSD.dateTime.getURI(), value);
      case ENUM -> property.getEnumValues().contains(value);
      case URL -> isWebUrl(value);
    };
  }

  private static boolean isWebUrl(final String value) {
    try {
      final URI uri = new URI(value);
      return uri.getScheme() != null
          && WEB_SCHEMES.contains(uri.getScheme().toLowerCase(java.util.Locale.ROOT))
          && uri.getHost() != null;
    } catch (URISyntaxException e) {
      return false;
    }
  }

  private static String abbreviate(final String value) {
    if (value == null) {
      return "null";
    }
    return value.length() > 64 ? value.substring(0, 64) + "..." : value;
  }
}
