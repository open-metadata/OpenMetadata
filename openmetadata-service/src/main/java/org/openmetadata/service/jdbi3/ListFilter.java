package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.function.Predicate;
import java.util.stream.Collectors;
import org.openmetadata.schema.api.data.CreateEntityProfile;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.RegexMode;
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
    conditions.add(getTableNameRegexCondition(tableName));
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
    conditions.add(getDomainSelfCondition(tableName));
    conditions.add(getOwnerCondition(tableName));
    conditions.add(getVisibleToCondition());
    conditions.add(getOwnedByCondition());
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
    conditions.add(getActiveCondition(tableName));
    conditions.add(getAgentTypeCondition());
    conditions.add(getProviderCondition(tableName));
    conditions.add(getTaskStatusCondition(tableName));
    conditions.add(getTaskFormTypeCondition(tableName));
    conditions.add(getTaskFormCategoryCondition(tableName));
    conditions.add(getTaskTypeCondition(tableName));
    conditions.add(getTaskPriorityCondition(tableName));
    conditions.add(getTaskApproverCondition());
    conditions.add(getTaskAboutServiceCondition());
    conditions.add(getTaskAccessTypeCondition());
    conditions.add(getDarSearchCondition());
    conditions.add(getEntityStatusCondition(tableName));
    conditions.add(getServerIdCondition());
    conditions.add(getNameFilterCondition());
    conditions.add(getSourceFileCondition());
    conditions.add(getSourceEntityCondition());
    conditions.add(getPrimaryEntityCondition());
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

  /** Filters context memories down to the knowledge pills extracted from a given context file. */
  private String getSourceFileCondition() {
    String sourceFileId = queryParams.get("sourceFileId");
    String result = "";
    if (!nullOrEmpty(sourceFileId)) {
      queryParams.put("sourceFileIdParam", sourceFileId);
      result =
          String.format(
              "(id IN (SELECT entity_relationship.toId FROM entity_relationship "
                  + "WHERE entity_relationship.fromEntity = 'contextFile' "
                  + "AND entity_relationship.fromId = :sourceFileIdParam "
                  + "AND entity_relationship.relation = %d))",
              Relationship.MENTIONED_IN.ordinal());
    }
    return result;
  }

  /** Filters context memories down to the knowledge pills extracted from any source entity. */
  private String getSourceEntityCondition() {
    String sourceEntityId = queryParams.get("sourceEntityId");
    String result = "";
    if (!nullOrEmpty(sourceEntityId)) {
      queryParams.put("sourceEntityIdParam", sourceEntityId);
      result =
          String.format(
              "(id IN (SELECT entity_relationship.toId FROM entity_relationship "
                  + "WHERE entity_relationship.fromId = :sourceEntityIdParam "
                  + "AND entity_relationship.relation = %d))",
              Relationship.MENTIONED_IN.ordinal());
    }
    return result;
  }

  /**
   * Filters context memories down to the knowledge pills whose primaryEntity is the given asset.
   * Edge direction: primaryEntity --APPLIED_TO--> contextMemory, so the memory is the {@code toId}.
   */
  private String getPrimaryEntityCondition() {
    String primaryEntityId = queryParams.get("primaryEntityId");
    String result = "";
    if (!nullOrEmpty(primaryEntityId)) {
      queryParams.put("primaryEntityIdParam", primaryEntityId);
      result =
          String.format(
              "(id IN (SELECT entity_relationship.toId FROM entity_relationship "
                  + "WHERE entity_relationship.fromId = :primaryEntityIdParam "
                  + "AND entity_relationship.toEntity = 'contextMemory' "
                  + "AND entity_relationship.relation = %d))",
              Relationship.APPLIED_TO.ordinal());
    }
    return result;
  }

  private String getAssignee() {
    String assigneeIds = queryParams.get("assigneeIds");
    if (assigneeIds != null) {
      return String.format(
          "(id IN (SELECT entity_relationship.toId FROM entity_relationship "
              + "WHERE entity_relationship.fromEntity IN ('user', 'team') "
              + "AND entity_relationship.fromId IN (%s) "
              + "AND entity_relationship.relation = %d))",
          assigneeIds, Relationship.ASSIGNED_TO.ordinal());
    }

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
    if (nullOrEmpty(assigneeFqn)) {
      return "";
    }
    String hashCsv =
        Arrays.stream(assigneeFqn.split(","))
            .map(String::trim)
            .filter(s -> !s.isEmpty())
            .map(FullyQualifiedName::buildHash)
            .collect(Collectors.joining(","));
    String inCondition = buildIndexedBindParams("assigneeFqnHash", hashCsv);
    return String.format(
        "(id IN (SELECT er.toId FROM entity_relationship er "
            + "INNER JOIN user_entity u ON er.fromId = u.id "
            + "WHERE er.fromEntity = 'user' "
            + "AND u.nameHash IN (%s) "
            + "AND er.relation = %d) "
            + "OR id IN (SELECT er.toId FROM entity_relationship er "
            + "INNER JOIN team_entity t ON er.fromId = t.id "
            + "WHERE er.fromEntity = 'team' "
            + "AND t.nameHash IN (%s) "
            + "AND er.relation = %d))",
        inCondition,
        Relationship.ASSIGNED_TO.ordinal(),
        inCondition,
        Relationship.ASSIGNED_TO.ordinal());
  }

  /**
   * Filter tasks by the entity they are about.
   * Uses prefix matching to include tasks about sub-entities (e.g., columns when viewing a table).
   * The FQN is converted to a hash to avoid key length limitations.
   */
  private String getAboutEntityCondition() {
    String aboutEntityFqn = queryParams.get("aboutEntity");
    if (nullOrEmpty(aboutEntityFqn)) {
      return "";
    }
    return buildFqnPrefixOrCondition("about", aboutEntityFqn);
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
   * - createdById: Uses the indexed createdById column for exact UUID match
   * - createdBy: Uses CREATED relationship with FQN lookup
   */
  private String getCreatedByCondition() {
    String createdById = queryParams.get("createdById");
    if (!nullOrEmpty(createdById)) {
      String inCondition = buildIndexedBindParams("createdById", createdById);
      return String.format("createdById IN (%s)", inCondition);
    }

    String createdBy = queryParams.get("createdBy");
    if (nullOrEmpty(createdBy)) {
      return "";
    }
    String hashCsv =
        Arrays.stream(createdBy.split(","))
            .map(String::trim)
            .filter(s -> !s.isEmpty())
            .map(FullyQualifiedName::buildHash)
            .collect(Collectors.joining(","));
    String inCondition = buildIndexedBindParams("createdByFqnHash", hashCsv);
    return String.format(
        "(id IN (SELECT er.toId FROM entity_relationship er "
            + "INNER JOIN user_entity u ON er.fromId = u.id "
            + "WHERE er.fromEntity = 'user' "
            + "AND u.nameHash IN (%s) "
            + "AND er.relation = %d))",
        inCondition, Relationship.CREATED.ordinal());
  }

  private String getWorkflowDefinitionIdCondition() {
    String workflowDefinitionId = queryParams.get("workflowDefinitionId");
    return workflowDefinitionId == null ? "" : "workflowDefinitionId = :workflowDefinitionId";
  }

  private String getEntityLinkCondition() {
    String entityLinkStr = queryParams.get("entityLink");
    return entityLinkStr == null ? "" : "entityLink = :entityLink";
  }

  private String getActiveCondition(String tableName) {
    String active = queryParams.get("active");
    if (active == null || !"announcement_entity".equals(tableName)) {
      return "";
    }

    long now = System.currentTimeMillis();

    if (Boolean.parseBoolean(active)) {
      return String.format("(startTime <= %d AND endTime >= %d)", now, now);
    }

    return String.format("(startTime > %d OR endTime < %d)", now, now);
  }

  private String getEntityStatusCondition(String tableName) {
    String entityStatus = queryParams.get("entityStatus");
    if (entityStatus == null || entityStatus.trim().isEmpty()) {
      return "";
    }

    Set<String> validStatuses =
        Arrays.stream(EntityStatus.values()).map(EntityStatus::value).collect(Collectors.toSet());
    List<String> statusValues =
        Arrays.stream(entityStatus.split(","))
            .map(String::trim)
            .filter(Predicate.not(String::isEmpty))
            .filter(validStatuses::contains)
            .toList();

    if (statusValues.isEmpty()) {
      return "";
    }

    List<String> bindParams = new ArrayList<>();
    for (int i = 0; i < statusValues.size(); i++) {
      String key = "entityStatus_" + i;
      queryParams.put(key, statusValues.get(i));
      bindParams.add(":" + key);
    }
    String inCondition = String.join(",", bindParams);

    // glossary_term_entity has indexed entityStatus column, use it directly
    if (Entity.getCollectionDAO().glossaryTermDAO().getTableName().equals(tableName)) {
      return String.format("entityStatus IN (%s)", inCondition);
    }

    if (Boolean.TRUE.equals(DatasourceConfig.getInstance().isMySQL())) {
      return String.format(
          "JSON_UNQUOTE(JSON_EXTRACT(json, '$.entityStatus')) IN (%s)", inCondition);
    } else {
      return String.format("json->>'entityStatus' IN (%s)", inCondition);
    }
  }

  private String getAgentTypeCondition() {
    String agentTypes = queryParams.get("agentType");
    if (agentTypes == null || agentTypes.trim().isEmpty()) {
      return "";
    } else {
      String inCondition = buildIndexedBindParams("agentType", agentTypes);
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
        : "testCaseResolutionStatusType = :testCaseResolutionStatusType";
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
    String databaseRegex = queryParams.get("databaseRegex");
    if (nullOrEmpty(database) && nullOrEmpty(databaseRegex)) {
      return "";
    }
    String hashCondition = "TRUE";
    String regexCondition = "TRUE";
    if (!nullOrEmpty(database)) {
      hashCondition = getFqnPrefixCondition(tableName, database, "database");
    }
    if (!nullOrEmpty(databaseRegex)) {
      regexCondition = getFqnRegexCondition(tableName, databaseRegex, "database");
    }
    return String.format("(%s AND %s)", hashCondition, regexCondition);
  }

  public String getDatabaseSchemaCondition(String tableName) {
    String databaseSchema = queryParams.get("databaseSchema");
    String databaseSchemaRegex = queryParams.get("databaseSchemaRegex");
    if (nullOrEmpty(databaseSchema) && nullOrEmpty(databaseSchemaRegex)) {
      return "";
    }
    String hashCondition = "TRUE";
    String regexCondition = "TRUE";
    if (!nullOrEmpty(databaseSchema)) {
      if (!nullOrEmpty(tableName)
          && (tableName.equals("table_entity") || tableName.equals("stored_procedure_entity"))) {
        String databaseSchemaHash = FullyQualifiedName.buildHash(databaseSchema);
        queryParams.put("databaseSchemaHashExact", databaseSchemaHash);
        // Exact hash match — regex is not applied for these entity tables
        return String.format("%s.databaseSchemaHash = :databaseSchemaHashExact", tableName);
      }
      hashCondition = getFqnPrefixCondition(tableName, databaseSchema, "databaseSchema");
    }

    if (!nullOrEmpty(databaseSchemaRegex)) {
      regexCondition = getFqnRegexCondition(tableName, databaseSchemaRegex, "databaseSchema");
    }

    return String.format("(%s AND %s)", hashCondition, regexCondition);
  }

  public String getTableNameRegexCondition(String tableName) {
    String tableParamRegex = queryParams.get("tableRegex");
    if (nullOrEmpty(tableParamRegex)) {
      return "";
    }
    return getFqnRegexCondition(tableName, tableParamRegex, "table");
  }

  public String getServiceCondition(String tableName) {
    String service = queryParams.get("service");
    if (service == null || service.isEmpty()) {
      return "";
    }
    // Special handling for pipeline_entity - use entity_relationship join
    if (tableName != null && tableName.equals("pipeline_entity")) {
      queryParams.put("serviceNameParam", service);
      String entityIdColumn = tableName + ".id";
      return String.format(
          "(EXISTS (SELECT 1 FROM entity_relationship er JOIN pipeline_service_entity pse ON er.fromId = pse.id WHERE er.toId = %s AND er.fromEntity = 'pipelineService' AND er.toEntity = 'pipeline' AND er.relation = 0 AND pse.name = :serviceNameParam))",
          entityIdColumn);
    }
    return getFqnPrefixCondition(tableName, EntityInterfaceUtil.quoteName(service), "service");
  }

  public String getServiceTypeCondition(String tableName) {
    String serviceType = queryParams.get("serviceType");
    if (serviceType == null || serviceType.isEmpty()) {
      return "";
    }
    if (tableName != null && tableName.equals("pipeline_entity")) {
      queryParams.put("serviceTypeParam", serviceType);
      return String.format(
          "JSON_UNQUOTE(JSON_EXTRACT(%s.json, '$.serviceType')) = :serviceTypeParam", tableName);
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
      String entityTypeCondition = "";
      if (!nullOrEmpty(entityType)) {
        queryParams.put("domainEntityType", entityType);
        entityTypeCondition = "AND entity_relationship.toEntity = :domainEntityType";
      }
      return String.format(
          "(%s NOT IN (SELECT entity_relationship.toId FROM entity_relationship WHERE entity_relationship.fromEntity='domain' %s AND relation=10))",
          entityIdColumn, entityTypeCondition);
    }

    String domainInClause = buildIndexedBindParams("domainId", domainId.replace("'", ""));

    if (Boolean.TRUE.toString().equals(domainAccessControl)) {
      return String.format(
          "(NOT EXISTS (SELECT 1 FROM entity_relationship er WHERE er.relation=10 AND er.fromEntity='domain' AND er.toId = %s) OR "
              + "%s IN (SELECT er2.toId FROM entity_relationship er2 WHERE er2.fromEntity='domain' AND er2.fromId IN (%s) AND er2.relation=10))",
          entityIdColumn, entityIdColumn, domainInClause);
    }

    return String.format(
        "(%s in (SELECT entity_relationship.toId FROM entity_relationship WHERE entity_relationship.fromEntity='domain' AND entity_relationship.fromId IN (%s) AND "
            + "relation=10))",
        entityIdColumn, domainInClause);
  }

  private String getDomainSelfCondition(String tableName) {
    String domainIds = getQueryParam("restrictToDomainIds");
    String result = "";
    if (domainIds != null) {
      String idColumn = nullOrEmpty(tableName) ? "id" : (tableName + ".id");
      String idInClause = buildIndexedBindParams("restrictDomainId", domainIds.replace("'", ""));
      List<String> clauses = new ArrayList<>();
      clauses.add(String.format("%s IN (%s)", idColumn, idInClause));
      clauses.addAll(buildDomainFqnPrefixClauses(tableName));
      result = "(" + String.join(" OR ", clauses) + ")";
    }
    return result;
  }

  private List<String> buildDomainFqnPrefixClauses(String tableName) {
    List<String> clauses = new ArrayList<>();
    String fqnHashes = getQueryParam("restrictToDomainFqnHashes");
    if (!nullOrEmpty(fqnHashes)) {
      String fqnHashColumn = nullOrEmpty(tableName) ? "fqnHash" : (tableName + ".fqnHash");
      int index = 0;
      for (String fqnHash : fqnHashes.split(",")) {
        String key = "restrictDomainFqn_" + index++;
        queryParams.put(key, fqnHash.trim() + Entity.SEPARATOR + "%");
        clauses.add(String.format("%s LIKE :%s", fqnHashColumn, key));
      }
    }
    return clauses;
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

  /**
   * Filter tasks by ownership of their target entity (about).
   * This returns tasks where the entity linked through MENTIONED_IN is owned by any of the
   * provided user/team IDs.
   */
  private String getOwnedByCondition() {
    String ownedByIds = getQueryParam("ownedByIds");
    if (ownedByIds == null) {
      return "";
    }

    return String.format(
        "(id IN (SELECT taskRel.toId FROM entity_relationship taskRel "
            + "INNER JOIN entity_relationship ownerRel ON ownerRel.toId = taskRel.fromId "
            + "WHERE taskRel.toEntity = 'task' "
            + "AND taskRel.relation = %d "
            + "AND ownerRel.fromEntity IN ('user','team') "
            + "AND ownerRel.relation = %d "
            + "AND ownerRel.fromId IN (%s)))",
        Relationship.MENTIONED_IN.ordinal(), Relationship.OWNS.ordinal(), ownedByIds);
  }

  /**
   * Filter tasks visible to the current user.
   *
   * <p>This is a union of:
   * - tasks directly assigned to the user or their teams
   * - tasks whose target entity is owned by the user or their teams
   */
  private String getVisibleToCondition() {
    String visibleAssigneeIds = getQueryParam("visibleAssigneeIds");
    String visibleOwnedByIds = getQueryParam("visibleOwnedByIds");
    if (visibleAssigneeIds == null && visibleOwnedByIds == null) {
      return "";
    }

    List<String> conditions = new ArrayList<>();

    if (visibleAssigneeIds != null) {
      conditions.add(
          String.format(
              "id IN (SELECT entity_relationship.toId FROM entity_relationship "
                  + "WHERE entity_relationship.fromEntity IN ('user', 'team') "
                  + "AND entity_relationship.fromId IN (%s) "
                  + "AND entity_relationship.relation = %d)",
              visibleAssigneeIds, Relationship.ASSIGNED_TO.ordinal()));
    }

    if (visibleOwnedByIds != null) {
      conditions.add(
          String.format(
              "id IN (SELECT taskRel.toId FROM entity_relationship taskRel "
                  + "INNER JOIN entity_relationship ownerRel ON ownerRel.toId = taskRel.fromId "
                  + "WHERE taskRel.toEntity = 'task' "
                  + "AND taskRel.relation = %d "
                  + "AND ownerRel.fromEntity IN ('user','team') "
                  + "AND ownerRel.relation = %d "
                  + "AND ownerRel.fromId IN (%s))",
              Relationship.MENTIONED_IN.ordinal(), Relationship.OWNS.ordinal(), visibleOwnedByIds));
    }

    return "(" + String.join(" OR ", conditions) + ")";
  }

  private String getTierCondition(String tableName) {
    String tier = getQueryParam("tier");
    if (tier == null || tier.isEmpty()) {
      return "";
    }
    queryParams.put("tierParam", tier);
    String fqnHashColumn = nullOrEmpty(tableName) ? "fqnHash" : (tableName + ".fqnHash");
    return String.format(
        "(EXISTS (SELECT 1 FROM tag_usage tu WHERE tu.targetFQNHash = %s AND tu.tagFQN = :tierParam))",
        fqnHashColumn);
  }

  public String getApiCollectionCondition(String apiEndpoint) {
    String apiCollection = queryParams.get("apiCollection");
    return apiCollection == null
        ? ""
        : getFqnPrefixCondition(apiEndpoint, apiCollection, "apiCollection");
  }

  private String getServerIdCondition() {
    String serverId = queryParams.get("serverId");
    return serverId == null ? "" : "serverId = :serverId";
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
    queryParams.put("directoryFqnParam", directoryFqn);
    return "directoryFqn = :directoryFqnParam";
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
    queryParams.put("fileTypeParam", fileType);
    return "fileType = :fileTypeParam";
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
    String columnName = getQueryParam("columnName");

    if (entityFQN != null) {
      if (includeAllTests) {
        queryParams.put("entityFQNLikePrefix", entityFQN + Entity.SEPARATOR + "%");
        queryParams.put("entityFQNExact", entityFQN);
        conditions.add("(entityFQN LIKE :entityFQNLikePrefix OR entityFQN = :entityFQNExact)");
      } else {
        queryParams.put("entityFQNExact", entityFQN);
        conditions.add("entityFQN = :entityFQNExact");
      }
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

    if (columnName != null) {
      queryParams.put("columnName", columnName);
      String columnNameQuery = null;
      if (Boolean.TRUE.equals(DatasourceConfig.getInstance().isMySQL())) {
        columnNameQuery = "entityLink LIKE CONCAT('%::columns::', :columnName, '>')";
      } else {
        columnNameQuery = "entityLink LIKE '%::columns::' || :columnName || '>'";
      }
      conditions.add(columnNameQuery);
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
    String prefix = FullyQualifiedName.buildHash(fqnPrefix) + Entity.SEPARATOR;
    queryParams.put(paramName + "Hash", prefix + "%");
    // Companion bind for "exclude descendants below the immediate level" — used by listings
    // that need direct children only (e.g. ContainerDAO root listings, ContainerRepository
    // listChildren). fqnHash uses fixed-width MD5 segments joined by '.', so a fqnHash that
    // matches `<prefix>.%.%` has at least two segments below the prefix and is therefore not
    // a direct child. Always bound — most queries don't reference it; the cost is one map
    // entry. Avoids threading an extra param through every listing site.
    queryParams.put(paramName + "HashChild", prefix + "%.%");
    return tableName == null
        ? String.format("fqnHash LIKE :%s", paramName + "Hash")
        : String.format("%s.fqnHash LIKE :%s", tableName, paramName + "Hash");
  }

  private String getFqnRegexCondition(String tableName, String regex, String paramName) {
    String fieldPath = queryParams.get(paramName + "RegexField");
    if (nullOrEmpty(fieldPath)) {
      fieldPath = "name";
    }
    if (Boolean.parseBoolean(queryParams.get("regexFilterByFqn"))) {
      int lastDot = fieldPath.lastIndexOf(".name");
      if (lastDot == -1) {
        fieldPath = "fullyQualifiedName";
      } else {
        fieldPath = fieldPath.substring(0, lastDot) + ".fullyQualifiedName";
      }
    }
    boolean exclude = RegexMode.EXCLUDE.value().equalsIgnoreCase(queryParams.get("regexMode"));
    queryParams.put(paramName + "Regex", regex);
    if (Boolean.TRUE.equals(DatasourceConfig.getInstance().isMySQL())) {
      String expr =
          tableName == null
              ? String.format("JSON_UNQUOTE(JSON_EXTRACT(json, '$.%s'))", fieldPath)
              : String.format("JSON_UNQUOTE(JSON_EXTRACT(%s.json, '$.%s'))", tableName, fieldPath);
      String operator = exclude ? "NOT REGEXP" : "REGEXP";
      return String.format("%s %s :%s", expr, operator, paramName + "Regex");
    } else {
      String pgPath = "{" + fieldPath.replace(".", ",") + "}";
      String expr =
          tableName == null
              ? String.format("json #>> '%s'", pgPath)
              : String.format("%s.json #>> '%s'", tableName, pgPath);
      String operator = exclude ? "!~" : "~";
      return String.format("%s %s :%s", expr, operator, paramName + "Regex");
    }
  }

  private String getWebhookTypePrefixCondition(String tableName, String typePrefix) {
    typePrefix = String.format("%s%%", escape(typePrefix));
    queryParams.put("typePrefix", typePrefix);
    return tableName == null
        ? "webhookType LIKE :typePrefix"
        : tableName + ".webhookType LIKE :typePrefix";
  }

  private String getPipelineTypePrefixCondition(String tableName, String pipelineType) {
    String inCondition = buildIndexedBindParams("pipelineType", pipelineType);
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

  protected String buildIndexedBindParams(String prefix, String commaSeparatedValues) {
    List<String> values =
        Arrays.stream(commaSeparatedValues.split(","))
            .map(String::trim)
            .filter(s -> !s.isEmpty())
            .toList();
    if (values.isEmpty()) {
      return "''";
    }
    List<String> placeholders = new ArrayList<>();
    for (int i = 0; i < values.size(); i++) {
      String key = prefix + "_" + i;
      queryParams.put(key, values.get(i));
      placeholders.add(":" + key);
    }
    return String.join(",", placeholders);
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
      String inCondition = buildIndexedBindParams("status", statusPrefix);
      return tableName == null
          ? String.format("status IN (%s)", inCondition)
          : String.format("%s.status IN (%s)", tableName, inCondition);
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

  private String getNameFilterCondition() {
    String nameFilter = queryParams.get("nameFilter");
    if (nullOrEmpty(nameFilter)) {
      return "";
    }
    String escaped = "%" + escape(nameFilter.trim()) + "%";
    queryParams.put("nameFilterParam", escaped);
    if (Boolean.TRUE.equals(DatasourceConfig.getInstance().isMySQL())) {
      return "(LOWER(name) LIKE LOWER(:nameFilterParam) "
          + "OR LOWER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(json, '$.displayName')), '')) LIKE LOWER(:nameFilterParam))";
    } else {
      return "(LOWER(name) LIKE LOWER(:nameFilterParam) "
          + "OR LOWER(COALESCE(json->>'displayName', '')) LIKE LOWER(:nameFilterParam))";
    }
  }

  public static String escapeApostrophe(String name) {
    // Escape string to be using in LIKE clause
    // "'" is used for indicated start and end of the string. Use "''" to escape it.
    // "_" is a wildcard and looks for any single character. Add "\\" in front of it to escape it
    return name.replace("'", "''");
  }

  /**
   * Defence-in-depth: when a value is embedded inside a single-quoted SQL string literal,
   * escape backslashes before apostrophes (MySQL treats {@code \} as a string-literal escape
   * by default, and Postgres does too when {@code standard_conforming_strings = off}). Run
   * this BEFORE {@link #escapeApostrophe} so the {@code \\} we just inserted isn't itself
   * re-doubled.
   */
  public static String escapeBackslashAndApostrophe(String name) {
    return escapeApostrophe(name.replace("\\", "\\\\"));
  }

  /**
   * Escape a string for use as the <em>replacement</em> argument to MySQL's
   * {@code REGEXP_REPLACE}. Two layers of escaping are needed:
   * <ol>
   *   <li>Regex replacement layer: {@code REGEXP_REPLACE} treats {@code \} as the start of a
   *       backreference / escape sequence (e.g. {@code \1} resolves to capture group 1).
   *       Each literal backslash in the input needs to become {@code \\} for the regex
   *       engine to emit a single {@code \}.</li>
   *   <li>SQL string-literal layer: the regex-escaped value is then embedded inside a
   *       single-quoted SQL string, so each remaining {@code \} doubles again
   *       ({@code \\} → {@code \\\\}) and apostrophes double ({@code '} → {@code ''}).</li>
   * </ol>
   * Net effect: one input backslash → four backslashes in the SQL statement text, which
   * the SQL parser folds to two backslashes for the regex engine, which the regex engine
   * folds to one literal backslash in the replacement output. Apostrophes just double
   * once (regex replacement doesn't reserve apostrophes, only the SQL layer does).
   *
   * <p>Compose with {@link #escapeApostrophe} rather than {@link #escapeBackslashAndApostrophe}
   * for the second pass — applying {@code escapeBackslashAndApostrophe} twice would
   * re-escape the apostrophes we already doubled.
   */
  public static String escapeForMySqlRegexReplacement(String name) {
    // Step 1: double backslashes for the regex replacement layer.
    String regexEscaped = name.replace("\\", "\\\\");
    // Step 2: double backslashes (again) + apostrophes for the SQL string-literal layer.
    return escapeBackslashAndApostrophe(regexEscaped);
  }

  public static String escape(String name) {
    // Escape string to be using in LIKE clause
    // "'" is used for indicated start and end of the string. Use "''" to escape it.
    name = escapeBackslashAndApostrophe(name);
    // "_" is a wildcard and looks for any single character. Add "\\" in front of it to escape it
    return name.replaceAll("_", "\\\\_");
  }

  private String getTaskStatusCondition(String tableName) {
    String statusGroup = queryParams.get("taskStatusGroup");
    if (statusGroup != null) {
      String column = tableName == null ? "status" : tableName + ".status";
      if ("open".equalsIgnoreCase(statusGroup)) {
        return String.format("%s IN ('Open', 'InProgress', 'Pending')", column);
      } else if ("active".equalsIgnoreCase(statusGroup)) {
        return String.format(
            "%s IN ('Open', 'InProgress', 'Pending', 'Approved', 'Granted')", column);
      } else if ("closed".equalsIgnoreCase(statusGroup)) {
        // 'Approved' is intentionally a member of both 'active' and 'closed' because the
        // same status maps to different lifecycle meanings depending on the task type:
        //   - Glossary/DescriptionUpdate/etc.: 'Approved' is the terminal state and must
        //     surface in the existing Closed tab.
        //   - DataAccessRequest: 'Approved' means "awaiting grant" — non-terminal — and
        //     callers reach those tasks via the 'active' group instead.
        // Removing 'Approved' here would regress the Closed tab UX for the older workflows.
        // A future refactor could make status group resolution task-type aware.
        return String.format(
            "%s IN ('Approved', 'Rejected', 'Completed', 'Cancelled', 'Failed', 'Revoked')",
            column);
      }
    }

    String taskStatus = queryParams.get("taskStatus");
    if (nullOrEmpty(taskStatus)) {
      return "";
    }
    String column = tableName == null ? "status" : tableName + ".status";
    String inCondition = buildIndexedBindParams("taskStatus", taskStatus);
    return String.format("%s IN (%s)", column, inCondition);
  }

  private String getTaskApproverCondition() {
    String approvedById = queryParams.get("approverId");
    if (!nullOrEmpty(approvedById)) {
      String inCondition = buildIndexedBindParams("approverId", approvedById);
      return String.format("approvedById IN (%s)", inCondition);
    }

    String approverFqn = queryParams.get("approver");
    if (nullOrEmpty(approverFqn)) {
      return "";
    }
    String hashCsv =
        Arrays.stream(approverFqn.split(","))
            .map(String::trim)
            .filter(s -> !s.isEmpty())
            .map(FullyQualifiedName::buildHash)
            .collect(Collectors.joining(","));
    String inCondition = buildIndexedBindParams("approverFqnHash", hashCsv);
    return String.format(
        "(approvedById IN (SELECT u.id FROM user_entity u WHERE u.nameHash IN (%s)))", inCondition);
  }

  private String getTaskAboutServiceCondition() {
    String serviceFqn = queryParams.get("aboutService");
    if (nullOrEmpty(serviceFqn)) {
      return "";
    }
    return buildFqnPrefixOrCondition("aboutService", serviceFqn);
  }

  private String getTaskAccessTypeCondition() {
    String accessType = queryParams.get("accessType");
    if (nullOrEmpty(accessType)) {
      return "";
    }
    String inCondition = buildIndexedBindParams("accessType", accessType);
    if (Boolean.TRUE.equals(DatasourceConfig.getInstance().isMySQL())) {
      return String.format(
          "JSON_UNQUOTE(JSON_EXTRACT(json, '$.payload.accessType')) IN (%s)", inCondition);
    }
    return String.format("json->'payload'->>'accessType' IN (%s)", inCondition);
  }

  /**
   * Free-text search across DAR-relevant fields. Used by the {@code q} query param on
   * {@code /v1/tasks/dataAccessRequests}. Database-only — DARs are not indexed into Elasticsearch.
   * Matches against task name, displayName, the DAR payload.reason, and the about-entity FQN /
   * displayName.
   */
  private String getDarSearchCondition() {
    String search = queryParams.get("darSearch");
    if (nullOrEmpty(search)) {
      return "";
    }
    // escape() handles `'` and `_`, but leaves `%` alone (callers like
    // getCategoryPrefixCondition want trailing `%` as a wildcard). For free-text search the
    // anchor wildcards we add below are the only ones allowed; escape `%` inside the user
    // input so callers can't probe rows via `q=%` or smuggle wildcards into the middle.
    String escaped = "%" + escape(search.trim()).replace("%", "\\%") + "%";
    queryParams.put("darSearchParam", escaped);
    if (Boolean.TRUE.equals(DatasourceConfig.getInstance().isMySQL())) {
      return "(LOWER(name) LIKE LOWER(:darSearchParam) "
          + "OR LOWER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(json, '$.displayName')), '')) LIKE LOWER(:darSearchParam) "
          + "OR LOWER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(json, '$.payload.reason')), '')) LIKE LOWER(:darSearchParam) "
          + "OR LOWER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(json, '$.about.displayName')), '')) LIKE LOWER(:darSearchParam) "
          + "OR LOWER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(json, '$.about.fullyQualifiedName')), '')) LIKE LOWER(:darSearchParam))";
    }
    return "(LOWER(name) LIKE LOWER(:darSearchParam) "
        + "OR LOWER(COALESCE(json->>'displayName', '')) LIKE LOWER(:darSearchParam) "
        + "OR LOWER(COALESCE(json->'payload'->>'reason', '')) LIKE LOWER(:darSearchParam) "
        + "OR LOWER(COALESCE(json->'about'->>'displayName', '')) LIKE LOWER(:darSearchParam) "
        + "OR LOWER(COALESCE(json->'about'->>'fullyQualifiedName', '')) LIKE LOWER(:darSearchParam))";
  }

  /**
   * Shared helper for the task_entity multi-value FQN filters (aboutEntity, aboutService).
   * Both filters target the same generated column, {@code task_entity.aboutFqnHash}: an
   * "aboutEntity" filter matches the dataset's FQN-hash exactly or as a prefix, and an
   * "aboutService" filter matches the parent service's FQN-hash as a prefix of any
   * dataset's FQN-hash beneath it. Splits the comma-separated input, hashes each FQN, and
   * produces an OR-joined fragment of {@code (aboutFqnHash = :hash OR aboutFqnHash LIKE
   * :hash_prefix)} groups.
   *
   * <p>This helper deliberately hard-codes {@code aboutFqnHash}; the {@code prefix} arg
   * only namespaces the bound parameter keys. Don't reuse it for other columns — copy and
   * adjust instead so the column choice stays explicit at the callsite.
   */
  private String buildFqnPrefixOrCondition(String prefix, String commaSeparatedFqns) {
    List<String> tokens =
        Arrays.stream(commaSeparatedFqns.split(","))
            .map(String::trim)
            .filter(s -> !s.isEmpty())
            .toList();
    if (tokens.isEmpty()) {
      return "";
    }
    List<String> clauses = new ArrayList<>();
    for (int i = 0; i < tokens.size(); i++) {
      String hash = FullyQualifiedName.buildHash(tokens.get(i));
      String hashKey = prefix + "FqnHash_" + i;
      String prefixKey = prefix + "FqnHashPrefix_" + i;
      queryParams.put(hashKey, hash);
      queryParams.put(prefixKey, hash + ".%");
      clauses.add(
          String.format("(aboutFqnHash = :%s OR aboutFqnHash LIKE :%s)", hashKey, prefixKey));
    }
    return clauses.size() == 1 ? clauses.get(0) : "(" + String.join(" OR ", clauses) + ")";
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

  private String getTaskFormTypeCondition(String tableName) {
    String taskFormType = queryParams.get("taskFormType");
    if (taskFormType == null) {
      return "";
    }
    String safeType = escapeApostrophe(taskFormType);
    return tableName == null
        ? String.format("taskType = '%s'", safeType)
        : String.format("%s.taskType = '%s'", tableName, safeType);
  }

  private String getTaskFormCategoryCondition(String tableName) {
    String taskFormCategory = queryParams.get("taskFormCategory");
    if (taskFormCategory == null) {
      return "";
    }
    String safeCategory = escapeApostrophe(taskFormCategory);
    return tableName == null
        ? String.format("taskCategory = '%s'", safeCategory)
        : String.format("%s.taskCategory = '%s'", tableName, safeCategory);
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
