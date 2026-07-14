package org.openmetadata.service.rdf.inference;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.net.URL;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import org.openmetadata.schema.api.configuration.rdf.InferenceRule;

/**
 * In-memory registry of OpenMetadata inference rules. The starter pack is loaded once per JVM
 * from the classpath under {@code rdf/inference-rules/}; further entries can be {@link
 * #upsert(InferenceRule) upserted} programmatically.
 *
 * <p>This is intentionally a Phase-1 storage shape — there is no DB-backed persistence yet. The
 * registry validates every write so callers cannot bypass its invariants. A follow-up phase will
 * swap this in-memory registry for a JDBI-backed repository without changing the exposed API.
 */
public final class InferenceRuleRegistry {

  private static final String[] STARTER_PACK = {
    "/rdf/inference-rules/transitive-lineage-closure.json",
    "/rdf/inference-rules/pii-propagation-via-lineage.json",
    "/rdf/inference-rules/schema-tag-inheritance.json",
    "/rdf/inference-rules/domain-membership-inheritance.json"
  };

  private static final InferenceRuleRegistry INSTANCE = new InferenceRuleRegistry();

  public static InferenceRuleRegistry getInstance() {
    return INSTANCE;
  }

  // ConcurrentHashMap supports lock-free reads from {@link #list()} / {@link #get(String)} while
  // {@link #upsert} / {@link #delete} mutate concurrently. Iteration order isn't preserved, so
  // {@code list()} sorts explicitly (priority + name) for deterministic API output.
  private final ConcurrentMap<String, InferenceRule> rules = new ConcurrentHashMap<>();
  private final ObjectMapper mapper = new ObjectMapper();
  private volatile boolean starterLoaded = false;

  private InferenceRuleRegistry() {}

  /**
   * Load the starter pack from the classpath. Idempotent.
   */
  public synchronized void loadStarterPackIfNeeded() {
    if (!starterLoaded) {
      List<InferenceRule> starterRules =
          Arrays.stream(STARTER_PACK).map(this::readStarterRule).toList();
      starterRules.forEach(rule -> rules.put(rule.getName(), rule));
      starterLoaded = true;
    }
  }

  private InferenceRule readStarterRule(String resourcePath) {
    URL resource =
        Optional.ofNullable(InferenceRuleRegistry.class.getResource(resourcePath))
            .orElseThrow(
                () ->
                    new IllegalStateException(
                        "Required inference rule resource is missing: " + resourcePath));
    try (InputStream input = resource.openStream()) {
      InferenceRule rule = mapper.readValue(input, InferenceRule.class);
      requireValid(rule, resourcePath);
      return rule;
    } catch (IOException exception) {
      throw new IllegalStateException(
          "Unable to read inference rule resource: " + resourcePath, exception);
    }
  }

  private static void requireValid(InferenceRule rule, String context) {
    List<String> errors = InferenceRuleValidator.validate(rule);
    if (!errors.isEmpty()) {
      throw new IllegalArgumentException(
          "Invalid inference rule '%s': %s".formatted(context, String.join("; ", errors)));
    }
  }

  /** @return all rules in priority order, then by name. */
  public List<InferenceRule> list() {
    loadStarterPackIfNeeded();
    return rules.values().stream()
        .sorted(
            Comparator.comparing(
                    (InferenceRule r) -> r.getPriority() == null ? 100 : r.getPriority())
                .thenComparing(InferenceRule::getName))
        .toList();
  }

  /** @return the rule with the given name, or empty if no such rule. */
  public Optional<InferenceRule> get(String name) {
    loadStarterPackIfNeeded();
    return Optional.ofNullable(rules.get(name));
  }

  /** Insert or replace a valid rule. */
  public synchronized void upsert(InferenceRule rule) {
    loadStarterPackIfNeeded();
    requireValid(rule, rule == null ? "unknown" : rule.getName());
    rules.put(rule.getName(), rule);
  }

  /** @return true if a rule with that name was removed. */
  public synchronized boolean delete(String name) {
    loadStarterPackIfNeeded();
    return rules.remove(name) != null;
  }

  /** Clear the registry. Visible for tests. */
  synchronized void resetForTests() {
    rules.clear();
    starterLoaded = false;
  }
}
