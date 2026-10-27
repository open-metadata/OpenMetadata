package org.openmetadata.service.ontology;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.net.URI;
import java.util.List;
import java.util.function.BooleanSupplier;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.type.OntologyLiteral;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * The list rules a stored property must meet. The repository enforces them on every write and the
 * import preview runs them before offering Import, so both read one definition.
 */
public final class OntologyPropertyLists {
  private OntologyPropertyLists() {}

  /** The first list rule a property breaks, naming the field the author has to change. */
  public record Violation(String field, String message) {}

  /**
   * @param keepsStoredEnumeration whether the stored property already holds exactly these enum
   *     values. A one-value enumeration saved before this rule stays editable until its values
   *     change.
   */
  public static Violation firstViolation(
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
