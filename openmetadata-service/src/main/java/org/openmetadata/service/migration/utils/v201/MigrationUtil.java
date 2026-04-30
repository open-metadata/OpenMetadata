package org.openmetadata.service.migration.utils.v201;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.governance.workflows.Workflow.GLOBAL_NAMESPACE;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.UPDATED_BY_VARIABLE;
import static org.openmetadata.service.governance.workflows.WorkflowVariableHandler.getNamespacedVariableName;
import static org.openmetadata.service.governance.workflows.elements.TriggerFactory.getTriggerWorkflowId;

import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.governance.workflows.elements.WorkflowNodeDefinitionInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Post;
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
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.TaskRepository;
import org.openmetadata.service.jdbi3.WorkflowDefinitionRepository;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.tasks.TaskWorkflowLifecycleResolver;
import org.openmetadata.service.util.EntityUtil;

/** Migration utility for 2.0.1 task workflow cutover. */
@Slf4j
public class MigrationUtil {
  private static final String ADMIN_USER_NAME = "admin";
  private static final String USER_APPROVAL_TASK_SUBTYPE = "userApprovalTask";
  private static final String RECOGNIZER_APPROVAL_TASK_SUBTYPE =
      "createRecognizerFeedbackApprovalTask";
  private static final int BATCH_SIZE = 200;

  private final Handle handle;
  private final CollectionDAO collectionDAO;
  private final TaskRepository taskRepository;
  private final WorkflowDefinitionRepository workflowDefinitionRepository;
  private final WorkflowHandler workflowHandler;

  public MigrationUtil(Handle handle) {
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
    int backfilledOpenTasks = backfillOpenTasksToWorkflowInstances();

    LOG.info(
        "Completed task workflow cutover migration. seededDefaults={}, workflowsRedeployed={}, migrated={}, alreadyMigrated={}, skipped={}, failures={}, backfilledOpenTasks={}",
        seededDefaults,
        redeployedWorkflows,
        stats.migrated,
        stats.alreadyMigrated,
        stats.skipped,
        stats.failed,
        backfilledOpenTasks);
  }

  private int ensureDefaultTaskWorkflows() {
    int seeded = 0;
    try {
      for (WorkflowDefinition workflowDefinition :
          workflowDefinitionRepository.getEntitiesFromSeedData()) {
        String workflowName = workflowDefinition.getName();
        if (!TaskWorkflowLifecycleResolver.defaultWorkflowDefinitionRefs().contains(workflowName)) {
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
              "Failed to redeploy workflow '{}': {}", workflowDefinition.getName(), e.getMessage());
        }
      }
    } catch (Exception e) {
      LOG.error("Failed to redeploy user approval workflows during migration", e);
    }
    return redeployed;
  }

  private boolean containsApprovalTaskNodeForCutover(List<WorkflowNodeDefinitionInterface> nodes) {
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
          taskRepository.listAll(taskRepository.getFields("about,payload"), filter);
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
            getNamespacedVariableName(GLOBAL_NAMESPACE, UPDATED_BY_VARIABLE), task.getUpdatedBy());
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
    long updatedAt = legacyThread.getUpdatedAt() != null ? legacyThread.getUpdatedAt() : createdAt;

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
          TaskEntityType.DataQualityReview, TaskCategory.Review);
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
      MessageParser.EntityLink entityLink = MessageParser.EntityLink.parse(legacyThread.getAbout());
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
