/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.notifications.template.handlebars.helpers;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.util.EntityUtil.encodeEntityFqnSafe;

import com.github.jknack.handlebars.Handlebars;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import lombok.Value;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelper;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelperMetadata;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelperUsage;
import org.openmetadata.service.util.email.EmailUtil;

/**
 * Handlebars helper that replicates the URL building logic from MessageDecorator.buildEntityUrl()
 * This ensures consistent URL generation across legacy and Handlebars-based notification systems.
 *
 * <p>Usage in templates:
 *
 * <ul>
 *   <li>{{buildEntityUrl 'table' entityFQN}} - For simple cases with just entityType and FQN string
 *   <li>{{buildEntityUrl event.entityType entity}} - For complex cases with full entity object (ingestionPipeline, dataContract)
 * </ul>
 *
 * <p>The helper supports two calling patterns:
 * 1. Two parameters: entityType (string) and FQN (string) - simple case for standard entities
 * 2. Two parameters: entityType (string) and entity object (map) - complex case for special entities
 */
@Slf4j
public class BuildEntityUrlHelper implements HandlebarsHelper {

  private static final String KEY_FQN = "fullyQualifiedName";
  private static final String KEY_TYPE = "type";
  private static final String KEY_SERVICE = "service";
  private static final String KEY_PIPELINE_TYPE = "pipelineType";
  private static final String KEY_ENTITY = "entity";
  private static final String KEY_QUERY_USED_IN = "queryUsedIn";
  private static final String KEY_ID = "id";

  @Override
  public String getName() {
    return "buildEntityUrl";
  }

  @Override
  public void register(Handlebars handlebars) {
    handlebars.registerHelper(
        getName(),
        (context, options) -> {
          if (context == null) {
            LOG.debug("buildEntityUrl received null context");
            return null;
          }

          ParsedInput parsed = resolveInput(context, options.params);
          if (parsed == null) {
            return null;
          }

          Optional<String> fqnOpt = getTrimmed(parsed.entityMap, KEY_FQN).filter(s -> !s.isEmpty());

          if (fqnOpt.isEmpty()) {
            LOG.debug("buildEntityUrl missing fullyQualifiedName in entity");
            return null;
          }

          String fqn = fqnOpt.get();

          try {
            return buildEntityUrl(parsed.entityType, fqn, parsed.entityMap);
          } catch (Exception e) {
            LOG.error("Error building entity URL for type={}, fqn={}", parsed.entityType, fqn, e);
            return null;
          }
        });
  }

  /** Encapsulates parsing the two calling patterns into a single place. */
  @Value
  private static class ParsedInput {
    String entityType;
    Map<String, Object> entityMap;
  }

  @SuppressWarnings("unchecked")
  private ParsedInput resolveInput(Object context, Object[] params) {
    if (params == null || params.length == 0) {
      LOG.debug("buildEntityUrl requires two parameters: entityType and entity/fqn");
      return null;
    }

    String entityType = str(context).trim();
    if (entityType.isEmpty()) {
      LOG.debug("buildEntityUrl received empty entityType");
      return null;
    }

    // Pattern 1: {{buildEntityUrl 'table' entityFQN}} - entityType and FQN both strings
    if (!(params[0] instanceof Map)) {
      String fqn = str(params[0]).trim();
      if (fqn.isEmpty()) {
        LOG.debug("buildEntityUrl received empty FQN");
        return null;
      }
      // Create minimal map with just FQN
      Map<String, Object> minimalMap = Map.of(KEY_FQN, fqn);
      return new ParsedInput(entityType, minimalMap);
    }

    // Pattern 2: {{buildEntityUrl event.entityType entity}} - entityType string, entity map
    return new ParsedInput(entityType, (Map<String, Object>) params[0]);
  }

  /**
   * Builds the entity URL following the same logic as MessageDecorator.buildEntityUrl()
   * Handles special cases for different entity types.
   */
  private String buildEntityUrl(String entityType, String fqn, Map<String, Object> entityMap) {
    String baseUrl = EmailUtil.getOMBaseURL();
    if (nullOrEmpty(baseUrl)) {
      LOG.warn("Base URL is null or empty, cannot build entity URL");
      return null;
    }

    String url =
        switch (entityType) {
          case Entity.TEST_CASE ->
          // TEST_CASE: /test-case/{fqn}/test-case-results
          buildUrl(baseUrl, "test-case", fqn, "test-case-results");
          case Entity.TEST_SUITE ->
          // TEST_SUITE: /test-suites/{fqn}
          buildUrl(baseUrl, "test-suites", fqn, "");
          case Entity.GLOSSARY_TERM ->
          // GLOSSARY_TERM: /glossary/{fqn}
          buildUrl(baseUrl, Entity.GLOSSARY, fqn, "");
          case Entity.TAG -> {
            // TAG: /tags/{firstPartOfFqn}
            String tagCategory = fqn.contains(".") ? fqn.split("\\.")[0] : fqn;
            yield buildUrl(baseUrl, "tags", tagCategory, "");
          }
          case Entity.INGESTION_PIPELINE ->
          // INGESTION_PIPELINE: Complex logic depending on pipeline type
          buildIngestionPipelineUrl(baseUrl, entityMap);
          case Entity.DATA_CONTRACT ->
          // DATA_CONTRACT: Redirects to the table's contract tab
          buildDataContractUrl(baseUrl, entityMap);
          case Entity.QUERY ->
          // QUERY: Redirects to the table's queries tab with query parameters
          buildQueryUrl(baseUrl, entityMap);
          case Entity.USER ->
          // USER: /users/{fqn}
          buildUrl(baseUrl, "users", fqn, "");
          case Entity.TEAM ->
          // TEAM: /settings/members/teams/{fqn}
          buildUrl(baseUrl, "settings/members/teams", fqn, "");
          case Entity.EVENT_SUBSCRIPTION ->
          // EVENT_SUBSCRIPTION: /settings/notifications/alert/{name}/configuration
          buildUrl(baseUrl, "settings/notifications/alert", fqn, "configuration");
          case Entity.KPI ->
          // KPI: /data-insights/kpi/edit-kpi/{name}
          buildUrl(baseUrl, "data-insights/kpi/edit-kpi", fqn, "");
          case Entity.TYPE ->
          // TYPE: /settings/customProperties/{typeName}s
          buildUrl(baseUrl, "settings/customProperties", fqn + "s", "");
          case Entity.DATABASE_SERVICE,
              Entity.MESSAGING_SERVICE,
              Entity.DASHBOARD_SERVICE,
              Entity.PIPELINE_SERVICE,
              Entity.MLMODEL_SERVICE,
              Entity.STORAGE_SERVICE,
              Entity.SEARCH_SERVICE,
              Entity.METADATA_SERVICE,
              Entity.API_SERVICE,
              Entity.DRIVE_SERVICE,
              Entity.SECURITY_SERVICE -> {
            // SERVICE ENTITIES: /service/{serviceType}s/{fqn}
            // Pluralize the service type (e.g., databaseService -> databaseServices)
            String pluralServiceType = entityType + "s";
            yield buildUrl(baseUrl, "service/" + pluralServiceType, fqn, "");
          }
          default ->
          // DEFAULT: /{entityType}/{fqn}
          buildUrl(baseUrl, entityType, fqn, "");
        };

    LOG.debug("Built entity URL for type={}, fqn={}: {}", entityType, fqn, url);
    return url;
  }

  /**
   * Builds a standard entity URL with optional additional parameters
   * Format: {baseUrl}/{prefix}/{encodedFqn}[/{additionalParams}]
   */
  private String buildUrl(String baseUrl, String prefix, String fqn, String additionalParams) {
    String encodedFqn = encodeEntityFqnSafe(fqn);
    String suffix = nullOrEmpty(additionalParams) ? "" : "/" + additionalParams;
    return String.format("%s/%s/%s%s", baseUrl, prefix, encodedFqn, suffix);
  }

  /**
   * Builds URL for ingestion pipeline entities
   * Replicates IngestionPipelineFormatter.getIngestionPipelineUrl()
   */
  @SuppressWarnings("unchecked")
  private String buildIngestionPipelineUrl(String baseUrl, Map<String, Object> entityMap) {
    try {
      Object serviceObj = entityMap.get(KEY_SERVICE);
      if (!(serviceObj instanceof Map)) {
        LOG.debug("Ingestion pipeline missing service reference");
        return null;
      }
      Map<String, Object> serviceMap = (Map<String, Object>) serviceObj;

      String serviceFqn = getTrimmed(serviceMap, KEY_FQN).orElse("");
      String serviceType = getTrimmed(serviceMap, KEY_TYPE).orElse("");
      String pipelineFqn = getTrimmed(entityMap, KEY_FQN).orElse("");

      if (serviceFqn.isEmpty()) {
        LOG.debug("Service FQN is null or empty");
        return null;
      }

      String pipelineType = getTrimmed(entityMap, KEY_PIPELINE_TYPE).orElse("");
      return switch (PipelineType.fromValue(pipelineType)) {
        case TEST_SUITE ->
        // TEST_SUITE: /testSuite/{serviceFqn}/logs
        buildUrl(baseUrl, "testSuite", pipelineFqn, "logs");

        case APPLICATION ->
        // APPLICATION: /automations/{serviceFqn}/automator-details
        buildUrl(baseUrl, "automations", serviceFqn, "automator-details");

        case PROFILER, LINEAGE, USAGE, METADATA, AUTO_CLASSIFICATION ->
        // DEFAULT: /databaseServices/{serviceFqn}/logs
        buildUrl(baseUrl, "databaseServices", pipelineFqn, "logs");

        default -> {
          // DEFAULT: /service/{serviceType}s/{serviceFqn}/ingestions
          String prefix = "service/" + serviceType + "s";
          yield buildUrl(baseUrl, prefix, serviceFqn, "ingestions");
        }
      };

    } catch (Exception e) {
      LOG.error("Error building ingestion pipeline URL", e);
      return null;
    }
  }

  /**
   * Builds URL for data contract entities
   * Redirects to the table's contract tab
   * Replicates IngestionPipelineFormatter.getDataContractUrl()
   */
  @SuppressWarnings("unchecked")
  private String buildDataContractUrl(String baseUrl, Map<String, Object> entityMap) {
    try {
      Object entityObj = entityMap.get(KEY_ENTITY);
      if (!(entityObj instanceof Map)) {
        LOG.debug("Data contract missing entity reference");
        return null;
      }

      Map<String, Object> tableRefMap = (Map<String, Object>) entityObj;
      String tableFqn = getTrimmed(tableRefMap, KEY_FQN).orElse("");
      String tableType = getTrimmed(tableRefMap, KEY_TYPE).orElse("");

      if (tableFqn.isEmpty() || tableType.isEmpty()) {
        LOG.debug("Data contract entity reference missing type or FQN");
        return null;
      }

      // DATA_CONTRACT: /{tableType}/{tableFqn}/contract
      return buildUrl(baseUrl, tableType, tableFqn, "contract");
    } catch (Exception e) {
      LOG.error("Error building data contract URL", e);
      return null;
    }
  }

  /**
   * Builds URL for query entities
   * Redirects to the table's queries tab with query parameters
   * Format: /table/{tableFqn}/table_queries?tableId={tableId}&query={queryId}&queryFrom=1
   */
  @SuppressWarnings("unchecked")
  private String buildQueryUrl(String baseUrl, Map<String, Object> entityMap) {
    try {
      String queryId = getTrimmed(entityMap, KEY_ID).orElse("");
      if (queryId.isEmpty()) {
        return null;
      }

      Object queryUsedInObj = entityMap.get(KEY_QUERY_USED_IN);
      if (!(queryUsedInObj instanceof List<?> queryUsedInList)) {
        return null;
      }

      if (queryUsedInList.isEmpty()) {
        return null;
      }

      Object firstTableObj = queryUsedInList.getFirst();
      if (!(firstTableObj instanceof Map)) {
        return null;
      }

      Map<String, Object> tableRefMap = (Map<String, Object>) firstTableObj;
      String tableFqn = getTrimmed(tableRefMap, KEY_FQN).orElse("");
      String tableId = getTrimmed(tableRefMap, KEY_ID).orElse("");

      if (tableFqn.isEmpty() || tableId.isEmpty()) {
        return null;
      }

      // Build URL: /table/{tableFqn}/table_queries?tableId={tableId}&query={queryId}&queryFrom=1
      String encodedTableFqn = encodeEntityFqnSafe(tableFqn);
      return String.format(
          "%s/table/%s/table_queries?tableId=%s&query=%s&queryFrom=1",
          baseUrl, encodedTableFqn, tableId, queryId);
    } catch (Exception e) {
      LOG.error("Error building query URL", e);
      return null;
    }
  }

  private static Optional<String> getTrimmed(Map<String, Object> map, String key) {
    return Optional.ofNullable(map.get(key)).map(BuildEntityUrlHelper::str).map(String::trim);
  }

  private static String str(Object o) {
    return o == null ? "" : o.toString();
  }

  @Override
  public HandlebarsHelperMetadata getMetadata() {
    return new HandlebarsHelperMetadata()
        .withName("buildEntityUrl")
        .withDescription("Build UI URL for entity reference")
        .withCursorOffset(17)
        .withUsages(
            List.of(
                new HandlebarsHelperUsage()
                    .withSyntax("{{buildEntityUrl }}")
                    .withExample("{{buildEntityUrl entity}}")));
  }
}
