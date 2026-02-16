package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;
import org.openmetadata.schema.api.data.CreateEntityProfile;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.EntityInterfaceUtil;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.databases.DatasourceConfig;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.FullyQualifiedName;

public class ListFilter extends Filter<ListFilter> {
  public static final String NULL_PARAM = "null";

  public ListFilter() {
    this(Include.NON_DELETED);
  }

  public ListFilter(Include include) {
    this.include = include;
  }

  public String getCondition(String tableName) {
    ArrayList<String> conditions = new ArrayList<>();
    conditions.add(getIncludeCondition(tableName));
    conditions.add(getDatabaseCondition(tableName));
    conditions.add(getDatabaseSchemaCondition(tableName));
    conditions.add(getServiceCondition(tableName));
    conditions.add(getServiceTypeCondition(tableName));
    conditions.add(getPipelineTypeCondition(tableName));
    conditions.add(getApplicationTypeCondition());
    conditions.add(getParentCondition(tableName));
    conditions.add(getDisabledCondition());
    conditions.add(getCategoryCondition(tableName));
    conditions.add(getWebhookCondition(tableName));
    conditions.add(getWebhookTypeCondition(tableName));
    conditions.add(getTestCaseCondition());
    conditions.add(getEntityProfileCondition());
    conditions.add(getTestCaseIncidentCondition());
    conditions.add(getTestSuiteTypeCondition(tableName));
    conditions.add(getTestSuiteFQNCondition());
    conditions.add(getDomainCondition(tableName));
    conditions.add(getOwnerCondition(tableName));
    conditions.add(getTierCondition(tableName));
    conditions.add(getEntityFQNHashCondition());
    conditions.add(getTestCaseResolutionStatusType());
    conditions.add(getDirectoryCondition(tableName));
    conditions.add(getSpreadsheetCondition(tableName));
    conditions.add(getFileTypeCondition(tableName));
    conditions.add(getAssignee());
    conditions.add(getCreatedByCondition());
    conditions.add(getAboutEntityCondition());
    conditions.add(getMentionedUserCondition());
    conditions.add(getEventSubscriptionAlertType());
    conditions.add(getNotificationTemplateCondition());
    conditions.add(getApiCollectionCondition(tableName));
    conditions.add(getWorkflowDefinitionIdCondition());
    conditions.add(getEntityLinkCondition());
    conditions.add(getAgentTypeCondition());
    conditions.add(getProviderCondition(tableName));
conditions.add(getTaskStatusCondition(tableName));
    conditions.add(getTaskTypeCondition(tableName));
    conditions.add(getTaskPriorityCondition(tableName));
    conditions.add(getEntityStatusCondition());
    String condition = addCondition(conditions);
    return condition.isEmpty() ? "WHERE TRUE" : "WHERE " + condition;
  }

  public ResourceContext getResourceContext(String entityType) {
    if (queryParams.containsKey("service") && queryParams.get("service") != null) {
      return new ResourceContext<>(
          Entity.getServiceType(entityType), null, queryParams.get("service"));
    } else if (queryParams.containsKey(Entity.DATABASE)
        && queryParams.get(Entity.DATABASE) != null) {
      return new ResourceContext<>(Entity.DATABASE, null, queryParams.get(Entity.DATABASE));
    } else if (queryParams.containsKey(Entity.DATABASE_SCHEMA)
        && queryParams.get(Entity.DATABASE_SCHEMA) != null) {
      return new ResourceContext<>(
          Entity.DATABASE_SCHEMA, null, queryParams.get(Entity.DATABASE_SCHEMA));
    } else if (queryParams.containsKey(Entity.API_COLLECTION)
        && queryParams.get(Entity.API_COLLECTION) != null) {
      return new ResourceContext<>(
          Entity.API_COLLECTION, null, queryParams.get(Entity.API_COLLECTION));
    }
    return new ResourceContext<>(entityType);
  }

  /**
   * Get the parent entity ResourceContext when filtering by entityId and entityType.
   * This is used for authorization checks on the parent entity (e.g., checking VIEW_QUERIES
   * permission on a table when listing queries for that table).
   *
   * @return ResourceContext for the parent entity, or null if entityId/entityType not specified
   */
  public ResourceContext<?> getParentResourceContext() {
    String entityId = queryParams.get("entityId");
    String parentEntityType = queryParams.get("entityType");
    if (!nullOrEmpty(entityId) && !nullOrEmpty(parentEntityType)) {
      return new ResourceContext<>(parentEntityType, java.util.UUID.fromString(entityId), null);
    }
    return null;
  }

  private String getAssignee() {
    String assigneeId = queryParams.get("assigneeId");
    if (assigneeId != null) {
      queryParams.put("assigneeIdParam", assigneeId);
      return String.format(
          "(id IN (SELECT entity_relationship.toId FROM entity_relationship "
              + "WHERE entity_relationship.fromEntity IN ('user', 'team') "
              + "AND entity_relationship.fromId = :assigneeIdParam "
              + "AND entity_relationship.relation = %d))",
          Relationship.ASSIGNED_TO.ordinal());
    }

    String assigneeFqn = queryParams.get("assignee");
    if (assigneeFqn == null) {
      return "";
    }
    String assigneeFqnHash = FullyQualifiedName.buildHash(assigneeFqn);
    queryParams.put("assigneeFqnHashParam", assigneeFqnHash);
    return String.format(
        "(id IN (SELECT er.toId FROM entity_relationship er "
            + "INNER JOIN user_entity u ON er.fromId = u.id "
            + "WHERE er.fromEntity = 'user' "
            + "AND u.nameHash = :assigneeFqnHashParam "
            + "AND er.relation = %d) "
            + "OR id IN (SELECT er.toId FROM entity_relationship er "
            + "INNER JOIN team_entity t ON er.fromId = t.id "
            + "WHERE er.fromEntity = 'team' "
            + "AND t.nameHash = :assigneeFqnHashParam "
            + "AND er.relation = %d))",
        Relationship.ASSIGNED_TO.ordinal(), Relationship.ASSIGNED_TO.ordinal());
  }

  /**
   * Filter tasks by the entity they are about.
   * Uses prefix matching to include tasks about sub-entities (e.g., columns when viewing a table).
   * The FQN is converted to a hash to avoid key length limitations.
   */
  private String getAboutEntityCondition() {
    String aboutEntityFqn = queryParams.get("aboutEntity");
    if (aboutEntityFqn == null) {
      return "";
    }
    String fqnHash = FullyQualifiedName.buildHash(aboutEntityFqn);
    queryParams.put("aboutFqnHashParam", fqnHash);
    queryParams.put("aboutFqnHashPrefixParam", fqnHash + ".%");
    return "(aboutFqnHash = :aboutFqnHashParam OR aboutFqnHash LIKE :aboutFqnHashPrefixParam)";
  }

  /**
   * Filter tasks/entities by mentioned user.
   * Uses field_relationship table to find entities where the user was mentioned
   * via MENTIONED_IN relationship.
   */
  private String getMentionedUserCondition() {
    String mentionedUser = queryParams.get("mentionedUser");
    if (mentionedUser == null) {
      return "";
    }
    queryParams.put("mentionedUserParam", mentionedUser);
    return String.format(
        "(id IN (SELECT fr.toId FROM field_relationship fr "
            + "WHERE fr.fromFQN = :mentionedUserParam "
            + "AND fr.toType = 'task' "
            + "AND fr.relation = %d))",
        Relationship.MENTIONED_IN.ordinal());
  }

  /**
   * Filter tasks by creator. Supports two modes:
   * - createdById: Uses CREATED relationship for exact UUID match
   * - createdBy: Uses CREATED relationship with FQN lookup
   */
  private String getCreatedByCondition() {
    String createdById = queryParams.get("createdById");
    if (createdById != null) {
      queryParams.put("createdByIdParam", createdById);
      return String.format(
          "(id IN (SELECT entity_relationship.toId FROM entity_relationship "
              + "WHERE entity_relationship.fromEntity = 'user' "
              + "AND entity_relationship.fromId = :createdByIdParam "
              + "AND entity_relationship.relation = %d))",
          Relationship.CREATED.ordinal());
    }

    String createdBy = queryParams.get("createdBy");
    if (createdBy == null) {
      return "";
    }
    String createdByFqnHash = FullyQualifiedName.buildHash(createdBy);
    queryParams.put("createdByFqnHashParam", createdByFqnHash);
    return String.format(
        "(id IN (SELECT er.toId FROM entity_relationship er "
            + "INNER JOIN user_entity u ON er.fromId = u.id "
            + "WHERE er.fromEntity = 'user' "
            + "AND u.nameHash = :createdByFqnHashParam "
            + "AND er.relation = %d))",
        Relationship.CREATED.ordinal());
  }

  private String getWorkflowDefinitionIdCondition() {
    String workflowDefinitionId = queryParams.get("workflowDefinitionId");
    return workflowDefinitionId == null
        ? ""
        : String.format("workflowDefinitionId = '%s'", workflowDefinitionId);
  }

  private String getEntityLinkCondition() {
    String entityLinkStr = queryParams.get("entityLink");
    return entityLinkStr == null ? "" : "entityLink = :entityLink";
  }

  private String getEntityStatusCondition() {
    String entityStatus = queryParams.get("entityStatus");
    if (entityStatus == null || entityStatus.trim().isEmpty()) {
      return "";
    }

    if (Boolean.TRUE.equals(DatasourceConfig.getInstance().isMySQL())) {
      return "json->>'$.entityStatus' = :entityStatus";
    } else {
      return "json->>'entityStatus' = :entityStatus";
    }
  }

  private String getAgentTypeCondition() {
    String agentTypes = queryParams.get("agentType");
    if (agentTypes == null || agentTypes.trim().isEmpty()) {
      return "";
    } else {
      // Handle multiple values using the existing pattern
      String inCondition = getInConditionFromString(agentTypes);
      if (Boolean.TRUE.equals(DatasourceConfig.getInstance().isMySQL())) {
        return String.format("JSON_EXTRACT(json, '$.agentType') IN (%s)", inCondition);
      } else {
        return String.format("json->>'agentType' IN (%s)", inCondition);
      }
    }
  }

  public String getProviderCondition(String tableName) {
    String provider = queryParams.get("provider");
    if (provider == null) {
      return "";
    } else {
      if (Boolean.TRUE.equals(DatasourceConfig.getInstance().isMySQL())) {
        return tableName == null
            ? "JSON_EXTRACT(json, '$.provider') = :provider"
            : String.format("JSON_EXTRACT(%s.json, '$.provider') = :provider", tableName);
      } else {
        return tableName == null
            ? "json->>'provider' = :provider"
            : String.format("%s.json->>'provider' = :provider", tableName);
      }
    }
  }

  private String getEventSubscriptionAlertType() {
    String alertType = queryParams.get("alertType");
    if (alertType == null) {
      return "";
    } else {
      if (Boolean.TRUE.equals(DatasourceConfig.getInstance().isMySQL())) {
        return "JSON_UNQUOTE(JSON_EXTRACT(json, '$.alertType')) = :alertType";
      } else {
        return "json->>'alertType' = :alertType";
      }
    }
  }

  private String getNotificationTemplateCondition() {
    String notificationTemplate = queryParams.get("notificationTemplate");
    if (notificationTemplate == null) {
      return "";
    } else {
      if (Boolean.TRUE.equals(DatasourceConfig.getInstance().isMySQL())) {
        return "JSON_UNQUOTE(JSON_EXTRACT(json, '$.notificationTemplate.id')) = :notificationTemplate";
      } else {
        return "json->'notificationTemplate'->>'id' = :notificationTemplate";
      }
    }
  }

  private String getTestCaseResolutionStatusType() {
    String testFailureStatus = queryParams.get("testCaseResolutionStatusType");
    return testFailureStatus == null
        ? ""
        : String.format("testCaseResolutionStatusType = '%s'", testFailureStatus);
  }

  public String getIncludeCondition(String tableName) {
    String columnName = tableName == null ? "deleted" : tableName + ".deleted";
    if (include == Include.NON_DELETED || include == Include.DELETED) {
      return columnName + String.format(" = %s", include == Include.NON_DELETED ? "FALSE" : "TRUE");
    }
    return "";
  }

  public String getDatabaseCondition(String tableName) {
    String database = queryParams.get("database");
    return database == null ? "" : getFqnPrefixCondition(tableName, database, "database");
  }

  public String getDatabaseSchemaCondition(String tableName) {
    String databaseSchema = queryParams.get("databaseSchema");
    if (databaseSchema == null) {
      return "";
    }

    if (!nullOrEmpty(tableName)
        && (tableName.equals("table_entity") || tableName.equals("stored_procedure_entity"))) {
      String databaseSchemaHash = FullyQualifiedName.buildHash(databaseSchema);
      queryParams.put("databaseSchemaHashExact", databaseSchemaHash);
      return String.format("%s.databaseSchemaHash = :databaseSchemaHashExact", tableName);
    }

    return getFqnPrefixCondition(tableName, databaseSchema, "databaseSchema");
  }

  public String getServiceCondition(String tableName) {
    String service = queryParams.get("service");
    if (service == null || service.isEmpty()) {
      return "";
    }
    // Special handling for pipeline_entity - use entity_relationship join
    if (tableName != null && tableName.equals("pipeline_entity")) {
      String safeService = service.replace("'", "''");
      String entityIdColumn = tableName + ".id";
      return String.format(
          "(EXISTS (SELECT 1 FROM entity_relationship er JOIN pipeline_service_entity pse ON er.fromId = pse.id WHERE er.toId = %s AND er.fromEntity = 'pipelineService' AND er.toEntity = 'pipeline' AND er.relation = 0 AND pse.name = '%s'))",
          entityIdColumn, safeService);
    }
    return getFqnPrefixCondition(tableName, EntityInterfaceUtil.quoteName(service), "service");
  }

  public String getServiceTypeCondition(String tableName) {
    String serviceType = queryParams.get("serviceType");
    if (serviceType == null || serviceType.isEmpty()) {
      return "";
    }
    if (tableName != null && tableName.equals("pipeline_entity")) {
      String safeServiceType = serviceType.replace("'", "''");
      return String.format(
          "JSON_UNQUOTE(JSON_EXTRACT(%s.json, '$.serviceType')) = '%s'",
          tableName, safeServiceType);
    }
    return "";
  }

  public String getTestSuiteFQNCondition() {
    String testSuiteName = queryParams.get("testSuite");
    return testSuiteName == null ? "" : getFqnPrefixCondition(null, testSuiteName, "testSuite");
  }

  private String getDomainCondition(String tableName) {
    String domainId = getQueryParam("domainId");
    String entityIdColumn = nullOrEmpty(tableName) ? "id" : (tableName + ".id");
    String domainAccessControl = getQueryParam("domainAccessControl");
    if (domainId == null) {
      return "";
    }

    if (NULL_PARAM.equals(domainId)) {
      String entityType = getQueryParam("entityType");
      String entityTypeCondition =
          nullOrEmpty(entityType)
              ? ""
              : String.format("AND entity_relationship.toEntity='%s'", entityType);
      return String.format(
          "(%s NOT IN (SELECT entity_relationship.toId FROM entity_relationship WHERE entity_relationship.fromEntity='domain' %s AND relation=10))",
          entityIdColumn, entityTypeCondition);
    }

    if (Boolean.TRUE.toString().equals(domainAccessControl)) {
      // allow passing entities with no domains
      return String.format(
          "(NOT EXISTS (SELECT 1 FROM entity_relationship er WHERE er.relation=10 AND er.fromEntity='domain' AND er.toId = %s) OR "
              + "%s IN (SELECT er2.toId FROM entity_relationship er2 WHERE er2.fromEntity='domain' AND er2.fromId IN (%s) AND er2.relation=10))",
          entityIdColumn, entityIdColumn, domainId);
    }

    return String.format(
        "(%s in (SELECT entity_relationship.toId FROM entity_relationship WHERE entity_relationship.fromEntity='domain' AND entity_relationship.fromId IN (%s) AND "
            + "relation=10))",
        entityIdColumn, domainId);
  }

  private String getOwnerCondition(String tableName) {
    String ownerId = getQueryParam("ownerId");
    if (ownerId == null) {
      return "";
    }
    String entityIdColumn = nullOrEmpty(tableName) ? "id" : (tableName + ".id");
    queryParams.put("ownerIdParam", ownerId);
    return String.format(
        "(%s IN (SELECT entity_relationship.toId FROM entity_relationship WHERE entity_relationship.fromEntity IN ('user', 'team') AND entity_relationship.fromId = :ownerIdParam AND relation=8))",
        entityIdColumn);
  }

  private String getTierCondition(String tableName) {
    String tier = getQueryParam("tier");
    if (tier == null || tier.isEmpty()) {
      return "";
    }
    String safeTier = tier.replace("'", "''");
    String fqnHashColumn = nullOrEmpty(tableName) ? "fqnHash" : (tableName + ".fqnHash");
    return String.format(
        "(EXISTS (SELECT 1 FROM tag_usage tu WHERE tu.targetFQNHash = %s AND tu.tagFQN = '%s'))",
        fqnHashColumn, safeTier);
  }

  public String getApiCollectionCondition(String apiEndpoint) {
    String apiCollection = queryParams.get("apiCollection");
    return apiCollection == null
        ? ""
        : getFqnPrefixCondition(apiEndpoint, apiCollection, "apiCollection");
  }

  private String getEntityFQNHashCondition() {
    String entityFQN = getQueryParam("entityFQNHash");
    return entityFQN == null ? "" : "entityFQNHash = :entityFQNHash";
  }

  public String getParentCondition(String tableName) {
    String parentFqn = queryParams.get("parent");
    return parentFqn == null ? "" : getFqnPrefixCondition(tableName, parentFqn, "parent");
  }

  public String getDirectoryCondition(String tableName) {
    String directoryFqn = queryParams.get("directory");
    if (directoryFqn == null) {
      return "";
    }
    return String.format("directoryFqn = '%s'", directoryFqn);
  }

  public String getSpreadsheetCondition(String tableName) {
    String spreadsheetFqn = queryParams.get("spreadsheet");
    return spreadsheetFqn == null
        ? ""
        : getFqnPrefixCondition(tableName, spreadsheetFqn, "spreadsheet");
  }

  public String getFileTypeCondition(String tableName) {
    String fileType = queryParams.get("fileType");
    if (fileType == null) {
      return "";
    }
    return String.format("fileType = '%s'", fileType);
  }

  public String getDisabledCondition() {
    String disabledStr = queryParams.get("disabled");
    if (disabledStr == null) {
      return "";
    }
    boolean disabled = Boolean.parseBoolean(disabledStr);
    String disabledCondition;
    if (Boolean.TRUE.equals(DatasourceConfig.getInstance().isMySQL())) {
      if (disabled) {
        disabledCondition = "JSON_EXTRACT(json, '$.disabled') = TRUE";
      } else {
        disabledCondition =
            "(JSON_EXTRACT(json, '$.disabled') IS NULL OR JSON_EXTRACT(json, '$.disabled') = FALSE)";
      }
    } else {
      if (disabled) {
        disabledCondition = "((c.json#>'{disabled}')::boolean)  = TRUE)";
      } else {
        disabledCondition =
            "(c.json#>'{disabled}' IS NULL OR ((c.json#>'{disabled}'):boolean) = FALSE";
      }
    }
    return disabledCondition;
  }

  public String getCategoryCondition(String tableName) {
    String category = queryParams.get("category");
    return category == null ? "" : getCategoryPrefixCondition(tableName, category);
  }

  public String getWebhookCondition(String tableName) {
    String webhookStatus = queryParams.get("status");
    return webhookStatus == null ? "" : getStatusPrefixCondition(tableName, webhookStatus);
  }

  public String getWebhookTypeCondition(String tableName) {
    String webhookType = queryParams.get("webhookType");
    return webhookType == null ? "" : getWebhookTypePrefixCondition(tableName, webhookType);
  }

  public String getPipelineTypeCondition(String tableName) {
    String pipelineType = queryParams.get("pipelineType");
    return pipelineType == null ? "" : getPipelineTypePrefixCondition(tableName, pipelineType);
  }

  public String getApplicationTypeCondition() {
    String applicationType = queryParams.get("applicationType");
    if (applicationType == null) {
      return "";
    }
    return "(appType = :applicationType)";
  }

  private String getEntityProfileCondition() {
    ArrayList<String> conditions = new ArrayList<>();

    String profileType = getQueryParam("entityProfileType");
    String columnName = getQueryParam("entityProfileColumnName");
    String fqn = getQueryParam("entityProfileFQN");
    String entityType = getQueryParam("entityProfileEntityType");

    if (columnName != null && !columnName.isEmpty()) {
      Table table = Entity.getEntityByName(Entity.TABLE, fqn, "columns", Include.ALL);
      Column column = EntityUtil.getColumn(table, columnName);
      fqn = column.getFullyQualifiedName();
      queryParams.put("entityProfileFQNHash", FullyQualifiedName.buildHash(fqn, Entity.SEPARATOR));
      conditions.add("entityFQNHash = :entityProfileFQNHash");
    }

    if (fqn != null && !fqn.isEmpty() && (columnName == null || columnName.isEmpty())) {
      if (Boolean.TRUE.equals(DatasourceConfig.getInstance().isMySQL())) {
        conditions.add("json -> '$.entityReference.fullyQualifiedName' = :entityProfileFQN");
      } else {
        conditions.add("json -> 'entityReference' ->> 'fullyQualifiedName' = :entityProfileFQN");
      }
      queryParams.put("entityProfileFQN", fqn);
    }

    if (profileType != null) {
      String extension =
          EntityProfileRepository.getExtension(
              CreateEntityProfile.ProfileTypeEnum.fromValue(profileType));
      conditions.add("extension = :entityProfileExtension");
      queryParams.put("entityProfileExtension", extension);
    }

    if (entityType != null) {
      if (Boolean.TRUE.equals(DatasourceConfig.getInstance().isMySQL())) {
        conditions.add("json -> '$.entityReference.type' = :entityProfileType");
      } else {
        conditions.add("json -> 'entityReference' ->> 'type' = :entityProfileType");
      }
      queryParams.put("entityProfileType", entityType);
    }

    return addCondition(conditions);
  }

  private String getTestCaseCondition() {
    ArrayList<String> conditions = new ArrayList<>();

    String entityFQN = getQueryParam("entityFQN");
    boolean includeAllTests = Boolean.parseBoolean(getQueryParam("includeAllTests"));
    String status = getQueryParam("testCaseStatus");
    String testSuiteId = getQueryParam("testSuiteId");
    String type = getQueryParam("testCaseType");

    if (entityFQN != null) {
      // EntityLink gets validated in the resource layer
      // EntityLink entityLinkParsed = EntityLink.parse(entityLink);
      // filter.addQueryParam("entityFQN", entityLinkParsed.getFullyQualifiedFieldValue());
      conditions.add(
          includeAllTests
              ? String.format(
                  "(entityFQN LIKE '%s%s%%' OR entityFQN = '%s')",
                  escape(entityFQN), Entity.SEPARATOR, escapeApostrophe(entityFQN))
              : String.format("entityFQN = '%s'", escapeApostrophe(entityFQN)));
    }

    if (testSuiteId != null) {
      queryParams.put("testSuiteId", testSuiteId);
      conditions.add(
          String.format(
              "id IN (SELECT toId FROM entity_relationship WHERE fromId=:testSuiteId AND toEntity='%s' AND relation=%d AND fromEntity='%s')",
              Entity.TEST_CASE, Relationship.CONTAINS.ordinal(), Entity.TEST_SUITE));
    }

    if (status != null) {
      conditions.add("status = :testCaseStatus");
    }

    if (type != null) {
      conditions.add(
          switch (type) {
            case "table" -> "entityLink NOT LIKE '%::columns::%'";
            case "column" -> "entityLink LIKE '%::columns::%'";
            default -> "";
          });
    }

    return addCondition(conditions);
  }

  private String getTestCaseIncidentCondition() {
    String originEntityFQN = getQueryParam("originEntityFQN");
    if (originEntityFQN != null) {
      queryParams.put(
          "originEntityFQNLike",
          originEntityFQN + ".%"); // Add wildcard to get all column test cases under the entity
      return "(testCaseEntityFQN = :originEntityFQN\n"
          + " OR testCaseEntityFQN LIKE :originEntityFQNLike)";
    }
    return "";
  }

  private String getTestSuiteTypeCondition(String tableName) {
    String testSuiteType = getQueryParam("testSuiteType");

    if (testSuiteType == null) {
      return "";
    }

    return switch (testSuiteType) {
        // We'll clean up the executable when we deprecate the /executable endpoints
      case "basic", "executable" -> {
        if (Boolean.TRUE.equals(DatasourceConfig.getInstance().isMySQL())) {
          yield String.format(
              "(JSON_UNQUOTE(JSON_EXTRACT(%s.json, '$.basic')) = 'true')", tableName);
        }
        yield String.format("(%s.json->>'basic' = 'true')", tableName);
      }
      case "logical" -> {
        if (Boolean.TRUE.equals(DatasourceConfig.getInstance().isMySQL())) {
          yield String.format(
              "(JSON_UNQUOTE(JSON_EXTRACT(%s.json, '$.basic')) = 'false' OR JSON_UNQUOTE(JSON_EXTRACT(%s.json, '$.basic')) IS NULL)",
              tableName, tableName);
        }
        yield String.format(
            "(%s.json->>'basic' = 'false' or %s.json -> 'basic' is null)", tableName, tableName);
      }
      default -> "";
    };
  }

  private String getFqnPrefixCondition(String tableName, String fqnPrefix, String paramName) {
    String databaseFqnHash =
        String.format("%s%s%%", FullyQualifiedName.buildHash(fqnPrefix), Entity.SEPARATOR);
    queryParams.put(paramName + "Hash", databaseFqnHash);
    return tableName == null
        ? String.format("fqnHash LIKE :%s", paramName + "Hash")
        : String.format("%s.fqnHash LIKE :%s", tableName, paramName + "Hash");
  }

  private String getWebhookTypePrefixCondition(String tableName, String typePrefix) {
    typePrefix = String.format("%s%%", escape(typePrefix));
    queryParams.put("typePrefix", typePrefix);
    return tableName == null
        ? "webhookType LIKE :typePrefix"
        : tableName + ".webhookType LIKE typePrefix";
  }

  private String getPipelineTypePrefixCondition(String tableName, String pipelineType) {
    pipelineType = escape(pipelineType);
    String inCondition = getInConditionFromString(pipelineType);
    if (Boolean.TRUE.equals(DatasourceConfig.getInstance().isMySQL())) {
      return tableName == null
          ? String.format("pipelineType IN (%s)", inCondition)
          : String.format(
              "%s.JSON_UNQUOTE(JSON_EXTRACT(ingestion_pipeline_entity.json, '$.pipelineType')) IN (%s)",
              tableName, inCondition);
    }
    return tableName == null
        ? String.format("pipelineType IN (%s)", inCondition)
        : String.format("%s.json->>'pipelineType' IN (%s)", tableName, inCondition);
  }

  private String getInConditionFromString(String condition) {
    return Arrays.stream(condition.split(","))
        .map(String::trim)
        .filter(s -> !s.isEmpty())
        .map(s -> String.format("'%s'", s))
        .collect(Collectors.joining(","));
  }

  private String getCategoryPrefixCondition(String tableName, String category) {
    category = String.format("%s%%", escape(category));
    queryParams.put("escapedCategory", category);
    return tableName == null
        ? "category LIKE :escapedCategory"
        : tableName + ".category LIKE :escapedCategory";
  }

  private String getStatusPrefixCondition(String tableName, String statusPrefix) {
    if (!statusPrefix.isEmpty()) {
      List<String> statusList = new ArrayList<>(Arrays.asList(statusPrefix.split(",")));
      List<String> condition = new ArrayList<>();
      for (String s : statusList) {
        String format = "\"" + s + "\"";
        condition.add(format);
      }
      queryParams.put("statusList", String.join(",", condition));
      return "status in (:statusList)";
    }
    queryParams.put("statusPrefix", String.format("%s%%", statusPrefix));
    return tableName == null
        ? "status LIKE :statusPrefix"
        : tableName + ".status LIKE :statusPrefix";
  }

  protected String addCondition(List<String> conditions) {
    StringBuilder condition = new StringBuilder();

    for (String c : conditions) {
      if (!c.isEmpty()) {
        if (!condition.isEmpty()) {
          // Add `AND` between conditions
          condition.append(" AND ");
        }
        condition.append(c);
      }
    }
    return condition.toString();
  }

  public static String escapeApostrophe(String name) {
    // Escape string to be using in LIKE clause
    // "'" is used for indicated start and end of the string. Use "''" to escape it.
    // "_" is a wildcard and looks for any single character. Add "\\" in front of it to escape it
    return name.replace("'", "''");
  }

  public static String escape(String name) {
    // Escape string to be using in LIKE clause
    // "'" is used for indicated start and end of the string. Use "''" to escape it.
    name = escapeApostrophe(name);
    // "_" is a wildcard and looks for any single character. Add "\\" in front of it to escape it
    return name.replaceAll("_", "\\\\_");
  }

  private String getTaskStatusCondition(String tableName) {
    String statusGroup = queryParams.get("taskStatusGroup");
    if (statusGroup != null) {
      String column = tableName == null ? "status" : tableName + ".status";
      if ("open".equalsIgnoreCase(statusGroup)) {
        return String.format("%s = 'Open'", column);
      } else if ("closed".equalsIgnoreCase(statusGroup)) {
        return String.format(
            "%s IN ('Approved', 'Rejected', 'Completed', 'Cancelled', 'Failed')", column);
      }
    }

    String taskStatus = queryParams.get("taskStatus");
    if (taskStatus == null) {
      return "";
    }
    String safeStatus = escapeApostrophe(taskStatus);
    return tableName == null
        ? String.format("status = '%s'", safeStatus)
        : String.format("%s.status = '%s'", tableName, safeStatus);
  }

  private String getTaskTypeCondition(String tableName) {
    String taskType = queryParams.get("taskType");
    if (taskType == null) {
      return "";
    }
    String safeType = escapeApostrophe(taskType);
    return tableName == null
        ? String.format("type = '%s'", safeType)
        : String.format("%s.type = '%s'", tableName, safeType);
  }

  private String getTaskPriorityCondition(String tableName) {
    String taskPriority = queryParams.get("taskPriority");
    if (taskPriority == null) {
      return "";
    }
    String safePriority = escapeApostrophe(taskPriority);
    return tableName == null
        ? String.format("priority = '%s'", safePriority)
        : String.format("%s.priority = '%s'", tableName, safePriority);
  }
}
