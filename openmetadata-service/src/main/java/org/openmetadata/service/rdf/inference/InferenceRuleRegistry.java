package org.openmetadata.service.rdf.inference;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.configuration.rdf.InferenceRule;

/**
 * In-memory registry of OpenMetadata inference rules. The starter pack is loaded once per JVM
 * from the classpath under {@code rdf/inference-rules/}; further entries can be {@link
 * #upsert(InferenceRule) upserted} programmatically.
 *
 * <p>This is intentionally a Phase-1 storage shape — there is no DB-backed persistence yet.
 * Admin REST writes call {@link #upsert(InferenceRule)} after passing validation. A follow-up
 * phase will swap this in-memory registry for a JDBI-backed repository without changing the
 * exposed API.
 */
@Slf4j
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
    if (starterLoaded) return;
    int loaded = 0;
    for (String path : STARTER_PACK) {
      try (InputStream is = InferenceRuleRegistry.class.getResourceAsStream(path)) {
        if (is == null) {
          LOG.warn("Inference rule starter pack resource missing: {}", path);
          continue;
        }
        InferenceRule rule = mapper.readValue(is, InferenceRule.class);
        List<String> errors = InferenceRuleValidator.validate(rule);
        if (!errors.isEmpty()) {
          LOG.error("Starter pack rule '{}' failed validation: {}", path, errors);
          continue;
        }
        rules.put(rule.getName(), rule);
        loaded++;
      } catch (IOException e) {
        LOG.error("Failed to load starter pack rule {}", path, e);
      }
    }
    starterLoaded = true;
    LOG.info("Loaded {} inference rules from starter pack", loaded);
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

  /**
   * Insert or replace a rule. The caller is responsible for validation (see {@link
   * InferenceRuleValidator}); this method does no validation itself.
   */
  public synchronized void upsert(InferenceRule rule) {
    loadStarterPackIfNeeded();
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
