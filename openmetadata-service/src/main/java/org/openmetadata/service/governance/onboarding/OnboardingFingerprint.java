package org.openmetadata.service.governance.onboarding;

import com.fasterxml.jackson.databind.JsonNode;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.UUID;
import java.util.stream.StreamSupport;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.governance.onboarding.OnboardingConfiguration;
import org.openmetadata.schema.governance.onboarding.OnboardingInstance;
import org.openmetadata.schema.governance.onboarding.OnboardingStep;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * What an approval was given for. An approver signs off on a set of values, so the moment any of
 * those values changes the decision no longer covers the asset and a fresh approval is asked for.
 *
 * <p>The digest deliberately ignores presentation-only churn: a reference re-hydrated with a new
 * display name, or a set of owners returned in a different order, is the same metadata and must not
 * invalidate a decision. An ordered custom value is not - reordering a list is a real edit.
 */
final class OnboardingFingerprint {
  private static final List<String> ALWAYS_COVERED =
      List.of("domains", "tags", "owners", "reviewers", "experts");

  private OnboardingFingerprint() {}

  static String of(OnboardingInstance instance, EntityInterface entity) {
    JsonNode values = JsonUtils.valueToTree(entity);
    Map<String, Object> captured = new TreeMap<>();
    coveredPaths(instance)
        .forEach(path -> captured.put(path, canonical(OnboardingEvaluator.valueAt(values, path))));
    return UUID.nameUUIDFromBytes(JsonUtils.pojoToJson(captured).getBytes(StandardCharsets.UTF_8))
        .toString();
  }

  /** Every field the playbook reads: what it captures, what it branches on, and the shared ones. */
  private static TreeSet<String> coveredPaths(OnboardingInstance instance) {
    var paths = new TreeSet<>(ALWAYS_COVERED);
    paths.addAll(OnboardingConfigurationValidator.creationFields(instance.getEntity().getType()));
    OnboardingConfiguration configuration =
        instance.getConfiguration() == null ? null : instance.getConfiguration().getOnboarding();
    if (configuration == null) return paths;
    for (var gate : configuration.getGates()) {
      for (OnboardingStep step : gate.getSteps()) {
        if (step.getFieldPath() != null) paths.add(step.getFieldPath());
        if (step.getConditions() == null) continue;
        step.getConditions().stream()
            .map(condition -> condition.getFieldPath())
            .filter(Objects::nonNull)
            .forEach(paths::add);
      }
    }
    return paths;
  }

  private static Object canonical(JsonNode value) {
    if (value == null || value.isMissingNode() || value.isNull()) return null;
    // An absent list and an empty one are the same metadata: a sparse read yields null where a
    // hydrated read yields [], and that difference must not read as an edit.
    if (value.isContainerNode() && value.isEmpty()) return null;
    if (value.isArray()) return canonicalArray(value);
    if (value.isObject()) return canonicalObject(value);
    return value;
  }

  private static Object canonicalArray(JsonNode value) {
    List<Object> items = new ArrayList<>();
    value.forEach(item -> items.add(canonical(item)));
    if (StreamSupport.stream(value.spliterator(), false)
        .allMatch(OnboardingFingerprint::isRelationship)) {
      items.sort(Comparator.comparing(JsonUtils::pojoToJson));
    }
    return items;
  }

  private static Object canonicalObject(JsonNode value) {
    if (value.hasNonNull("id") && value.hasNonNull("type"))
      return Map.of("id", value.get("id").asText(), "type", value.get("type").asText());
    if (value.hasNonNull("tagFQN")) return value.get("tagFQN").asText();
    Map<String, Object> fields = new TreeMap<>();
    value
        .fields()
        .forEachRemaining(field -> fields.put(field.getKey(), canonical(field.getValue())));
    return fields;
  }

  private static boolean isRelationship(JsonNode value) {
    return value.hasNonNull("tagFQN") || (value.hasNonNull("id") && value.hasNonNull("type"));
  }
}
