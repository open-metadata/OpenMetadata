package org.openmetadata.mcp.tools;

import java.util.List;
import org.openmetadata.schema.api.classification.CreateClassification;
import org.openmetadata.schema.api.classification.CreateTag;
import org.openmetadata.schema.api.domains.CreateDataProduct;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * The work that genuinely belongs to one entity type, kept out of the shared create path.
 *
 * <p>Everything the replaced tools did that was really type checking or enum parsing is gone -
 * binding to the generated request class already does it, and {@code describe_entity_type} reports
 * the allowed values rather than each tool restating them in an error string. What is left is the
 * part binding cannot do: deriving a field from another, and checking that a referenced entity
 * exists before the write is attempted.
 */
final class CreatePreparers {

  private static final String DEFAULT_DOMAIN_TYPE = "Aggregate";

  private CreatePreparers() {}

  static void classification(CreateClassification request) {
    CommonUtils.preflightDomains(orEmpty(request.getDomains()));
  }

  static void tag(CreateTag request) {
    String parent = normalize(request.getParent());
    String classification = resolveClassification(request.getClassification(), parent);
    request.setClassification(classification);
    request.setParent(parent);
    preflightClassification(classification);
    preflightParentTag(parent);
    CommonUtils.preflightDomains(orEmpty(request.getDomains()));
  }

  static void domain(CreateDomain request) {
    if (request.getDomainType() == null) {
      request.setDomainType(CreateDomain.DomainType.fromValue(DEFAULT_DOMAIN_TYPE));
    }
    preflightParentDomain(normalize(request.getParent()));
    CommonUtils.preflightExperts(orEmpty(request.getExperts()));
  }

  static void dataProduct(CreateDataProduct request) {
    CommonUtils.preflightDomains(orEmpty(request.getDomains()));
    CommonUtils.preflightExperts(orEmpty(request.getExperts()));
  }

  /**
   * A tag's classification is the root segment of its parent, so naming the parent is enough. When
   * both are given they must agree - silently preferring one would put the tag somewhere the
   * caller did not ask for.
   */
  static String resolveClassification(String classification, String parent) {
    boolean hasClassification = classification != null && !classification.isBlank();
    String result;
    if (parent != null && !hasClassification) {
      result = FullyQualifiedName.split(parent)[0];
    } else if (parent != null) {
      String derived = FullyQualifiedName.split(parent)[0];
      if (!classification.equals(derived)) {
        throw new IllegalArgumentException(
            "'classification' ("
                + classification
                + ") must be the root segment of 'parent' ("
                + parent
                + "). Expected '"
                + derived
                + "'.");
      }
      result = classification;
    } else if (hasClassification) {
      result = classification;
    } else {
      throw new IllegalArgumentException(
          "Attribute 'classification' is required for a tag. Provide the classification this tag"
              + " belongs to (e.g. 'PII', 'Tier'), or a 'parent' tag to derive it from.");
    }
    return result;
  }

  private static void preflightClassification(String classification) {
    CommonUtils.requireExists(
        Entity.CLASSIFICATION,
        classification,
        "Classification '"
            + classification
            + "' not found. Create it first with create_entity (entityType='classification') or"
            + " verify its name.");
  }

  private static void preflightParentTag(String parent) {
    if (parent != null) {
      CommonUtils.requireExists(
          Entity.TAG,
          parent,
          "Parent tag '"
              + parent
              + "' not found. Verify the FQN format is 'Classification.TagName' (e.g."
              + " 'PII.PersonalData').");
    }
  }

  private static void preflightParentDomain(String parent) {
    if (parent != null) {
      CommonUtils.requireExists(
          Entity.DOMAIN,
          parent,
          "Parent domain '"
              + parent
              + "' not found. The parent domain must already exist before creating a child"
              + " domain.");
    }
  }

  private static String normalize(String value) {
    String result = null;
    if (value != null && !value.isBlank()) {
      result = value.trim();
    }
    return result;
  }

  private static List<String> orEmpty(List<String> values) {
    return values == null ? List.of() : values;
  }
}
