package org.openmetadata.service.migration.utils.v200;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
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
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.type.ActivityEventType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.AnnouncementRepository;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.PolicyRepository;
import org.openmetadata.service.jdbi3.RoleRepository;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.resources.feeds.MessageParser;
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
}
