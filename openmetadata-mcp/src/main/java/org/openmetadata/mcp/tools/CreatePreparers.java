package org.openmetadata.mcp.tools;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.classification.CreateClassification;
import org.openmetadata.schema.api.classification.CreateTag;
import org.openmetadata.schema.api.context.CreateContextMemory;
import org.openmetadata.schema.api.data.CreateMetric;
import org.openmetadata.schema.api.data.MetricExpression;
import org.openmetadata.schema.api.domains.CreateDataProduct;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.context.ContextMemorySourceType;
import org.openmetadata.schema.type.EventType;
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
      request.setDomainType(CreateDomain.DomainType.AGGREGATE);
    }
    preflightParentDomain(normalize(request.getParent()));
    CommonUtils.preflightExperts(orEmpty(request.getExperts()));
  }

  static void dataProduct(CreateDataProduct request) {
    CommonUtils.preflightDomains(orEmpty(request.getDomains()));
    CommonUtils.preflightExperts(orEmpty(request.getExperts()));
  }

  /**
   * A metric is the expression that computes it, so an empty one is not a metric. The required-field
   * check only proves the key is present, and an empty object satisfies that; {@code
   * MetricRepository.prepare} validates only related metrics and the custom unit, so nothing further
   * down would catch it.
   */
  static void metric(CreateMetric request) {
    MetricExpression expression = request.getMetricExpression();
    boolean incomplete =
        expression == null || expression.getLanguage() == null || nullOrEmpty(expression.getCode());
    if (incomplete) {
      throw new IllegalArgumentException(
          "Attribute 'metricExpression' needs both 'language' and a non-empty 'code', e.g."
              + " {\"language\": \"SQL\", \"code\": \"SELECT count(*) FROM orders\"}. Nothing was"
              + " created.");
    }
  }

  /**
   * Provenance is a fact about how the memory arrived, not caller input, so it is stamped rather
   * than defaulted. Left to the schema it would come out {@code Manual}, which reads as a hand
   * written catalog edit and hides the memory from the Memory Agent that derives glossary terms and
   * metrics from explicit "remember this" requests.
   */
  static void contextMemory(CreateContextMemory request) {
    request.setSourceType(ContextMemorySourceType.REMEMBER_REQUEST);
  }

  /**
   * Says so when the store kept a different {@code mutuallyExclusive} than the request carried. The
   * field is immutable once a classification exists, so an update quietly discards it - and a
   * silently dropped value is the failure this tool set exists to remove.
   *
   * <p>Note the request always carries a value: absent means the schema default {@code false}. The
   * warning therefore reports what the request said, which is what was actually ignored.
   */
  static void classificationNote(
      CreateClassification request,
      EntityInterface saved,
      EventType changeType,
      Map<String, Object> result) {
    Boolean requested = request.getMutuallyExclusive();
    Boolean stored = ((Classification) saved).getMutuallyExclusive();
    boolean discardedOnUpdate =
        !EventType.ENTITY_CREATED.equals(changeType) && !Objects.equals(requested, stored);
    if (discardedOnUpdate) {
      result.put(
          "_warning",
          "mutuallyExclusive cannot be changed on an existing classification. Retained existing"
              + " value: "
              + stored
              + ". Supplied value "
              + requested
              + " was ignored.");
    }
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
