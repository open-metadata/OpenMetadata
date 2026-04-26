package org.openmetadata.service.migration.utils.v200;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.entity.activity.ActivityEvent;
import org.openmetadata.schema.entity.feed.Announcement;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.type.ActivityEventType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.AnnouncementRepository;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.migration.utils.SearchSettingsMergeUtil;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
public class MigrationUtil {

  private static final String TABLE_COLUMN_ASSET_TYPE = "tableColumn";

  private MigrationUtil() {}

  public static void addTableColumnSearchSettings() {
    try {
      LOG.info("Adding tableColumn search settings configuration for column search support");

      Settings searchSettings = SearchSettingsMergeUtil.getSearchSettingsFromDatabase();

      if (searchSettings == null) {
        LOG.warn(
            "Search settings not found in database. "
                + "Default settings will be loaded on next startup which includes tableColumn.");
        return;
      }

      SearchSettings currentSettings = SearchSettingsMergeUtil.loadSearchSettings(searchSettings);
      SearchSettings defaultSettings = SearchSettingsMergeUtil.loadSearchSettingsFromFile();

      if (defaultSettings == null) {
        LOG.error("Failed to load default search settings from file, skipping migration");
        return;
      }

      boolean assetTypeAdded =
          SearchSettingsMergeUtil.addMissingAssetTypeConfiguration(
              currentSettings, defaultSettings, TABLE_COLUMN_ASSET_TYPE);

      boolean allowedFieldsAdded =
          SearchSettingsMergeUtil.addMissingAllowedFields(
              currentSettings, defaultSettings, TABLE_COLUMN_ASSET_TYPE);

      if (assetTypeAdded || allowedFieldsAdded) {
        SearchSettingsMergeUtil.saveSearchSettings(searchSettings, currentSettings);
        LOG.info(
            "Successfully added tableColumn search settings: "
                + "assetTypeConfiguration={}, allowedFields={}",
            assetTypeAdded,
            allowedFieldsAdded);
      } else {
        LOG.info("tableColumn search settings already exist, no updates needed");
      }

    } catch (Exception e) {
      LOG.error("Error adding tableColumn search settings", e);
      throw new RuntimeException("Failed to add tableColumn search settings", e);
    }
  }

  /**
   * Migrate suggestions from the old suggestions table to the new task_entity table. Each
   * suggestion becomes a Task with type=Suggestion and category=MetadataUpdate. The about
   * EntityReference and aboutFqnHash are properly computed from the entityLink.
   */
  public static void migrateSuggestionsToTaskEntity(Handle handle) {
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

        if (taskExists(handle, suggestionId)) {
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
        List<EntityReference> inheritedDomains = resolveDomainsForTaskAbout(handle, taskJson);
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

        insertTask(handle, suggestionId, taskJson.toString(), fqnHash);
        insertTaskDomainRelationships(handle, suggestionId, inheritedDomains);
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
  public static void migrateThreadTasksToTaskEntity(Handle handle) {
    LOG.info("Starting migration of thread-based tasks to task_entity");

    List<Map<String, Object>> threads =
        handle
            .createQuery(
                "SELECT json FROM thread_entity WHERE type = 'Task' ORDER BY createdAt ASC")
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

        if (taskExists(handle, threadId)) {
          skipped++;
          continue;
        }

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
        List<EntityReference> inheritedDomains = resolveDomainsForTaskAbout(handle, taskJson);
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

        insertTask(handle, threadId, taskJson.toString(), fqnHash);
        insertTaskDomainRelationships(handle, threadId, inheritedDomains);
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
  public static void migrateLegacyActivityThreadsToActivityStream(Handle handle) {
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

        insertActivityEvent(handle, event);
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
      case "RecognizerFeedbackApproval" -> "DataQualityReview";
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
          .one();
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

  private static void insertActivityEvent(Handle handle, ActivityEvent event) {
    String entityFqnHash =
        event.getEntity().getFullyQualifiedName() != null
            ? FullyQualifiedName.buildHash(event.getEntity().getFullyQualifiedName())
            : null;
    String aboutFqnHash =
        event.getAbout() != null ? FullyQualifiedName.buildHash(event.getAbout()) : null;
    String domains =
        event.getDomains() == null || event.getDomains().isEmpty()
            ? null
            : JsonUtils.pojoToJson(
                event.getDomains().stream().map(domain -> domain.getId().toString()).toList());

    handle
        .createUpdate(
            "INSERT INTO activity_stream "
                + "(id, eventType, entityType, entityId, entityFqnHash, about, aboutFqnHash, "
                + "actorId, actorName, timestamp, summary, fieldName, oldValue, newValue, domains, json) "
                + "VALUES (:id, :eventType, :entityType, :entityId, :entityFqnHash, :about, "
                + ":aboutFqnHash, :actorId, :actorName, :timestamp, :summary, :fieldName, "
                + ":oldValue, :newValue, :domains, :json)")
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

  private static void insertTask(Handle handle, String id, String json, String fqnHash) {
    handle
        .createUpdate("INSERT INTO task_entity (id, json, fqnHash) VALUES (:id, :json, :fqnHash)")
        .bind("id", id)
        .bind("json", json)
        .bind("fqnHash", fqnHash)
        .execute();
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
   * Equivalent to {@code TaskRepository.inheritDomainsFromTargetEntity()} but using raw SQL,
   * since migrations run before the EntityRepository layer is fully initialized for new tasks.
   */
  private static List<EntityReference> resolveDomainsForTaskAbout(
      Handle handle, ObjectNode taskJson) {
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

    return queryDomainsForEntity(handle, entityId, entityType);
  }

  /**
   * Query the entity_relationship table for any DOMAIN --HAS--> entity rows
   * and join with domain_entity to build EntityReferences.
   */
  private static List<EntityReference> queryDomainsForEntity(
      Handle handle, String entityId, String entityType) {
    try {
      List<Map<String, Object>> rows =
          handle
              .createQuery(
                  "SELECT d.json AS domainJson FROM entity_relationship er "
                      + "JOIN domain_entity d ON d.id = er.fromId "
                      + "WHERE er.toId = :entityId "
                      + "AND er.toEntity = :entityType "
                      + "AND er.fromEntity = :domainEntity "
                      + "AND er.relation = :hasRelation")
              .bind("entityId", entityId)
              .bind("entityType", entityType)
              .bind("domainEntity", Entity.DOMAIN)
              .bind("hasRelation", Relationship.HAS.ordinal())
              .mapToMap()
              .list();

      List<EntityReference> domains = new ArrayList<>();
      for (Map<String, Object> row : rows) {
        EntityReference domainRef = buildDomainReference(row.get("domainJson"));
        if (domainRef != null) {
          domains.add(domainRef);
        }
      }
      return domains;
    } catch (Exception e) {
      LOG.debug(
          "Could not resolve domains for entity {}/{}: {}", entityType, entityId, e.getMessage());
      return Collections.emptyList();
    }
  }

  private static EntityReference buildDomainReference(Object domainJsonObject) {
    if (domainJsonObject == null) {
      return null;
    }
    try {
      JsonNode domainJson = JsonUtils.readTree(domainJsonObject.toString());
      if (!domainJson.has("id")) {
        return null;
      }
      EntityReference ref =
          new EntityReference()
              .withId(UUID.fromString(domainJson.get("id").asText()))
              .withType(Entity.DOMAIN);
      if (domainJson.has("name") && !domainJson.get("name").isNull()) {
        ref.setName(domainJson.get("name").asText());
      }
      if (domainJson.has("fullyQualifiedName") && !domainJson.get("fullyQualifiedName").isNull()) {
        ref.setFullyQualifiedName(domainJson.get("fullyQualifiedName").asText());
      }
      if (domainJson.has("displayName") && !domainJson.get("displayName").isNull()) {
        ref.setDisplayName(domainJson.get("displayName").asText());
      }
      if (domainJson.has("description") && !domainJson.get("description").isNull()) {
        ref.setDescription(domainJson.get("description").asText());
      }
      return ref;
    } catch (Exception e) {
      LOG.debug("Could not parse domain JSON: {}", e.getMessage());
      return null;
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

  /**
   * Insert DOMAIN --HAS--> task rows so {@code TaskRepository.getDomains()} returns
   * the inherited domains when the task is read.
   */
  private static void insertTaskDomainRelationships(
      Handle handle, String taskId, List<EntityReference> domains) {
    if (domains == null || domains.isEmpty()) {
      return;
    }
    for (EntityReference domain : domains) {
      try {
        handle
            .createUpdate(
                "INSERT INTO entity_relationship "
                    + "(fromId, toId, fromEntity, toEntity, relation) "
                    + "VALUES (:fromId, :toId, :fromEntity, :toEntity, :relation)")
            .bind("fromId", domain.getId().toString())
            .bind("toId", taskId)
            .bind("fromEntity", Entity.DOMAIN)
            .bind("toEntity", Entity.TASK)
            .bind("relation", Relationship.HAS.ordinal())
            .execute();
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
