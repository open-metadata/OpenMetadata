package org.openmetadata.service.migration.utils.v200;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.governance.workflows.Workflow.GLOBAL_NAMESPACE;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.UPDATED_BY_VARIABLE;
import static org.openmetadata.service.governance.workflows.WorkflowVariableHandler.getNamespacedVariableName;
import static org.openmetadata.service.governance.workflows.elements.TriggerFactory.getTriggerWorkflowId;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.activity.ActivityEvent;
import org.openmetadata.schema.entity.feed.Announcement;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.governance.workflows.elements.WorkflowNodeDefinitionInterface;
import org.openmetadata.schema.type.ActivityEventType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.Post;
import org.openmetadata.schema.type.RecognizerFeedback;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TaskCategory;
import org.openmetadata.schema.type.TaskComment;
import org.openmetadata.schema.type.TaskDetails;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.type.TaskPriority;
import org.openmetadata.schema.type.TaskResolution;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.schema.type.TaskStatus;
import org.openmetadata.schema.type.TaskType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.jdbi3.AnnouncementRepository;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.PolicyRepository;
import org.openmetadata.service.jdbi3.RoleRepository;
import org.openmetadata.service.jdbi3.TaskRepository;
import org.openmetadata.service.jdbi3.WorkflowDefinitionRepository;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.resources.databases.DatasourceConfig;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.tasks.TaskWorkflowLifecycleResolver;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
public class MigrationUtil {

  private static final String DATA_CONSUMER_ROLE = "DataConsumer";
  private static final String DATA_CONSUMER_POLICY = "DataConsumerPolicy";
  private static final String TASK_AUTHOR_POLICY = "TaskAuthorPolicy";
  private static final String CREATE_TASK_RULE_NAME = "DataConsumerPolicy-CreateTask-Rule";

  /**
   * Per-migration cache of {@code (entityType, entityId) -> resolved domains}. Many migrated tasks
   * point at the same target entity (e.g. a few glossary terms each with hundreds of tasks); going
   * through {@link EntityRepository#get} for every task would re-load the entity and re-walk its
   * inheritance chain. This cache shortens the lookup to a Map probe for the common case.
   *
   * <p>Bounded LRU via {@link LinkedHashMap#removeEldestEntry} so a pathological install with
   * millions of unique target entities cannot OOM the migration step. Cached lists are wrapped
   * unmodifiable so a downstream caller mutating the returned list cannot corrupt the cache.
   *
   * <p>The migration runs single-threaded on startup so no synchronization is required.
   */
  private static final int DOMAIN_CACHE_MAX_SIZE = 10_000;

  private static final Map<String, List<EntityReference>> DOMAIN_CACHE =
      new LinkedHashMap<>(16, 0.75f, true) {
        @Override
        protected boolean removeEldestEntry(Map.Entry<String, List<EntityReference>> eldest) {
          return size() > DOMAIN_CACHE_MAX_SIZE;
        }
      };

  private MigrationUtil() {}

  public static void backfillMetadataSourceConfigTypes(Handle handle) {
    boolean isMySQL = Boolean.TRUE.equals(DatasourceConfig.getInstance().isMySQL());
    String sql =
        isMySQL
            ? "UPDATE ingestion_pipeline_entity i "
                + "JOIN entity_relationship er ON er.toId = i.id "
                + "AND er.toEntity = 'ingestionPipeline' "
                + "AND er.relation = 0 "
                + "AND er.deleted = false "
                + "JOIN ("
                + "SELECT 'apiService' AS fromEntity, 'ApiMetadata' AS configType "
                + "UNION ALL SELECT 'dashboardService', 'DashboardMetadata' "
                + "UNION ALL SELECT 'databaseService', 'DatabaseMetadata' "
                + "UNION ALL SELECT 'driveService', 'DriveMetadata' "
                + "UNION ALL SELECT 'mcpService', 'McpMetadata' "
                + "UNION ALL SELECT 'messagingService', 'MessagingMetadata' "
                + "UNION ALL SELECT 'mlmodelService', 'MlModelMetadata' "
                + "UNION ALL SELECT 'pipelineService', 'PipelineMetadata' "
                + "UNION ALL SELECT 'searchService', 'SearchMetadata' "
                + "UNION ALL SELECT 'securityService', 'SecurityMetadata' "
                + "UNION ALL SELECT 'storageService', 'StorageMetadata'"
                + ") metadata_config_type ON metadata_config_type.fromEntity = er.fromEntity "
                + "SET i.json = JSON_SET("
                + "i.json, '$.sourceConfig.config.type', metadata_config_type.configType) "
                + "WHERE i.json ->> '$.pipelineType' = 'metadata' "
                + "AND i.json ->> '$.sourceConfig.config.type' IS NULL "
                + "AND JSON_TYPE(JSON_EXTRACT(i.json, '$.sourceConfig.config')) = 'OBJECT'"
            : "UPDATE ingestion_pipeline_entity i "
                + "SET json = jsonb_set(i.json::jsonb, '{sourceConfig,config,type}', "
                + "to_jsonb(metadata_config_type.config_type::text), true)::json "
                + "FROM entity_relationship er "
                + "JOIN (VALUES "
                + "('apiService', 'ApiMetadata'), "
                + "('dashboardService', 'DashboardMetadata'), "
                + "('databaseService', 'DatabaseMetadata'), "
                + "('driveService', 'DriveMetadata'), "
                + "('mcpService', 'McpMetadata'), "
                + "('messagingService', 'MessagingMetadata'), "
                + "('mlmodelService', 'MlModelMetadata'), "
                + "('pipelineService', 'PipelineMetadata'), "
                + "('searchService', 'SearchMetadata'), "
                + "('securityService', 'SecurityMetadata'), "
                + "('storageService', 'StorageMetadata')"
                + ") AS metadata_config_type(from_entity, config_type) "
                + "ON metadata_config_type.from_entity = er.fromentity "
                + "WHERE er.toid = i.id "
                + "AND er.toentity = 'ingestionPipeline' "
                + "AND er.relation = 0 "
                + "AND er.deleted = false "
                + "AND i.json ->> 'pipelineType' = 'metadata' "
                + "AND i.json #>> '{sourceConfig,config,type}' IS NULL "
                + "AND json_typeof(i.json #> '{sourceConfig,config}') = 'object'";
    int count = handle.execute(sql);
    LOG.info("Backfilled metadata source config types for {} ingestion pipelines", count);
  }

  /**
   * Ensure {@code TaskAuthorPolicy} is seeded and attached to the {@code DataConsumer} role on
   * upgrades. Role→Policy attachments are modelled as {@code Relationship.HAS} edges in {@code
   * entity_relationship} (the {@code policies} field on Role JSON is derived from those edges, not
   * stored), so this migration writes the relationship directly via {@code
   * relationshipDAO().insert(...)} which upserts and is therefore idempotent.
   *
   * <p>Migrations run before service startup, so {@code initSeedDataFromResources()} has not yet
   * created {@code TaskAuthorPolicy}. The helper loads the seed JSON from the classpath and
   * persists it via {@link PolicyRepository#initializeEntity} (create-if-missing) before adding
   * the role relationship.
   */
  public static void addTaskAuthorPolicyToDataConsumerRole(CollectionDAO collectionDAO) {
    RoleRepository roleRepository = (RoleRepository) Entity.getEntityRepository(Entity.ROLE);
    PolicyRepository policyRepository =
        (PolicyRepository) Entity.getEntityRepository(Entity.POLICY);
    try {
      Policy policy = ensureTaskAuthorPolicySeeded(policyRepository);
      if (policy == null) {
        LOG.warn(
            "{} seed not found on classpath, skipping DataConsumer attachment", TASK_AUTHOR_POLICY);
        return;
      }
      Role role = roleRepository.findByName(DATA_CONSUMER_ROLE, Include.NON_DELETED);
      collectionDAO
          .relationshipDAO()
          .insert(
              role.getId(), policy.getId(), Entity.ROLE, Entity.POLICY, Relationship.HAS.ordinal());
      LOG.info("Attached {} to {}", TASK_AUTHOR_POLICY, DATA_CONSUMER_ROLE);
    } catch (EntityNotFoundException ex) {
      LOG.warn(
          "Skipping TaskAuthorPolicy backfill: {} not found ({})",
          DATA_CONSUMER_ROLE,
          ex.getMessage());
    } catch (Exception ex) {
      LOG.error(
          "Failed to attach {} to {}: {}",
          TASK_AUTHOR_POLICY,
          DATA_CONSUMER_ROLE,
          ex.getMessage(),
          ex);
    }
  }

  /**
   * Ensure {@code DataConsumerPolicy} contains the {@code DataConsumerPolicy-CreateTask-Rule} that
   * grants authenticated users the {@code Create} operation on the {@code task} resource. The rule
   * was added to the seed JSON in #28044 but the migration step was omitted, so existing
   * installations upgrading from 1.x would not pick it up automatically.
   */
  public static void addCreateTaskRuleToDataConsumerPolicy(CollectionDAO collectionDAO) {
    PolicyRepository repository = (PolicyRepository) Entity.getEntityRepository(Entity.POLICY);
    try {
      Policy policy = repository.findByName(DATA_CONSUMER_POLICY, Include.NON_DELETED);
      if (policy.getRules() == null) {
        policy.setRules(new ArrayList<>());
      }
      boolean ruleExists = false;
      for (Rule rule : policy.getRules()) {
        if (CREATE_TASK_RULE_NAME.equals(rule.getName())) {
          ruleExists = true;
          break;
        }
      }
      if (!ruleExists) {
        Rule createTaskRule =
            new Rule()
                .withName(CREATE_TASK_RULE_NAME)
                .withDescription(
                    "Allow authenticated users to create tasks"
                        + " (data access requests, suggestions, etc.).")
                .withResources(List.of("task"))
                .withOperations(List.of(MetadataOperation.CREATE))
                .withEffect(Rule.Effect.ALLOW);
        policy.getRules().add(createTaskRule);
        collectionDAO
            .policyDAO()
            .update(policy.getId(), policy.getFullyQualifiedName(), JsonUtils.pojoToJson(policy));
        LOG.info("Added {} rule to {}", CREATE_TASK_RULE_NAME, DATA_CONSUMER_POLICY);
      }
    } catch (EntityNotFoundException ex) {
      LOG.warn("{} not found, skipping CreateTask rule backfill", DATA_CONSUMER_POLICY);
    } catch (Exception ex) {
      LOG.error(
          "Failed to add {} to {}: {}",
          CREATE_TASK_RULE_NAME,
          DATA_CONSUMER_POLICY,
          ex.getMessage(),
          ex);
    }
  }

  private static final String TASK_RULE_NAME = "DataConsumerPolicy-TaskRule";

  /**
   * Backfill the per-entity {@code CreateTask}/{@code EditTask} grant onto an existing tenant's
   * {@code DataConsumerPolicy}. The rule is added to the seed JSON in this release but seed
   * policies are create-if-not-exists, so without this migration upgraded deployments would lose
   * the ability for non-admin users to file or patch task threads (the new authorization wired into
   * {@link org.openmetadata.service.resources.feeds.FeedResource} would reject them with 403).
   */
  public static void addTaskRuleToDataConsumerPolicy(CollectionDAO collectionDAO) {
    PolicyRepository repository = (PolicyRepository) Entity.getEntityRepository(Entity.POLICY);
    try {
      Policy policy = repository.findByName(DATA_CONSUMER_POLICY, Include.NON_DELETED);
      if (policy.getRules() == null) {
        policy.setRules(new ArrayList<>());
      }
      boolean ruleExists = false;
      for (Rule rule : policy.getRules()) {
        if (TASK_RULE_NAME.equals(rule.getName())) {
          ruleExists = true;
          break;
        }
      }
      if (!ruleExists) {
        Rule taskRule =
            new Rule()
                .withName(TASK_RULE_NAME)
                .withDescription(
                    "Allow authenticated users to file and edit tasks (data access requests,"
                        + " suggestions, etc.) against any entity. Restrict this rule (e.g. with"
                        + " an isOwner condition) to limit who can file or edit tasks on which"
                        + " entities.")
                .withResources(List.of("all"))
                .withOperations(List.of(MetadataOperation.CREATE_TASK, MetadataOperation.EDIT_TASK))
                .withEffect(Rule.Effect.ALLOW);
        policy.getRules().add(taskRule);
        collectionDAO
            .policyDAO()
            .update(policy.getId(), policy.getFullyQualifiedName(), JsonUtils.pojoToJson(policy));
        LOG.info("Added {} rule to {}", TASK_RULE_NAME, DATA_CONSUMER_POLICY);
      }
    } catch (EntityNotFoundException ex) {
      LOG.warn("{} not found, skipping TaskRule backfill", DATA_CONSUMER_POLICY);
    } catch (Exception ex) {
      LOG.error(
          "Failed to add {} to {}: {}", TASK_RULE_NAME, DATA_CONSUMER_POLICY, ex.getMessage(), ex);
    }
  }

  private static Policy ensureTaskAuthorPolicySeeded(PolicyRepository repository) {
    Policy existing = null;
    try {
      existing = repository.findByName(TASK_AUTHOR_POLICY, Include.NON_DELETED);
    } catch (EntityNotFoundException ignored) {
      // Not seeded yet — fall through to seed-from-classpath path.
    }
    if (existing != null) {
      return existing;
    }
    try {
      List<Policy> seeds = repository.getEntitiesFromSeedData();
      for (Policy seed : seeds) {
        if (TASK_AUTHOR_POLICY.equals(seed.getName())) {
          repository.initializeEntity(seed);
          return repository.findByName(TASK_AUTHOR_POLICY, Include.NON_DELETED);
        }
      }
    } catch (IOException e) {
      LOG.error("Failed to load TaskAuthorPolicy seed data: {}", e.getMessage());
    }
    return null;
  }

  /**
   * Migrate suggestions from the old suggestions table to the new task_entity table. Each
   * suggestion becomes a Task with type=Suggestion and category=MetadataUpdate. The about
   * EntityReference and aboutFqnHash are properly computed from the entityLink.
   */
  public static void migrateSuggestionsToTaskEntity(Handle handle, ConnectionType connectionType) {
    LOG.info("Starting migration of suggestions to task_entity");

    boolean tableExists;
    try {
      handle.createQuery("SELECT 1 FROM suggestions LIMIT 1").mapToMap().list();
      tableExists = true;
    } catch (Exception e) {
      tableExists = false;
    }

    if (!tableExists) {
      LOG.info("suggestions table does not exist, skipping suggestion migration");
      return;
    }

    List<Map<String, Object>> suggestions =
        handle.createQuery("SELECT json FROM suggestions ORDER BY updatedAt ASC").mapToMap().list();

    if (suggestions.isEmpty()) {
      LOG.info("No suggestions found to migrate");
      handle.execute("DROP TABLE IF EXISTS suggestions");
      return;
    }

    LOG.info("Found {} suggestions to migrate", suggestions.size());

    long seqVal = getSequenceValue(handle);
    int migrated = 0;
    int skipped = 0;

    for (Map<String, Object> row : suggestions) {
      try {
        String jsonStr = row.get("json").toString();
        JsonNode suggestionJson = JsonUtils.readTree(jsonStr);

        String suggestionId = suggestionJson.get("id").asText();
        boolean alreadyExists = taskExists(handle, suggestionId);

        if (alreadyExists) {
          String createdByUserId = null;
          if (suggestionJson.has("createdBy")
              && suggestionJson.get("createdBy").has("id")
              && !suggestionJson.get("createdBy").get("id").isNull()) {
            createdByUserId = suggestionJson.get("createdBy").get("id").asText();
          }
          ObjectNode aboutJson = JsonUtils.getObjectNode();
          String entityLinkStr =
              suggestionJson.has("entityLink") ? suggestionJson.get("entityLink").asText() : null;
          if (entityLinkStr != null) {
            setAboutFromEntityLink(aboutJson, entityLinkStr, suggestionJson);
          }
          insertTaskLinkRelationships(
              handle, suggestionId, null, null, null, createdByUserId, aboutJson, connectionType);
          skipped++;
          continue;
        }

        seqVal++;
        String taskIdStr = String.format("TASK-%05d", seqVal);
        String fqnHash = FullyQualifiedName.buildHash(taskIdStr);

        String entityLink =
            suggestionJson.has("entityLink") ? suggestionJson.get("entityLink").asText() : null;
        String suggestionType =
            suggestionJson.has("type") ? suggestionJson.get("type").asText() : "SuggestDescription";
        String oldStatus =
            suggestionJson.has("status") ? suggestionJson.get("status").asText() : "Open";

        String mappedSuggestionType =
            "SuggestTagLabel".equals(suggestionType) ? "Tag" : "Description";
        String newStatus =
            switch (oldStatus) {
              case "Accepted" -> "Approved";
              case "Rejected" -> "Rejected";
              default -> "Open";
            };

        ObjectNode taskJson = JsonUtils.getObjectNode();
        taskJson.put("id", suggestionId);
        taskJson.put("taskId", taskIdStr);
        taskJson.put("name", taskIdStr);
        taskJson.put("fullyQualifiedName", taskIdStr);
        taskJson.put("category", "MetadataUpdate");
        taskJson.put("type", "Suggestion");
        taskJson.put("status", newStatus);
        taskJson.put("priority", "Medium");

        // Build about reference and aboutFqnHash from entityLink
        if (entityLink != null) {
          setAboutFromEntityLink(taskJson, entityLink, suggestionJson);
        }

        // Inherit domains from the target entity so domain-scoped task queries
        // return migrated suggestions correctly.
        List<EntityReference> inheritedDomains = resolveDomainsForTaskAbout(taskJson);
        setDomainsInTaskJson(taskJson, inheritedDomains);

        // Build payload
        ObjectNode payload = JsonUtils.getObjectNode();
        payload.put("suggestionType", mappedSuggestionType);

        String fieldPath = extractFieldPathFromEntityLink(entityLink);
        payload.put("fieldPath", fieldPath);

        if ("Tag".equals(mappedSuggestionType)) {
          JsonNode tagLabels = suggestionJson.get("tagLabels");
          if (tagLabels != null) {
            payload.put("suggestedValue", tagLabels.toString());
          } else {
            payload.put("suggestedValue", "[]");
          }
        } else {
          String desc =
              suggestionJson.has("description") ? suggestionJson.get("description").asText() : "";
          payload.put("suggestedValue", desc);
        }
        payload.put("source", "User");
        taskJson.set("payload", payload);

        // Extract createdBy ID from the suggestion's EntityReference
        String createdByUserId = null;
        if (suggestionJson.has("createdBy")
            && suggestionJson.get("createdBy").has("id")
            && !suggestionJson.get("createdBy").get("id").isNull()) {
          createdByUserId = suggestionJson.get("createdBy").get("id").asText();
          taskJson.put("createdById", createdByUserId);
        }

        long createdAt =
            suggestionJson.has("createdAt") ? suggestionJson.get("createdAt").asLong() : 0;
        long updatedAt =
            suggestionJson.has("updatedAt") ? suggestionJson.get("updatedAt").asLong() : createdAt;
        String updatedBy =
            suggestionJson.has("updatedBy") ? suggestionJson.get("updatedBy").asText() : "system";

        taskJson.put("createdAt", createdAt);
        taskJson.put("updatedAt", updatedAt);
        taskJson.put("updatedBy", updatedBy);
        taskJson.put("deleted", false);
        taskJson.put("version", 0.1);
        taskJson.set("comments", JsonUtils.getObjectNode().arrayNode());
        taskJson.put("commentCount", 0);
        taskJson.set("tags", JsonUtils.getObjectNode().arrayNode());

        insertTask(handle, suggestionId, taskJson.toString(), fqnHash, connectionType);
        insertTaskDomainRelationships(handle, suggestionId, inheritedDomains, connectionType);
        insertTaskLinkRelationships(
            handle, suggestionId, null, null, null, createdByUserId, taskJson, connectionType);
        migrated++;
      } catch (Exception e) {
        LOG.warn("Error migrating suggestion: {}", e.getMessage());
        skipped++;
      }
    }

    updateSequenceValue(handle, seqVal);
    handle.execute("DROP TABLE IF EXISTS suggestions");
    LOG.info("Suggestion migration complete: migrated={}, skipped={}", migrated, skipped);
  }

  /**
   * Migrate thread-based tasks from thread_entity to the new task_entity table. Each thread with
   * type='Task' becomes a proper Task entity with correct type mapping, payload, and aboutFqnHash.
   */
  public static void migrateThreadTasksToTaskEntity(Handle handle, ConnectionType connectionType) {
    LOG.info("Starting migration of thread-based tasks to task_entity");
    String threadTable;
    if (tableExists(handle, "thread_entity")) {
      threadTable = "thread_entity";
    } else if (tableExists(handle, "thread_entity_legacy")) {
      threadTable = "thread_entity_legacy";
    } else {
      LOG.info(
          "Neither thread_entity nor thread_entity_legacy exists, skipping thread task migration");
      return;
    }
    List<Map<String, Object>> threads =
        handle
            .createQuery(
                String.format(
                    "SELECT json FROM %s WHERE type = 'Task' ORDER BY createdAt ASC", threadTable))
            .mapToMap()
            .list();

    if (threads.isEmpty()) {
      LOG.info("No thread-based tasks found to migrate");
      return;
    }

    LOG.info("Found {} thread-based tasks to migrate", threads.size());

    long seqVal = getSequenceValue(handle);
    int migrated = 0;
    int skipped = 0;

    for (Map<String, Object> row : threads) {
      try {
        String jsonStr = row.get("json").toString();
        JsonNode threadJson = JsonUtils.readTree(jsonStr);

        String threadId = threadJson.get("id").asText();
        boolean alreadyExists = taskExists(handle, threadId);

        JsonNode taskDetails = threadJson.get("task");
        if (taskDetails == null) {
          skipped++;
          continue;
        }

        String aboutLink = threadJson.has("about") ? threadJson.get("about").asText() : null;
        if (aboutLink == null) {
          skipped++;
          continue;
        }

        String oldType = taskDetails.get("type").asText();
        String oldStatus = taskDetails.has("status") ? taskDetails.get("status").asText() : "Open";

        MessageParser.EntityLink entityLink;
        try {
          entityLink = MessageParser.EntityLink.parse(aboutLink);
        } catch (Exception e) {
          LOG.warn("Cannot parse entityLink '{}', skipping thread {}", aboutLink, threadId);
          skipped++;
          continue;
        }

        if (alreadyExists) {
          String createdByName = threadJson.path("createdBy").asText("system");
          String createdByUserId = lookupUserId(handle, createdByName);
          ObjectNode aboutJson = JsonUtils.getObjectNode();
          setAboutFromEntityLink(aboutJson, aboutLink, threadJson);
          insertTaskLinkRelationships(
              handle,
              threadId,
              taskDetails.has("assignees") ? taskDetails.get("assignees") : null,
              taskDetails.has("reviewers") ? taskDetails.get("reviewers") : null,
              taskDetails.has("watchers") ? taskDetails.get("watchers") : null,
              createdByUserId,
              aboutJson,
              connectionType);
          // Re-run domain inheritance for existing rows. The original v200 promotion
          // used a raw SQL lookup that missed inherited domains (e.g. glossary terms
          // inheriting from their parent glossary); now that the lookup walks the
          // entity API, force-migrate must also reconcile domain relationships for
          // tasks that were already promoted before this fix.
          List<EntityReference> inheritedDomains = resolveDomainsForTaskAbout(aboutJson);
          insertTaskDomainRelationships(handle, threadId, inheritedDomains, connectionType);
          skipped++;
          continue;
        }

        String entityType = entityLink.getEntityType();
        String newType = mapThreadTaskType(oldType, entityType);
        String newCategory = mapThreadTaskCategory(oldType, entityType);
        String newStatus = mapThreadTaskStatus(oldStatus, oldType, entityType);

        seqVal++;
        String taskIdStr = String.format("TASK-%05d", seqVal);
        String fqnHash = FullyQualifiedName.buildHash(taskIdStr);

        ObjectNode taskJson = JsonUtils.getObjectNode();
        taskJson.put("id", threadId);
        taskJson.put("taskId", taskIdStr);
        taskJson.put("name", taskIdStr);
        taskJson.put("fullyQualifiedName", taskIdStr);
        taskJson.put("category", newCategory);
        taskJson.put("type", newType);
        taskJson.put("status", newStatus);
        taskJson.put("priority", "Medium");

        // Set about and aboutFqnHash
        setAboutFromEntityLink(taskJson, aboutLink, threadJson);

        // Inherit domains from the target entity so domain-scoped task queries
        // return migrated tasks correctly.
        List<EntityReference> inheritedDomains = resolveDomainsForTaskAbout(taskJson);
        setDomainsInTaskJson(taskJson, inheritedDomains);

        // Build payload
        ObjectNode payload = buildThreadTaskPayload(oldType, taskDetails, entityLink);
        if (payload != null) {
          taskJson.set("payload", payload);
        }

        // Set assignees
        if (taskDetails.has("assignees") && taskDetails.get("assignees").isArray()) {
          taskJson.set("assignees", taskDetails.get("assignees"));
        }

        // Set description from thread message
        if (threadJson.has("message")) {
          taskJson.put("description", threadJson.get("message").asText());
        }

        long createdAt = threadJson.has("threadTs") ? threadJson.get("threadTs").asLong() : 0;
        long updatedAt =
            threadJson.has("updatedAt") ? threadJson.get("updatedAt").asLong() : createdAt;
        String createdByName =
            threadJson.has("createdBy") ? threadJson.get("createdBy").asText() : "system";
        String updatedBy =
            threadJson.has("updatedBy") ? threadJson.get("updatedBy").asText() : createdByName;

        // Look up createdBy user ID from user_entity by name
        String createdByUserId = lookupUserId(handle, createdByName);
        if (createdByUserId != null) {
          taskJson.put("createdById", createdByUserId);
        }

        taskJson.put("createdAt", createdAt);
        taskJson.put("updatedAt", updatedAt);
        taskJson.put("updatedBy", updatedBy);
        taskJson.put("deleted", false);
        taskJson.put("version", 0.1);
        taskJson.set("comments", JsonUtils.getObjectNode().arrayNode());
        taskJson.put("commentCount", 0);
        taskJson.set("tags", JsonUtils.getObjectNode().arrayNode());

        // Set resolution details for closed tasks
        if ("Closed".equals(oldStatus)) {
          ObjectNode resolution = JsonUtils.getObjectNode();
          resolution.put("type", newStatus.equals("Approved") ? "Approved" : "Completed");
          if (taskDetails.has("closedBy")) {
            resolution.put("comment", "Migrated from thread-based task system");
          }
          if (taskDetails.has("closedAt")) {
            resolution.put("resolvedAt", taskDetails.get("closedAt").asLong());
          }
          if (taskDetails.has("newValue")) {
            resolution.put("newValue", taskDetails.get("newValue").asText());
          }
          taskJson.set("resolution", resolution);
        }

        insertTask(handle, threadId, taskJson.toString(), fqnHash, connectionType);
        insertTaskDomainRelationships(handle, threadId, inheritedDomains, connectionType);
        insertTaskLinkRelationships(
            handle,
            threadId,
            taskDetails.has("assignees") ? taskDetails.get("assignees") : null,
            taskDetails.has("reviewers") ? taskDetails.get("reviewers") : null,
            taskDetails.has("watchers") ? taskDetails.get("watchers") : null,
            createdByUserId,
            taskJson,
            connectionType);
        migrated++;
      } catch (Exception e) {
        LOG.warn("Error migrating thread task: {}", e.getMessage());
        skipped++;
      }
    }

    updateSequenceValue(handle, seqVal);
    LOG.info("Thread task migration complete: migrated={}, skipped={}", migrated, skipped);
  }

  public static void backfillAnnouncementRelationships(Handle handle) {
    LOG.info("Backfilling announcement relationships");

    boolean tableExists;
    try {
      handle.createQuery("SELECT 1 FROM announcement_entity LIMIT 1").mapTo(Integer.class).one();
      tableExists = true;
    } catch (Exception e) {
      tableExists = false;
    }

    if (!tableExists) {
      LOG.info("announcement_entity table does not exist, skipping relationship backfill");
      return;
    }

    List<Map<String, Object>> rows =
        handle.createQuery("SELECT json FROM announcement_entity").mapToMap().list();
    if (rows.isEmpty()) {
      return;
    }

    AnnouncementRepository repository =
        (AnnouncementRepository) Entity.getEntityRepository(Entity.ANNOUNCEMENT);
    CollectionDAO.EntityRelationshipDAO relationshipDAO =
        Entity.getCollectionDAO().relationshipDAO();

    for (Map<String, Object> row : rows) {
      try {
        Announcement announcement =
            JsonUtils.readValue(row.get("json").toString(), Announcement.class);

        relationshipDAO.deleteTo(
            announcement.getId(), Entity.ANNOUNCEMENT, Relationship.HAS.ordinal());
        relationshipDAO.deleteTo(
            announcement.getId(), Entity.ANNOUNCEMENT, Relationship.OWNS.ordinal());
        relationshipDAO.deleteTo(
            announcement.getId(), Entity.ANNOUNCEMENT, Relationship.MENTIONED_IN.ordinal());

        if (announcement.getEntityLink() == null) {
          continue;
        }

        EntityReference target =
            EntityUtil.validateEntityLink(
                MessageParser.EntityLink.parse(announcement.getEntityLink()));

        relationshipDAO.insert(
            target.getId(),
            announcement.getId(),
            target.getType(),
            Entity.ANNOUNCEMENT,
            Relationship.MENTIONED_IN.ordinal());

        List<EntityReference> owners = Entity.getOwners(target);
        if (owners != null) {
          for (EntityReference owner : owners) {
            relationshipDAO.insert(
                owner.getId(),
                announcement.getId(),
                owner.getType(),
                Entity.ANNOUNCEMENT,
                Relationship.OWNS.ordinal());
          }
        }

        repository.prepare(announcement, true);
        List<EntityReference> domains = announcement.getDomains();
        if (domains != null) {
          for (EntityReference domain : domains) {
            relationshipDAO.insert(
                domain.getId(),
                announcement.getId(),
                Entity.DOMAIN,
                Entity.ANNOUNCEMENT,
                Relationship.HAS.ordinal());
          }
        }
      } catch (Exception e) {
        LOG.warn("Failed to backfill announcement relationships: {}", e.getMessage());
      }
    }
  }

  /**
   * Backfill the new activity_stream table from legacy system-generated feed rows in
   * thread_entity. User conversations stay in thread_entity; only generated activity entries are
   * migrated.
   */
  public static void migrateLegacyActivityThreadsToActivityStream(
      Handle handle, ConnectionType connectionType) {
    LOG.info("Starting migration of legacy thread activity to activity_stream");

    if (!tableExists(handle, "thread_entity")) {
      LOG.info("thread_entity table does not exist, skipping activity stream migration");
      return;
    }

    List<Map<String, Object>> rows = listLegacyActivityThreadRows(handle);

    if (rows.isEmpty()) {
      LOG.info("No legacy conversation rows found to inspect for activity migration");
      return;
    }

    int migrated = 0;
    int skipped = 0;

    for (Map<String, Object> row : rows) {
      try {
        String json = row.get("json").toString();
        Thread legacyThread = JsonUtils.readValue(json, Thread.class);
        JsonNode legacyThreadJson = JsonUtils.readTree(json);
        ActivityEvent event =
            buildActivityEventFromLegacyThread(handle, legacyThread, legacyThreadJson);

        if (event == null) {
          skipped++;
          continue;
        }

        if (activityEventExists(handle, event.getId(), event.getTimestamp())) {
          skipped++;
          continue;
        }

        insertActivityEvent(handle, event, connectionType);
        migrated++;
      } catch (Exception e) {
        LOG.warn("Error migrating legacy activity thread to activity_stream: {}", e.getMessage());
        skipped++;
      }
    }

    LOG.info(
        "Legacy activity thread migration complete: migrated={}, skipped={}", migrated, skipped);
  }

  private static void setAboutFromEntityLink(
      ObjectNode taskJson, String entityLinkStr, JsonNode sourceJson) {
    try {
      MessageParser.EntityLink entityLink = MessageParser.EntityLink.parse(entityLinkStr);
      String entityType = entityLink.getEntityType();
      String entityFQN = entityLink.getEntityFQN();

      ObjectNode aboutRef = JsonUtils.getObjectNode();
      if (sourceJson.has("entityId") && !sourceJson.get("entityId").isNull()) {
        aboutRef.put("id", sourceJson.get("entityId").asText());
      } else if (sourceJson.has("entityRef")
          && sourceJson.get("entityRef").has("id")
          && !sourceJson.get("entityRef").get("id").isNull()) {
        aboutRef.put("id", sourceJson.get("entityRef").get("id").asText());
      }
      aboutRef.put("type", entityType);
      aboutRef.put("fullyQualifiedName", entityFQN);
      taskJson.set("about", aboutRef);

      String aboutFqnHash = FullyQualifiedName.buildHash(entityFQN);
      taskJson.put("aboutFqnHash", aboutFqnHash);
    } catch (Exception e) {
      LOG.debug("Could not parse entityLink '{}': {}", entityLinkStr, e.getMessage());
    }
  }

  private static String extractFieldPathFromEntityLink(String entityLinkStr) {
    if (entityLinkStr == null) {
      return "description";
    }
    try {
      MessageParser.EntityLink entityLink = MessageParser.EntityLink.parse(entityLinkStr);
      String fieldName = entityLink.getFieldName();
      if (fieldName != null) {
        String arrayFieldName = entityLink.getArrayFieldName();
        String arrayFieldValue = entityLink.getArrayFieldValue();
        if (arrayFieldName != null && arrayFieldValue != null) {
          return fieldName + "." + arrayFieldName + "." + arrayFieldValue;
        } else if (arrayFieldName != null) {
          return fieldName + "." + arrayFieldName;
        }
        return fieldName;
      }
    } catch (Exception e) {
      LOG.debug("Could not parse entityLink '{}': {}", entityLinkStr, e.getMessage());
    }
    return "description";
  }

  private static String mapThreadTaskType(String oldType, String entityType) {
    return switch (oldType) {
      case "RequestDescription", "UpdateDescription" -> "DescriptionUpdate";
      case "RequestTag", "UpdateTag" -> "TagUpdate";
      case "RequestApproval" -> Entity.GLOSSARY_TERM.equals(entityType)
          ? "GlossaryApproval"
          : "RequestApproval";
      case "RequestTestCaseFailureResolution" -> "TestCaseResolution";
      case "RecognizerFeedbackApproval" -> "RecognizerFeedbackApproval";
      default -> "CustomTask";
    };
  }

  private static String mapThreadTaskCategory(String oldType, String entityType) {
    return switch (oldType) {
      case "RequestDescription", "UpdateDescription", "RequestTag", "UpdateTag" -> "MetadataUpdate";
      case "RequestApproval" -> "Approval";
      case "RequestTestCaseFailureResolution" -> "Incident";
      case "RecognizerFeedbackApproval" -> "Review";
      default -> "Custom";
    };
  }

  private static String mapThreadTaskStatus(String oldStatus, String oldType, String entityType) {
    if ("Open".equals(oldStatus)) {
      return "Open";
    }
    // Closed status - map based on task type
    return switch (oldType) {
      case "RequestApproval", "RecognizerFeedbackApproval" -> "Approved";
      default -> "Completed";
    };
  }

  private static ObjectNode buildThreadTaskPayload(
      String oldType, JsonNode taskDetails, MessageParser.EntityLink entityLink) {
    return switch (oldType) {
      case "RequestDescription", "UpdateDescription" -> {
        ObjectNode payload = JsonUtils.getObjectNode();
        String fieldPath = entityLink.getFieldName();
        if (fieldPath != null) {
          String arrayField = entityLink.getArrayFieldName();
          if (arrayField != null) {
            payload.put("fieldPath", fieldPath + "." + arrayField + ".description");
          } else {
            payload.put("fieldPath", fieldPath);
          }
        } else {
          payload.put("fieldPath", "description");
        }
        if (taskDetails.has("oldValue") && !taskDetails.get("oldValue").isNull()) {
          payload.put("currentDescription", taskDetails.get("oldValue").asText());
        }
        String newDesc = null;
        if (taskDetails.has("newValue") && !taskDetails.get("newValue").isNull()) {
          newDesc = taskDetails.get("newValue").asText();
        } else if (taskDetails.has("suggestion") && !taskDetails.get("suggestion").isNull()) {
          newDesc = taskDetails.get("suggestion").asText();
        }
        if (newDesc != null) {
          payload.put("newDescription", newDesc);
        } else {
          payload.put("newDescription", "");
        }
        payload.put("source", "User");
        yield payload;
      }
      case "RequestTag", "UpdateTag" -> {
        ObjectNode payload = JsonUtils.getObjectNode();
        String fieldPath = entityLink.getFieldName();
        if (fieldPath != null) {
          String arrayField = entityLink.getArrayFieldName();
          if (arrayField != null) {
            payload.put("fieldPath", fieldPath + "." + arrayField);
          } else {
            payload.put("fieldPath", fieldPath);
          }
        }
        payload.put("operation", "Add");
        if (taskDetails.has("suggestion") && !taskDetails.get("suggestion").isNull()) {
          try {
            JsonNode tagsNode = JsonUtils.readTree(taskDetails.get("suggestion").asText());
            payload.set("tagsToAdd", tagsNode);
          } catch (Exception e) {
            payload.put("source", "User");
          }
        }
        payload.put("source", "User");
        yield payload;
      }
      case "RequestTestCaseFailureResolution" -> {
        if (taskDetails.has("testCaseResolutionStatusId")
            && !taskDetails.get("testCaseResolutionStatusId").isNull()) {
          ObjectNode payload = JsonUtils.getObjectNode();
          payload.put(
              "testCaseResolutionStatusId", taskDetails.get("testCaseResolutionStatusId").asText());
          yield payload;
        }
        yield null;
      }
      case "RecognizerFeedbackApproval" -> {
        ObjectNode payload = JsonUtils.getObjectNode();
        if (taskDetails.has("feedback") && !taskDetails.get("feedback").isNull()) {
          payload.set("data", taskDetails.get("feedback"));
        }
        if (taskDetails.has("recognizer") && !taskDetails.get("recognizer").isNull()) {
          ObjectNode metadata = JsonUtils.getObjectNode();
          metadata.set("recognizer", taskDetails.get("recognizer"));
          payload.set("metadata", metadata);
        }
        yield payload;
      }
      case "Generic" -> {
        ObjectNode payload = JsonUtils.getObjectNode();
        if (taskDetails.has("suggestion") && !taskDetails.get("suggestion").isNull()) {
          payload.put("data", taskDetails.get("suggestion").asText());
        }
        yield payload;
      }
      default -> null;
    };
  }

  private static ActivityEvent buildActivityEventFromLegacyThread(
      Handle handle, Thread legacyThread, JsonNode legacyThreadJson) {
    if (legacyThread == null
        || legacyThread.getId() == null
        || legacyThread.getGeneratedBy() != Thread.GeneratedBy.SYSTEM) {
      return null;
    }

    EntityReference entityRef = resolveActivityEntityReference(legacyThread);
    if (entityRef == null || entityRef.getId() == null || entityRef.getType() == null) {
      LOG.debug(
          "Skipping legacy activity thread '{}' because entityRef could not be resolved",
          legacyThread.getId());
      return null;
    }

    ActivityEventType eventType = mapLegacyActivityThreadType(legacyThread, legacyThreadJson);
    if (eventType == null) {
      return null;
    }

    String actorName =
        legacyThread.getUpdatedBy() != null && !legacyThread.getUpdatedBy().isBlank()
            ? legacyThread.getUpdatedBy()
            : legacyThread.getCreatedBy();
    EntityReference actorRef = buildActivityActorReference(handle, actorName);

    long timestamp =
        legacyThread.getUpdatedAt() != null
            ? legacyThread.getUpdatedAt()
            : legacyThread.getThreadTs() != null
                ? legacyThread.getThreadTs()
                : System.currentTimeMillis();

    String fieldName = readThreadFeedFieldName(legacyThreadJson);

    return new ActivityEvent()
        .withId(legacyThread.getId())
        .withEventType(eventType)
        .withEntity(entityRef)
        .withAbout(legacyThread.getAbout())
        .withDomains(buildActivityDomains(legacyThread.getDomains()))
        .withActor(actorRef)
        .withTimestamp(timestamp)
        .withSummary(readThreadActivitySummary(legacyThread, legacyThreadJson))
        .withFieldName(fieldName)
        .withOldValue(
            truncateActivityValue(readThreadActivityValue(legacyThreadJson, fieldName, true)))
        .withNewValue(
            truncateActivityValue(readThreadActivityValue(legacyThreadJson, fieldName, false)))
        .withChangeDescription(legacyThread.getChangeDescription())
        .withReactions(legacyThread.getReactions());
  }

  private static EntityReference buildActivityActorReference(Handle handle, String userName) {
    String actorName = userName == null || userName.isBlank() ? "system" : userName;
    String actorId = lookupUserId(handle, actorName);
    UUID actorUuid =
        actorId != null
            ? UUID.fromString(actorId)
            : UUID.nameUUIDFromBytes(
                ("activity-actor:" + actorName).getBytes(StandardCharsets.UTF_8));

    return new EntityReference()
        .withId(actorUuid)
        .withType(Entity.USER)
        .withName(actorName)
        .withFullyQualifiedName(actorName);
  }

  private static List<EntityReference> buildActivityDomains(List<UUID> domainIds) {
    if (domainIds == null || domainIds.isEmpty()) {
      return null;
    }

    return domainIds.stream()
        .map(domainId -> new EntityReference().withId(domainId).withType(Entity.DOMAIN))
        .toList();
  }

  private static ActivityEventType mapLegacyActivityThreadType(
      Thread legacyThread, JsonNode legacyThreadJson) {
    if (legacyThread.getCardStyle() == null) {
      return mapFieldNameToActivityEventType(readThreadFeedFieldName(legacyThreadJson));
    }

    return switch (legacyThread.getCardStyle()) {
      case ENTITY_CREATED -> ActivityEventType.ENTITY_CREATED;
      case ENTITY_DELETED -> ActivityEventType.ENTITY_DELETED;
      case ENTITY_SOFT_DELETED -> ActivityEventType.ENTITY_SOFT_DELETED;
      case DESCRIPTION -> isNestedFieldActivity(legacyThread.getAbout(), "description")
          ? ActivityEventType.COLUMN_DESCRIPTION_UPDATED
          : ActivityEventType.DESCRIPTION_UPDATED;
      case TAGS -> isNestedFieldActivity(legacyThread.getAbout(), "tags")
          ? ActivityEventType.COLUMN_TAGS_UPDATED
          : ActivityEventType.TAGS_UPDATED;
      case OWNER -> ActivityEventType.OWNER_UPDATED;
      case DOMAIN -> ActivityEventType.DOMAIN_UPDATED;
      case CUSTOM_PROPERTIES -> ActivityEventType.CUSTOM_PROPERTY_UPDATED;
      case TEST_CASE_RESULT -> ActivityEventType.TEST_CASE_STATUS_CHANGED;
      case LOGICAL_TEST_CASE_ADDED, ASSETS -> {
        ActivityEventType fromField =
            mapFieldNameToActivityEventType(readThreadFeedFieldName(legacyThreadJson));
        yield fromField != null ? fromField : ActivityEventType.ENTITY_UPDATED;
      }
      default -> {
        ActivityEventType fromField =
            mapFieldNameToActivityEventType(readThreadFeedFieldName(legacyThreadJson));
        yield fromField != null ? fromField : ActivityEventType.ENTITY_UPDATED;
      }
    };
  }

  private static ActivityEventType mapFieldNameToActivityEventType(String fieldName) {
    if (fieldName == null || fieldName.isBlank()) {
      return null;
    }

    return switch (fieldName) {
      case "description" -> ActivityEventType.DESCRIPTION_UPDATED;
      case "tags" -> ActivityEventType.TAGS_UPDATED;
      case "owner", "owners" -> ActivityEventType.OWNER_UPDATED;
      case "domain", "domains" -> ActivityEventType.DOMAIN_UPDATED;
      case "tier" -> ActivityEventType.TIER_UPDATED;
      default -> fieldName.startsWith("extension")
          ? ActivityEventType.CUSTOM_PROPERTY_UPDATED
          : null;
    };
  }

  private static EntityReference resolveActivityEntityReference(Thread legacyThread) {
    if (legacyThread.getEntityRef() != null && legacyThread.getEntityRef().getId() != null) {
      return legacyThread.getEntityRef();
    }

    if (legacyThread.getAbout() == null || legacyThread.getAbout().isBlank()) {
      return null;
    }

    try {
      MessageParser.EntityLink entityLink = MessageParser.EntityLink.parse(legacyThread.getAbout());
      return Entity.getEntityReferenceByName(
          entityLink.getEntityType(), entityLink.getEntityFQN(), Include.ALL);
    } catch (Exception e) {
      LOG.debug(
          "Could not resolve entity reference from legacy activity thread '{}': {}",
          legacyThread.getId(),
          e.getMessage());
      return null;
    }
  }

  private static String readThreadFeedFieldName(JsonNode legacyThreadJson) {
    JsonNode fieldName = legacyThreadJson.path("feedInfo").path("fieldName");
    return fieldName.isMissingNode() || fieldName.isNull() ? null : fieldName.asText();
  }

  private static String readThreadActivitySummary(Thread legacyThread, JsonNode legacyThreadJson) {
    JsonNode summary = legacyThreadJson.path("feedInfo").path("headerMessage");
    if (!summary.isMissingNode() && !summary.isNull() && !summary.asText().isBlank()) {
      return summary.asText();
    }
    return legacyThread.getMessage();
  }

  private static Object readThreadActivityValue(
      JsonNode legacyThreadJson, String fieldName, boolean oldValue) {
    JsonNode entitySpecificInfo = legacyThreadJson.path("feedInfo").path("entitySpecificInfo");
    if (entitySpecificInfo.isMissingNode() || entitySpecificInfo.isNull()) {
      return null;
    }

    String previousKey = oldValue ? "previousDescription" : "newDescription";
    if ("description".equals(fieldName) && entitySpecificInfo.has(previousKey)) {
      return entitySpecificInfo.get(previousKey).asText();
    }

    if ("tags".equals(fieldName)) {
      String key = oldValue ? "previousTags" : "updatedTags";
      return entitySpecificInfo.has(key) ? entitySpecificInfo.get(key).toString() : null;
    }

    if ("owner".equals(fieldName) || "owners".equals(fieldName)) {
      String key = oldValue ? "previousOwner" : "updatedOwner";
      return entitySpecificInfo.has(key) ? entitySpecificInfo.get(key).toString() : null;
    }

    if ("domain".equals(fieldName) || "domains".equals(fieldName)) {
      String key = oldValue ? "previousDomains" : "updatedDomains";
      return entitySpecificInfo.has(key) ? entitySpecificInfo.get(key).toString() : null;
    }

    if (fieldName != null && fieldName.startsWith("extension")) {
      String key = oldValue ? "previousValue" : "updatedValue";
      return entitySpecificInfo.has(key) ? entitySpecificInfo.get(key).toString() : null;
    }

    return null;
  }

  private static boolean isNestedFieldActivity(String about, String terminalField) {
    if (about == null || about.isBlank()) {
      return false;
    }

    try {
      MessageParser.EntityLink entityLink = MessageParser.EntityLink.parse(about);
      return List.of("columns", "schemaFields", "children").contains(entityLink.getFieldName())
          && terminalField.equals(entityLink.getArrayFieldValue());
    } catch (Exception e) {
      LOG.debug("Could not parse legacy activity about link '{}': {}", about, e.getMessage());
      return false;
    }
  }

  private static boolean tableExists(Handle handle, String tableName) {
    try {
      handle
          .createQuery(String.format("SELECT 1 FROM %s LIMIT 1", tableName))
          .mapTo(Integer.class)
          .findFirst();
      return true;
    } catch (Exception e) {
      return false;
    }
  }

  private static List<Map<String, Object>> listLegacyActivityThreadRows(Handle handle) {
    String postgresQuery =
        "SELECT json FROM thread_entity "
            + "WHERE type = 'Conversation' AND json->>'generatedBy' = 'system' "
            + "ORDER BY updatedAt ASC, createdAt ASC";
    String mysqlQuery =
        "SELECT json FROM thread_entity "
            + "WHERE type = 'Conversation' "
            + "AND JSON_UNQUOTE(JSON_EXTRACT(json, '$.generatedBy')) = 'system' "
            + "ORDER BY updatedAt ASC, createdAt ASC";

    try {
      return handle.createQuery(postgresQuery).mapToMap().list();
    } catch (Exception ignored) {
      return handle.createQuery(mysqlQuery).mapToMap().list();
    }
  }

  private static String truncateActivityValue(Object value) {
    if (value == null) {
      return null;
    }

    String stringValue = value.toString();
    if (stringValue.length() <= 1000) {
      return stringValue;
    }

    return stringValue.substring(0, 997) + "...";
  }

  private static boolean activityEventExists(Handle handle, UUID activityId, long timestamp) {
    return handle
            .createQuery(
                "SELECT COUNT(*) FROM activity_stream WHERE id = :id AND timestamp = :timestamp")
            .bind("id", activityId.toString())
            .bind("timestamp", timestamp)
            .mapTo(Long.class)
            .one()
        > 0;
  }

  private static void insertActivityEvent(
      Handle handle, ActivityEvent event, ConnectionType connectionType) {
    String entityFqnHash =
        event.getEntity().getFullyQualifiedName() != null
            ? FullyQualifiedName.buildHash(event.getEntity().getFullyQualifiedName())
            : null;
    String aboutFqnHash =
        nullOrEmpty(event.getAbout())
            ? null
            : FullyQualifiedName.buildHash(
                MessageParser.EntityLink.parse(event.getAbout()).getEntityFQN());
    String domains =
        event.getDomains() == null || event.getDomains().isEmpty()
            ? null
            : JsonUtils.pojoToJson(
                event.getDomains().stream().map(domain -> domain.getId().toString()).toList());

    String domainsBind = connectionType == ConnectionType.POSTGRES ? ":domains::jsonb" : ":domains";
    String jsonBind = connectionType == ConnectionType.POSTGRES ? ":json::jsonb" : ":json";
    handle
        .createUpdate(
            "INSERT INTO activity_stream "
                + "(id, eventType, entityType, entityId, entityFqnHash, about, aboutFqnHash, "
                + "actorId, actorName, timestamp, summary, fieldName, oldValue, newValue, domains, json) "
                + "VALUES (:id, :eventType, :entityType, :entityId, :entityFqnHash, :about, "
                + ":aboutFqnHash, :actorId, :actorName, :timestamp, :summary, :fieldName, "
                + ":oldValue, :newValue, "
                + domainsBind
                + ", "
                + jsonBind
                + ")")
        .bind("id", event.getId().toString())
        .bind("eventType", event.getEventType().value())
        .bind("entityType", event.getEntity().getType())
        .bind("entityId", event.getEntity().getId().toString())
        .bind("entityFqnHash", entityFqnHash)
        .bind("about", event.getAbout())
        .bind("aboutFqnHash", aboutFqnHash)
        .bind("actorId", event.getActor().getId().toString())
        .bind("actorName", event.getActor().getName())
        .bind("timestamp", event.getTimestamp())
        .bind("summary", event.getSummary())
        .bind("fieldName", event.getFieldName())
        .bind("oldValue", event.getOldValue())
        .bind("newValue", event.getNewValue())
        .bind("domains", domains)
        .bind("json", JsonUtils.pojoToJson(event))
        .execute();
  }

  private static long getSequenceValue(Handle handle) {
    return handle
        .createQuery("SELECT id FROM new_task_sequence")
        .mapTo(Long.class)
        .findOne()
        .orElse(0L);
  }

  private static void updateSequenceValue(Handle handle, long seqVal) {
    handle.execute("UPDATE new_task_sequence SET id = ?", seqVal);
  }

  private static boolean taskExists(Handle handle, String taskId) {
    return handle
            .createQuery("SELECT COUNT(*) FROM task_entity WHERE id = :id")
            .bind("id", taskId)
            .mapTo(Long.class)
            .one()
        > 0;
  }

  private static void insertTask(
      Handle handle, String id, String json, String fqnHash, ConnectionType connectionType) {
    String sql =
        connectionType == ConnectionType.POSTGRES
            ? "INSERT INTO task_entity (id, json, fqnHash) VALUES (:id, :json::jsonb, :fqnHash)"
            : "INSERT INTO task_entity (id, json, fqnHash) VALUES (:id, :json, :fqnHash)";
    handle.createUpdate(sql).bind("id", id).bind("json", json).bind("fqnHash", fqnHash).execute();
  }

  private static String lookupUserId(Handle handle, String userName) {
    if (userName == null || "system".equals(userName)) {
      return null;
    }
    try {
      String nameHash = FullyQualifiedName.buildHash(userName);
      return handle
          .createQuery("SELECT id FROM user_entity WHERE nameHash = :nameHash")
          .bind("nameHash", nameHash)
          .mapTo(String.class)
          .findOne()
          .orElse(null);
    } catch (Exception e) {
      LOG.debug("Could not look up user '{}': {}", userName, e.getMessage());
      return null;
    }
  }

  /**
   * Resolve the domains of the target entity referenced by the task's `about` field.
   * Equivalent to {@code TaskRepository.inheritDomainsFromTargetEntity()} but uses the
   * {@link EntityRepository} layer so inherited domains (e.g. a glossary term inheriting from
   * its parent glossary) are included.
   */
  private static List<EntityReference> resolveDomainsForTaskAbout(ObjectNode taskJson) {
    JsonNode about = taskJson.get("about");
    if (about == null || !about.has("type")) {
      return Collections.emptyList();
    }

    String entityType = about.get("type").asText();
    String entityId =
        about.has("id") && !about.get("id").isNull() ? about.get("id").asText() : null;

    if (entityId == null) {
      return Collections.emptyList();
    }

    return resolveDomainsViaRepository(entityId, entityType);
  }

  /**
   * Resolve an entity's effective domains via {@link EntityRepository#get} so that
   * <em>inherited</em> domains are included. Glossary terms, columns, and other entities that
   * inherit their domain from a parent do not have a direct {@code domain --HAS--> entity} row in
   * {@code entity_relationship}; the inheritance is computed at read time. A raw SQL query on
   * {@code entity_relationship} would miss those cases entirely.
   *
   * <p>Results are cached in {@link #DOMAIN_CACHE} so that the (typical) pattern of many tasks
   * sharing a small set of target entities resolves each unique entity exactly once. Transient
   * lookup failures are not cached so a later task on the same entity can retry.
   */
  private static List<EntityReference> resolveDomainsViaRepository(
      String entityId, String entityType) {
    String cacheKey = entityType + "::" + entityId;
    List<EntityReference> cached = DOMAIN_CACHE.get(cacheKey);
    if (cached != null) {
      return cached;
    }
    try {
      EntityRepository<?> repo = Entity.getEntityRepository(entityType);
      if (!repo.isSupportsDomains()) {
        DOMAIN_CACHE.put(cacheKey, Collections.emptyList());
        return Collections.emptyList();
      }
      Object entity =
          repo.get(null, UUID.fromString(entityId), repo.getFields(Entity.FIELD_DOMAINS));
      if (!(entity instanceof EntityInterface ei)) {
        DOMAIN_CACHE.put(cacheKey, Collections.emptyList());
        return Collections.emptyList();
      }
      // Snapshot via List.copyOf so the cache entry is genuinely independent of the
      // (potentially-mutable) list returned by the repository.
      List<EntityReference> domains =
          ei.getDomains() == null ? Collections.emptyList() : List.copyOf(ei.getDomains());
      DOMAIN_CACHE.put(cacheKey, domains);
      return domains;
    } catch (Exception e) {
      LOG.debug(
          "Could not resolve domains for entity {}/{}: {}", entityType, entityId, e.getMessage());
      return Collections.emptyList();
    }
  }

  /**
   * Set the {@code domains} array in the task JSON so it is visible to readers
   * that don't follow relationships (e.g. the search index pipeline).
   */
  private static void setDomainsInTaskJson(ObjectNode taskJson, List<EntityReference> domains) {
    if (domains == null || domains.isEmpty()) {
      return;
    }
    taskJson.set("domains", JsonUtils.valueToTree(domains));
  }

  private static void insertEntityRelationship(
      Handle handle,
      String fromId,
      String fromEntity,
      String toId,
      String toEntity,
      Relationship relation,
      ConnectionType connectionType) {
    String sql =
        connectionType == ConnectionType.POSTGRES
            ? "INSERT INTO entity_relationship (fromId, toId, fromEntity, toEntity, relation) "
                + "VALUES (:fromId, :toId, :fromEntity, :toEntity, :relation) "
                + "ON CONFLICT (fromId, toId, relation) DO UPDATE SET toEntity = EXCLUDED.toEntity, fromEntity = EXCLUDED.fromEntity"
            : "INSERT INTO entity_relationship (fromId, toId, fromEntity, toEntity, relation) "
                + "VALUES (:fromId, :toId, :fromEntity, :toEntity, :relation) "
                + "ON DUPLICATE KEY UPDATE toEntity = VALUES(toEntity), fromEntity = VALUES(fromEntity)";
    try {
      handle
          .createUpdate(sql)
          .bind("fromId", fromId)
          .bind("toId", toId)
          .bind("fromEntity", fromEntity)
          .bind("toEntity", toEntity)
          .bind("relation", relation.ordinal())
          .execute();
    } catch (Exception e) {
      LOG.debug(
          "Could not insert entity_relationship {}->{} relation={}: {}",
          fromId,
          toId,
          relation,
          e.getMessage());
    }
  }

  private static void insertTaskUserListRelationships(
      Handle handle,
      String taskId,
      JsonNode users,
      Relationship relation,
      ConnectionType connectionType) {
    if (users == null || !users.isArray()) {
      return;
    }
    for (JsonNode u : users) {
      String id = u.path("id").asText(null);
      if (id == null || id.isEmpty()) {
        continue;
      }
      String type = u.path("type").asText("user");
      insertEntityRelationship(handle, id, type, taskId, Entity.TASK, relation, connectionType);
    }
  }

  private static void insertTaskLinkRelationships(
      Handle handle,
      String taskId,
      JsonNode assignees,
      JsonNode reviewers,
      JsonNode watchers,
      String createdByUserId,
      ObjectNode taskJson,
      ConnectionType connectionType) {
    insertTaskUserListRelationships(
        handle, taskId, assignees, Relationship.ASSIGNED_TO, connectionType);
    insertTaskUserListRelationships(
        handle, taskId, reviewers, Relationship.REVIEWS, connectionType);
    insertTaskUserListRelationships(handle, taskId, watchers, Relationship.FOLLOWS, connectionType);
    if (createdByUserId != null) {
      insertEntityRelationship(
          handle,
          createdByUserId,
          Entity.USER,
          taskId,
          Entity.TASK,
          Relationship.CREATED,
          connectionType);
    }
    JsonNode about = taskJson.get("about");
    if (about != null && about.has("id") && !about.get("id").isNull() && about.has("type")) {
      String aboutId = about.get("id").asText();
      String aboutType = about.get("type").asText();
      if (!aboutId.isEmpty() && !aboutType.isEmpty()) {
        insertEntityRelationship(
            handle,
            aboutId,
            aboutType,
            taskId,
            Entity.TASK,
            Relationship.MENTIONED_IN,
            connectionType);
      }
    }
  }

  /**
   * Insert DOMAIN --HAS--> task rows so {@code TaskRepository.getDomains()} returns
   * the inherited domains when the task is read. Idempotent via {@link #insertEntityRelationship}
   * (ON CONFLICT DO NOTHING / ON DUPLICATE KEY UPDATE) — re-runs no longer rely on a catch-all
   * exception handler to swallow duplicate-key violations, so genuine failures propagate.
   */
  private static void insertTaskDomainRelationships(
      Handle handle, String taskId, List<EntityReference> domains, ConnectionType connectionType) {
    if (domains == null || domains.isEmpty()) {
      return;
    }
    for (EntityReference domain : domains) {
      try {
        insertEntityRelationship(
            handle,
            domain.getId().toString(),
            Entity.DOMAIN,
            taskId,
            Entity.TASK,
            Relationship.HAS,
            connectionType);
      } catch (Exception e) {
        LOG.debug(
            "Could not insert domain relationship for task {} -> domain {}: {}",
            taskId,
            domain.getId(),
            e.getMessage());
      }
    }
  }

  /** Task workflow cutover + recognizer feedback rewrite + mention-alert wiring for 2.0.0. */
  public static class TaskWorkflow {
    private static final String ADMIN_USER_NAME = "admin";
    private static final String USER_APPROVAL_TASK_SUBTYPE = "userApprovalTask";
    private static final String RECOGNIZER_APPROVAL_TASK_SUBTYPE =
        "createRecognizerFeedbackApprovalTask";
    private static final String FEEDBACK_PAYLOAD_KEY = "feedback";
    private static final int BATCH_SIZE = 200;

    private static final String NOTIFICATION_ALERT_TYPE = "Notification";
    private static final String MENTION_FILTER_NAME = "filterByMentionedName";
    private static final String CONVERSATION_RESOURCE = "conversation";
    private static final String TASK_RESOURCE = "task";
    private static final String UPDATE_SUBSCRIPTION_MYSQL =
        "UPDATE event_subscription_entity SET json = :json WHERE id = :id";
    private static final String UPDATE_SUBSCRIPTION_POSTGRES =
        "UPDATE event_subscription_entity SET json = :json::jsonb WHERE id = :id";

    private final Handle handle;
    private final CollectionDAO collectionDAO;
    private final TaskRepository taskRepository;
    private final WorkflowDefinitionRepository workflowDefinitionRepository;
    private final WorkflowHandler workflowHandler;

    public TaskWorkflow(Handle handle) {
      this.handle = handle;
      this.collectionDAO = handle.attach(CollectionDAO.class);
      this.taskRepository = (TaskRepository) Entity.getEntityRepository(Entity.TASK);
      this.workflowDefinitionRepository =
          (WorkflowDefinitionRepository) Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION);
      this.workflowHandler = WorkflowHandler.getInstance();
    }

    public void runTaskWorkflowCutoverMigration() {
      int seededDefaults = ensureDefaultTaskWorkflows();
      int redeployedWorkflows = redeployUserApprovalWorkflows();
      MigrationStats stats = migrateLegacyThreadTasks();
      int rewrittenRecognizerFeedbackTasks = rewriteRecognizerFeedbackDataQualityReviewTasks();
      int backfilledOpenTasks = backfillOpenTasksToWorkflowInstances();

      LOG.info(
          "Completed task workflow cutover migration. seededDefaults={}, workflowsRedeployed={}, migrated={}, alreadyMigrated={}, skipped={}, failures={}, rewrittenRecognizerFeedbackTasks={}, backfilledOpenTasks={}",
          seededDefaults,
          redeployedWorkflows,
          stats.migrated,
          stats.alreadyMigrated,
          stats.skipped,
          stats.failed,
          rewrittenRecognizerFeedbackTasks,
          backfilledOpenTasks);
    }

    public void runRecognizerFeedbackTaskTypeMigration() {
      int seededDefaults = ensureDefaultTaskWorkflows();
      int rewrittenRecognizerFeedbackTasks = rewriteRecognizerFeedbackDataQualityReviewTasks();

      LOG.info(
          "Completed recognizer feedback task type migration. seededDefaults={}, rewrittenRecognizerFeedbackTasks={}",
          seededDefaults,
          rewrittenRecognizerFeedbackTasks);
    }

    private int ensureDefaultTaskWorkflows() {
      int seeded = 0;
      try {
        for (WorkflowDefinition workflowDefinition :
            workflowDefinitionRepository.getEntitiesFromSeedData()) {
          String workflowName = workflowDefinition.getName();
          if (!TaskWorkflowLifecycleResolver.defaultWorkflowDefinitionRefs()
              .contains(workflowName)) {
            continue;
          }

          WorkflowDefinition existingWorkflow =
              workflowDefinitionRepository.findByNameOrNull(workflowName, Include.NON_DELETED);
          if (existingWorkflow != null) {
            workflowDefinition.setId(existingWorkflow.getId());
            workflowDefinition.setVersion(existingWorkflow.getVersion());
          } else if (workflowDefinition.getId() == null) {
            workflowDefinition.setId(UUID.randomUUID());
          }

          workflowDefinition.setUpdatedBy(ADMIN_USER_NAME);
          workflowDefinition.setUpdatedAt(System.currentTimeMillis());
          workflowDefinitionRepository.createOrUpdate(null, workflowDefinition, ADMIN_USER_NAME);
          seeded++;
        }
      } catch (Exception e) {
        LOG.error("Failed to seed default task workflows during migration", e);
      }
      return seeded;
    }

    private int redeployUserApprovalWorkflows() {
      int redeployed = 0;
      try {
        List<WorkflowDefinition> workflowDefinitions =
            workflowDefinitionRepository.listAll(EntityUtil.Fields.EMPTY_FIELDS, new ListFilter());

        for (WorkflowDefinition workflowDefinition : workflowDefinitions) {
          if (!containsApprovalTaskNodeForCutover(workflowDefinition.getNodes())) {
            continue;
          }

          try {
            workflowDefinitionRepository.createOrUpdate(null, workflowDefinition, ADMIN_USER_NAME);
            redeployed++;
            LOG.info(
                "Redeployed workflow '{}' to activate Task V2 approval listeners",
                workflowDefinition.getName());
          } catch (Exception e) {
            LOG.warn(
                "Failed to redeploy workflow '{}': {}",
                workflowDefinition.getName(),
                e.getMessage());
          }
        }
      } catch (Exception e) {
        LOG.error("Failed to redeploy user approval workflows during migration", e);
      }
      return redeployed;
    }

    private boolean containsApprovalTaskNodeForCutover(
        List<WorkflowNodeDefinitionInterface> nodes) {
      for (WorkflowNodeDefinitionInterface node : listOrEmpty(nodes)) {
        if (USER_APPROVAL_TASK_SUBTYPE.equals(node.getSubType())
            || RECOGNIZER_APPROVAL_TASK_SUBTYPE.equals(node.getSubType())) {
          return true;
        }
      }
      return false;
    }

    private MigrationStats migrateLegacyThreadTasks() {
      MigrationStats stats = new MigrationStats();
      int offset = 0;
      String legacyThreadTable = getLegacyThreadSourceTable();

      if (legacyThreadTable == null) {
        LOG.info("No legacy thread task table found, skipping task workflow cutover migration");
        return stats;
      }

      while (true) {
        List<String> threadBatch = listTaskThreadWithOffset(legacyThreadTable, BATCH_SIZE, offset);
        if (threadBatch.isEmpty()) {
          break;
        }

        for (String threadJson : threadBatch) {
          try {
            Thread legacyThread = JsonUtils.readValue(threadJson, Thread.class);
            migrateLegacyThreadTask(legacyThread, stats);
          } catch (Exception e) {
            stats.failed++;
            LOG.warn("Failed to parse/migrate legacy thread task JSON: {}", e.getMessage());
          }
        }

        offset += threadBatch.size();
        if (threadBatch.size() < BATCH_SIZE) {
          break;
        }
      }

      return stats;
    }

    private int backfillOpenTasksToWorkflowInstances() {
      int backfilled = 0;
      try {
        ListFilter filter = new ListFilter(Include.NON_DELETED);
        filter.addQueryParam("taskStatusGroup", "open");
        List<Task> openTasks =
            listOrEmpty(taskRepository.listAll(taskRepository.getFields("about,payload"), filter));
        for (Task task : openTasks) {
          if (task.getWorkflowInstanceId() != null || task.getAbout() == null) {
            continue;
          }

          var workflowBinding =
              TaskWorkflowLifecycleResolver.resolveBinding(
                  task.getType(), task.getCategory(), task.getPayload());
          if (workflowBinding.isEmpty()) {
            continue;
          }

          WorkflowDefinition workflowDefinition =
              workflowDefinitionRepository.findByNameOrNull(
                  workflowBinding.get().workflowDefinitionRef(), Include.NON_DELETED);
          if (workflowDefinition == null) {
            continue;
          }

          Map<String, Object> variables = new LinkedHashMap<>();
          variables.putAll(TaskWorkflowLifecycleResolver.buildWorkflowStartVariables(task));
          variables.put(
              getNamespacedVariableName(GLOBAL_NAMESPACE, RELATED_ENTITY_VARIABLE),
              EntityUtil.buildEntityLink(
                  task.getAbout().getType(), task.getAbout().getFullyQualifiedName()));
          variables.put(
              getNamespacedVariableName(GLOBAL_NAMESPACE, UPDATED_BY_VARIABLE),
              task.getUpdatedBy());
          variables.put("workflowDefinitionId", workflowDefinition.getId().toString());
          if (workflowBinding.get().schema() != null
              && workflowBinding.get().schema().getId() != null) {
            variables.put("taskFormSchemaId", workflowBinding.get().schema().getId().toString());
            variables.put("taskFormSchemaVersion", workflowBinding.get().schema().getVersion());
          }

          workflowHandler.triggerByKey(
              getTriggerWorkflowId(workflowDefinition.getFullyQualifiedName()),
              task.getId().toString(),
              variables);
          backfilled++;
        }
      } catch (Exception e) {
        LOG.error("Failed to backfill open tasks to workflow instances", e);
      }
      return backfilled;
    }

    private int rewriteRecognizerFeedbackDataQualityReviewTasks() {
      int rewritten = 0;
      try {
        ListFilter filter = new ListFilter(Include.NON_DELETED);
        filter.addQueryParam("taskStatusGroup", "open");
        filter.addQueryParam("taskType", TaskEntityType.DataQualityReview.value());

        List<Task> openDataQualityReviewTasks =
            listOrEmpty(taskRepository.listAll(taskRepository.getFields("about,payload"), filter));
        for (Task task : openDataQualityReviewTasks) {
          if (task == null
              || task.getId() == null
              || !isRecognizerFeedbackDataQualityReviewTask(task)) {
            continue;
          }

          TaskEntityType previousType = task.getType();
          TaskCategory previousCategory = task.getCategory();
          try {
            task.setType(TaskEntityType.RecognizerFeedbackApproval);
            task.setCategory(TaskCategory.Review);
            collectionDAO.taskDAO().updateTask(task.getId().toString(), JsonUtils.pojoToJson(task));
            rewritten++;
          } catch (Exception e) {
            task.setType(previousType);
            task.setCategory(previousCategory);
            LOG.error("Failed to rewrite recognizer feedback task '{}'", task.getId(), e);
          }
        }
      } catch (Exception e) {
        LOG.error("Failed to list recognizer feedback review tasks for type rewrite", e);
      }
      return rewritten;
    }

    private boolean isRecognizerFeedbackDataQualityReviewTask(Task task) {
      if (task == null || task.getType() != TaskEntityType.DataQualityReview) {
        return false;
      }

      try {
        Map<String, Object> payload = JsonUtils.readOrConvertValue(task.getPayload(), Map.class);
        if (payload == null || !payload.containsKey(FEEDBACK_PAYLOAD_KEY)) {
          return false;
        }

        RecognizerFeedback feedback =
            JsonUtils.convertValue(payload.get(FEEDBACK_PAYLOAD_KEY), RecognizerFeedback.class);
        return feedback != null
            && !nullOrEmpty(feedback.getTagFQN())
            && !nullOrEmpty(feedback.getEntityLink());
      } catch (Exception e) {
        LOG.debug(
            "Unable to inspect task '{}' payload for recognizer feedback keys", task.getId(), e);
        return false;
      }
    }

    private List<String> listTaskThreadWithOffset(String tableName, int limit, int offset) {
      return handle
          .createQuery(
              String.format(
                  "SELECT json FROM %s WHERE type = 'Task' ORDER BY createdAt ASC LIMIT :limit OFFSET :offset",
                  tableName))
          .bind("limit", limit)
          .bind("offset", offset)
          .mapTo(String.class)
          .list();
    }

    private void migrateLegacyThreadTask(Thread legacyThread, MigrationStats stats) {
      if (legacyThread == null || legacyThread.getId() == null || legacyThread.getTask() == null) {
        stats.skipped++;
        return;
      }

      UUID legacyThreadId = legacyThread.getId();

      if (isAlreadyMigrated(legacyThreadId)) {
        stats.alreadyMigrated++;
        upsertTaskMigrationMapping(legacyThreadId, legacyThreadId);
        return;
      }

      try {
        Task migratedTask = buildTaskFromLegacyThread(legacyThread);
        Task createdTask = taskRepository.create(null, migratedTask);
        upsertTaskMigrationMapping(legacyThreadId, createdTask.getId());
        stats.migrated++;
      } catch (Exception e) {
        stats.failed++;
        LOG.warn("Failed to migrate legacy thread task '{}': {}", legacyThreadId, e.getMessage());
      }
    }

    private boolean isAlreadyMigrated(UUID legacyThreadId) {
      try {
        return taskRepository.find(legacyThreadId, Include.ALL) != null;
      } catch (Exception e) {
        return false;
      }
    }

    private Task buildTaskFromLegacyThread(Thread legacyThread) {
      TaskDetails legacyTaskDetails = legacyThread.getTask();
      TypeAndCategory typeAndCategory = mapLegacyTaskType(legacyTaskDetails.getType());

      EntityReference createdByRef = resolveUserReference(legacyThread.getCreatedBy());
      EntityReference aboutRef = resolveAboutReference(legacyThread);

      long createdAt =
          legacyThread.getThreadTs() != null
              ? legacyThread.getThreadTs()
              : System.currentTimeMillis();
      long updatedAt =
          legacyThread.getUpdatedAt() != null ? legacyThread.getUpdatedAt() : createdAt;

      TaskEntityStatus status = mapLegacyStatus(legacyTaskDetails.getStatus());

      Task task =
          new Task()
              .withId(legacyThread.getId())
              .withCategory(typeAndCategory.category)
              .withType(typeAndCategory.type)
              .withStatus(status)
              .withPriority(TaskPriority.Medium)
              .withDescription(resolveDescription(legacyThread, typeAndCategory.type))
              .withAbout(aboutRef)
              .withAssignees(legacyTaskDetails.getAssignees())
              .withCreatedBy(createdByRef)
              .withCreatedAt(createdAt)
              .withUpdatedAt(updatedAt)
              .withUpdatedBy(resolveUpdatedBy(legacyThread, createdByRef))
              .withPayload(buildLegacyPayload(legacyTaskDetails));

      List<TaskComment> comments =
          convertPostsToComments(legacyThread.getPosts(), createdByRef, updatedAt);
      task.withComments(comments).withCommentCount(comments.size());

      UUID runtimeWorkflowInstanceId =
          workflowHandler.getRuntimeWorkflowInstanceId(legacyThread.getId());
      if (runtimeWorkflowInstanceId != null) {
        task.setWorkflowInstanceId(runtimeWorkflowInstanceId);
      }

      if (status != TaskEntityStatus.Open) {
        task.setResolution(buildLegacyResolution(legacyThread, createdByRef));
      }

      return task;
    }

    private TypeAndCategory mapLegacyTaskType(TaskType legacyTaskType) {
      if (legacyTaskType == null) {
        return new TypeAndCategory(TaskEntityType.CustomTask, TaskCategory.Custom);
      }

      return switch (legacyTaskType) {
        case RequestApproval -> new TypeAndCategory(
            TaskEntityType.GlossaryApproval, TaskCategory.Approval);
        case RecognizerFeedbackApproval -> new TypeAndCategory(
            TaskEntityType.RecognizerFeedbackApproval, TaskCategory.Review);
        case RequestDescription, UpdateDescription -> new TypeAndCategory(
            TaskEntityType.DescriptionUpdate, TaskCategory.MetadataUpdate);
        case RequestTag, UpdateTag -> new TypeAndCategory(
            TaskEntityType.TagUpdate, TaskCategory.MetadataUpdate);
        case RequestTestCaseFailureResolution -> new TypeAndCategory(
            TaskEntityType.TestCaseResolution, TaskCategory.Incident);
        case Generic -> new TypeAndCategory(TaskEntityType.CustomTask, TaskCategory.Custom);
      };
    }

    private TaskEntityStatus mapLegacyStatus(TaskStatus legacyStatus) {
      if (legacyStatus == null || legacyStatus == TaskStatus.Open) {
        return TaskEntityStatus.Open;
      }
      return TaskEntityStatus.Completed;
    }

    private TaskResolution buildLegacyResolution(
        Thread legacyThread, EntityReference fallbackUserRef) {
      TaskDetails legacyTask = legacyThread.getTask();
      TaskResolutionType resolutionType = mapLegacyResolutionType(legacyTask);

      EntityReference resolvedBy = resolveUserReference(legacyTask.getClosedBy());
      if (resolvedBy == null) {
        resolvedBy = fallbackUserRef;
      }

      Long resolvedAt = legacyTask.getClosedAt();
      if (resolvedAt == null) {
        resolvedAt = legacyThread.getUpdatedAt();
      }
      if (resolvedAt == null) {
        resolvedAt = System.currentTimeMillis();
      }

      return new TaskResolution()
          .withType(resolutionType)
          .withResolvedBy(resolvedBy)
          .withResolvedAt(resolvedAt)
          .withComment("Migrated from legacy thread task")
          .withNewValue(legacyTask.getNewValue());
    }

    private TaskResolutionType mapLegacyResolutionType(TaskDetails legacyTask) {
      if (legacyTask == null) {
        return TaskResolutionType.Completed;
      }

      TaskType taskType = legacyTask.getType();
      if (taskType == TaskType.RequestApproval || taskType == TaskType.RecognizerFeedbackApproval) {
        return nullOrEmpty(legacyTask.getNewValue())
            ? TaskResolutionType.Rejected
            : TaskResolutionType.Approved;
      }
      return TaskResolutionType.Completed;
    }

    private String resolveDescription(Thread legacyThread, TaskEntityType taskType) {
      if (!nullOrEmpty(legacyThread.getMessage())) {
        return legacyThread.getMessage();
      }
      return String.format("Migrated legacy task (%s)", taskType.value());
    }

    private String resolveUpdatedBy(Thread legacyThread, EntityReference createdByRef) {
      if (!nullOrEmpty(legacyThread.getUpdatedBy())) {
        return legacyThread.getUpdatedBy();
      }
      return createdByRef != null ? createdByRef.getName() : ADMIN_USER_NAME;
    }

    private Object buildLegacyPayload(TaskDetails legacyTask) {
      if (legacyTask == null) {
        return null;
      }

      Map<String, Object> payload = new LinkedHashMap<>();

      if (!nullOrEmpty(legacyTask.getOldValue())) {
        payload.put("oldValue", legacyTask.getOldValue());
      }
      if (!nullOrEmpty(legacyTask.getSuggestion())) {
        payload.put("suggestion", legacyTask.getSuggestion());
      }
      if (!nullOrEmpty(legacyTask.getNewValue())) {
        payload.put("newValue", legacyTask.getNewValue());
      }
      if (legacyTask.getTestCaseResolutionStatusId() != null) {
        payload.put("testCaseResolutionStatusId", legacyTask.getTestCaseResolutionStatusId());
      }
      if (legacyTask.getFeedback() != null) {
        payload.put("feedback", legacyTask.getFeedback());
      }
      if (legacyTask.getRecognizer() != null) {
        payload.put("recognizer", legacyTask.getRecognizer());
      }

      return payload.isEmpty() ? null : payload;
    }

    private List<TaskComment> convertPostsToComments(
        List<Post> posts, EntityReference fallbackUserRef, long fallbackTimestamp) {
      List<TaskComment> comments = new ArrayList<>();

      for (Post post : listOrEmpty(posts)) {
        if (post == null || nullOrEmpty(post.getMessage())) {
          continue;
        }

        EntityReference author = resolveUserReference(post.getFrom());
        if (author == null) {
          author = fallbackUserRef;
        }
        if (author == null) {
          continue;
        }

        long createdAt = post.getPostTs() != null ? post.getPostTs() : fallbackTimestamp;

        TaskComment comment =
            new TaskComment()
                .withId(post.getId() != null ? post.getId() : UUID.randomUUID())
                .withMessage(post.getMessage())
                .withAuthor(author)
                .withCreatedAt(createdAt)
                .withReactions(post.getReactions());
        comments.add(comment);
      }

      return comments;
    }

    private EntityReference resolveAboutReference(Thread legacyThread) {
      if (legacyThread.getEntityRef() != null && legacyThread.getEntityRef().getId() != null) {
        return legacyThread.getEntityRef();
      }

      if (nullOrEmpty(legacyThread.getAbout())) {
        return null;
      }

      try {
        MessageParser.EntityLink entityLink =
            MessageParser.EntityLink.parse(legacyThread.getAbout());
        return Entity.getEntityReferenceByName(
            entityLink.getEntityType(), entityLink.getEntityFQN(), Include.ALL);
      } catch (Exception e) {
        LOG.debug(
            "Unable to resolve about reference for legacy thread '{}' from '{}': {}",
            legacyThread.getId(),
            legacyThread.getAbout(),
            e.getMessage());
        return null;
      }
    }

    private EntityReference resolveUserReference(String userName) {
      if (nullOrEmpty(userName)) {
        return getAdminReference();
      }

      try {
        return Entity.getEntityReferenceByName(Entity.USER, userName, Include.ALL);
      } catch (Exception e) {
        LOG.debug("Unable to resolve user '{}': {}", userName, e.getMessage());
        return getAdminReference();
      }
    }

    private EntityReference getAdminReference() {
      return Entity.getEntityReferenceByName(Entity.USER, ADMIN_USER_NAME, Include.ALL);
    }

    private void upsertTaskMigrationMapping(UUID oldThreadId, UUID newTaskId) {
      long migratedAt = System.currentTimeMillis();

      handle
          .createUpdate("DELETE FROM task_migration_mapping WHERE old_thread_id = :oldThreadId")
          .bind("oldThreadId", oldThreadId.toString())
          .execute();

      handle
          .createUpdate(
              "INSERT INTO task_migration_mapping(old_thread_id, new_task_id, migrated_at, source) "
                  + "VALUES (:oldThreadId, :newTaskId, :migratedAt, :source)")
          .bind("oldThreadId", oldThreadId.toString())
          .bind("newTaskId", newTaskId.toString())
          .bind("migratedAt", migratedAt)
          .bind("source", "thread_task_migration")
          .execute();
    }

    private boolean tableExists(String tableName) {
      try (ResultSet tables =
          handle
              .getConnection()
              .getMetaData()
              .getTables(null, null, tableName, new String[] {"TABLE"})) {
        while (tables.next()) {
          if (tableName.equalsIgnoreCase(tables.getString("TABLE_NAME"))) {
            return true;
          }
        }
        return false;
      } catch (Exception e) {
        return false;
      }
    }

    private String getLegacyThreadSourceTable() {
      if (tableExists("thread_entity_legacy")) {
        return "thread_entity_legacy";
      }
      if (tableExists("thread_entity_archived")) {
        return "thread_entity_archived";
      }
      return null;
    }

    /**
     * Incidents moved from conversation threads to Task entities in the task redesign. Add the
     * "task" resource to existing mention-based Notification alerts so they keep notifying
     * mentioned users on incident/task activity, alongside conversations.
     */
    public void addTaskResourceToMentionAlerts() {
      LOG.info("Adding '{}' resource to mention-based notification alerts", TASK_RESOURCE);
      List<Map<String, Object>> rows =
          handle.createQuery("SELECT id, json FROM event_subscription_entity").mapToMap().list();
      int updated = 0;

      for (Map<String, Object> row : rows) {
        String id = row.get("id").toString();
        try {
          ObjectNode root = (ObjectNode) JsonUtils.readTree(row.get("json").toString());
          ArrayNode resources = mentionAlertResourcesToUpdate(root);
          if (resources == null) {
            continue;
          }
          resources.add(TASK_RESOURCE);
          String updateSql =
              Boolean.TRUE.equals(DatasourceConfig.getInstance().isMySQL())
                  ? UPDATE_SUBSCRIPTION_MYSQL
                  : UPDATE_SUBSCRIPTION_POSTGRES;
          handle.createUpdate(updateSql).bind("json", root.toString()).bind("id", id).execute();
          updated++;
        } catch (Exception e) {
          LOG.warn("Failed to add task resource to event subscription {}", id, e);
        }
      }
      LOG.info(
          "Added '{}' resource to {} mention-based notification alerts", TASK_RESOURCE, updated);
    }

    private ArrayNode mentionAlertResourcesToUpdate(ObjectNode root) {
      JsonNode alertType = root.get("alertType");
      if (alertType == null || !NOTIFICATION_ALERT_TYPE.equals(alertType.asText())) {
        return null;
      }
      JsonNode filteringRules = root.get("filteringRules");
      if (filteringRules == null
          || !(filteringRules.get("resources") instanceof ArrayNode resources)) {
        return null;
      }
      boolean isMentionConversationAlert =
          jsonArrayContains(resources, CONVERSATION_RESOURCE)
              && !jsonArrayContains(resources, TASK_RESOURCE)
              && hasMentionFilter(filteringRules.get("rules"));
      return isMentionConversationAlert ? resources : null;
    }

    private boolean hasMentionFilter(JsonNode rules) {
      if (!(rules instanceof ArrayNode ruleArray)) {
        return false;
      }
      for (JsonNode rule : ruleArray) {
        JsonNode name = rule.get("name");
        if (name != null && MENTION_FILTER_NAME.equals(name.asText())) {
          return true;
        }
      }
      return false;
    }

    private boolean jsonArrayContains(ArrayNode array, String value) {
      for (JsonNode node : array) {
        if (value.equals(node.asText())) {
          return true;
        }
      }
      return false;
    }

    private static class TypeAndCategory {
      private final TaskEntityType type;
      private final TaskCategory category;

      private TypeAndCategory(TaskEntityType type, TaskCategory category) {
        this.type = type;
        this.category = category;
      }
    }

    private static class MigrationStats {
      private int migrated;
      private int alreadyMigrated;
      private int skipped;
      private int failed;
    }
  }
}
