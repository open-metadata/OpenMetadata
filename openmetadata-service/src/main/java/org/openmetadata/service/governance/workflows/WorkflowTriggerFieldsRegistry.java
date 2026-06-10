package org.openmetadata.service.governance.workflows;

import io.github.classgraph.ClassGraph;
import io.github.classgraph.Resource;
import io.github.classgraph.ScanResult;
import java.io.InputStream;
import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;
import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONTokener;
import org.openmetadata.schema.type.WorkflowTriggerFields;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Source of truth for the fields whose change can trigger a governance workflow, per entity type.
 *
 * <p>Each entity JSON Schema declares a top-level {@code workflowTriggerFields} array listing the
 * fields eligible to trigger workflows for that entity. This registry scans those schemas once at
 * first use and caches an {@code entityType -> trigger-field-set} map. Entities without a
 * declaration fall back to the global {@link WorkflowTriggerFields} enum so behavior is never lost.
 */
public final class WorkflowTriggerFieldsRegistry {
  private static final Logger LOG = LoggerFactory.getLogger(WorkflowTriggerFieldsRegistry.class);
  private static final String SCHEMA_PATH = "json/schema";
  private static final String TRIGGER_FIELDS_KEY = "workflowTriggerFields";

  private static volatile Map<String, Set<String>> triggerFieldsByEntityType;

  private WorkflowTriggerFieldsRegistry() {}

  /** Fields declared for the entity type; empty if the entity declares none. */
  public static Set<String> getTriggerFields(String entityType) {
    if (entityType == null) {
      return Collections.emptySet();
    }
    return load().getOrDefault(entityType, Collections.emptySet());
  }

  /** Declared fields for the entity type, or the global enum as a safety fallback. */
  public static Set<String> getEffectiveTriggerFields(String entityType) {
    Set<String> declared = getTriggerFields(entityType);
    return declared.isEmpty() ? globalTriggerFields() : declared;
  }

  private static Set<String> globalTriggerFields() {
    return Arrays.stream(WorkflowTriggerFields.values())
        .map(WorkflowTriggerFields::value)
        .collect(Collectors.toCollection(LinkedHashSet::new));
  }

  private static Map<String, Set<String>> load() {
    if (triggerFieldsByEntityType == null) {
      synchronized (WorkflowTriggerFieldsRegistry.class) {
        if (triggerFieldsByEntityType == null) {
          triggerFieldsByEntityType = scanSchemas();
        }
      }
    }
    return triggerFieldsByEntityType;
  }

  private static Map<String, Set<String>> scanSchemas() {
    Map<String, Set<String>> result = new ConcurrentHashMap<>();
    try (ScanResult scanResult =
        new ClassGraph().acceptPaths(SCHEMA_PATH).enableMemoryMapping().scan()) {
      for (Resource resource : scanResult.getResourcesWithExtension("json")) {
        readSchema(resource, result);
      }
    } catch (Exception e) {
      LOG.error("Failed to scan schemas for workflow trigger fields", e);
    }
    LOG.info("Loaded workflow trigger fields for {} entity types", result.size());
    return result;
  }

  private static void readSchema(Resource resource, Map<String, Set<String>> result) {
    try (InputStream is = resource.open()) {
      JSONArray fields = new JSONObject(new JSONTokener(is)).optJSONArray(TRIGGER_FIELDS_KEY);
      if (fields != null) {
        result.put(entityTypeFromPath(resource.getPath()), toFieldSet(fields));
      }
    } catch (Exception e) {
      LOG.warn("Skipping schema {} while loading workflow trigger fields", resource.getPath(), e);
    }
  }

  private static Set<String> toFieldSet(JSONArray fields) {
    Set<String> triggerFields = new LinkedHashSet<>();
    for (int i = 0; i < fields.length(); i++) {
      triggerFields.add(fields.getString(i));
    }
    return Collections.unmodifiableSet(triggerFields);
  }

  private static String entityTypeFromPath(String path) {
    String fileName = path.substring(path.lastIndexOf('/') + 1);
    return fileName.substring(0, fileName.length() - ".json".length());
  }
}
