package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.policyAgent.impl;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Pure-function builder: converts DAR task variables into the raw policies list that the
 * PolicyAgent ingestion pipeline expects in {@code sourceConfig.config.policies}.
 */
public final class PolicyAgentPayloadBuilder {

  private static final String PRINCIPAL_INVALID_CHARS = "[;'\" ]";

  private PolicyAgentPayloadBuilder() {}

  public static List<Map<String, Object>> buildPolicies(
      List<Table> tables, EntityReference createdBy, Object taskPayload) {
    String principal = resolvePrincipal(createdBy);
    String privilege = resolvePrivilege(taskPayload);

    List<Map<String, Object>> policies = new ArrayList<>();
    for (Table table : tables) {
      Map<String, Object> policyConfig =
          Map.of(
              "principalType",
              "USER",
              "principal",
              principal,
              "databaseName",
              table.getDatabase().getName(),
              "schemaName",
              table.getDatabaseSchema().getName(),
              "tableName",
              table.getName(),
              "privilege",
              privilege);
      policies.add(Map.of("id", UUID.randomUUID().toString(), "config", policyConfig));
    }
    return policies;
  }

  private static String resolvePrincipal(EntityReference createdBy) {
    String name = createdBy != null ? createdBy.getName() : null;
    if (name == null || name.isBlank()) {
      throw new IllegalArgumentException("DAR requester name is missing — cannot build policy.");
    }
    if (name.matches(".*" + PRINCIPAL_INVALID_CHARS + ".*")) {
      throw new IllegalArgumentException(
          String.format(
              "Principal '%s' contains characters not allowed by the policy schema.", name));
    }
    return name;
  }

  private static String resolvePrivilege(Object taskPayload) {
    String accessType = extractAccessType(taskPayload);
    if (accessType == null) {
      return "ALL";
    }
    return switch (accessType) {
      case "ReadOnly", "ColumnLevel", "Masked" -> "SELECT";
      default -> "ALL";
    };
  }

  private static String extractAccessType(Object taskPayload) {
    Map<?, ?> map = toMapSafe(taskPayload);
    if (map == null) {
      return null;
    }
    Object value = map.get("accessType");
    return value instanceof String s ? s : null;
  }

  private static Map<?, ?> toMapSafe(Object value) {
    if (value instanceof Map<?, ?> map) {
      return map;
    }
    if (value instanceof String json && !json.isBlank() && json.trim().startsWith("{")) {
      try {
        Object parsed = JsonUtils.readValue(json.trim(), Object.class);
        return parsed instanceof Map<?, ?> parsedMap ? parsedMap : null;
      } catch (Exception ignored) {
        return null;
      }
    }
    return null;
  }
}
