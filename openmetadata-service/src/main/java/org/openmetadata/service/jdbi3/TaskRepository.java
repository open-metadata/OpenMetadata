/*
 *  Copyright 2024 Collate
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

package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.Include.NON_DELETED;
import static org.openmetadata.service.Entity.DOMAIN;
import static org.openmetadata.service.Entity.FIELD_DOMAINS;
import static org.openmetadata.service.Entity.USER;
import static org.openmetadata.service.governance.workflows.Workflow.GLOBAL_NAMESPACE;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.UPDATED_BY_VARIABLE;
import static org.openmetadata.service.governance.workflows.WorkflowVariableHandler.getNamespacedVariableName;
import static org.openmetadata.service.governance.workflows.elements.TriggerFactory.getTriggerWorkflowId;
import static org.openmetadata.service.jdbi3.UserRepository.TEAMS_FIELD;

import jakarta.json.JsonPatch;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.SuggestionPayload;
import org.openmetadata.schema.type.TaskCategory;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.type.TaskPriority;
import org.openmetadata.schema.type.TaskResolution;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.lifecycle.handlers.IncidentTcrsSyncHandler;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;
import org.openmetadata.service.security.AuthRequest;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.AuthorizationLogic;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;
import org.openmetadata.service.security.policyevaluator.TestCaseResourceContext;
import org.openmetadata.service.tasks.TaskFieldValidator;
import org.openmetadata.service.tasks.TaskFormExecutionResolver;
import org.openmetadata.service.tasks.TaskIdGenerator;
import org.openmetadata.service.tasks.TaskWorkflowHandler;
import org.openmetadata.service.tasks.TaskWorkflowLifecycleResolver;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.WebsocketNotificationHandler;

@Slf4j
@Repository
public class TaskRepository extends EntityRepository<Task> {

  public static final String COLLECTION_PATH = "/v1/tasks";
  private static final String NO_MATCH_DOMAIN_ID = "'00000000-0000-0000-0000-000000000000'";
  public static final String FIELD_ASSIGNEES = "assignees";
  public static final String FIELD_REVIEWERS = "reviewers";
  public static final String FIELD_WATCHERS = "watchers";
  public static final String FIELD_ABOUT = "about";
  public static final String FIELD_COMMENTS = "comments";
  public static final String FIELD_RESOLUTION = "resolution";
  public static final String FIELD_CREATED_BY = "createdBy";
  public static final String FIELD_PAYLOAD = "payload";

  public static final List<TaskEntityStatus> OPEN_TASK_STATUSES =
      List.of(TaskEntityStatus.Open, TaskEntityStatus.InProgress, TaskEntityStatus.Pending);

  public TaskRepository() {
    super(
        COLLECTION_PATH,
        Entity.TASK,
        Task.class,
        Entity.getCollectionDAO().taskDAO(),
        "assignees,reviewers,watchers,about,createdBy",
        "assignees,reviewers,watchers,about,createdBy");
    supportsSearch = true;
    quoteFqn = false;
    this.allowedFields.add(FIELD_ASSIGNEES);
    this.allowedFields.add(FIELD_REVIEWERS);
    this.allowedFields.add(FIELD_WATCHERS);
    this.allowedFields.add(FIELD_ABOUT);
    this.allowedFields.add(FIELD_COMMENTS);
    this.allowedFields.add(FIELD_RESOLUTION);
    this.allowedFields.add(FIELD_DOMAINS);
    this.allowedFields.add(FIELD_CREATED_BY);
    this.allowedFields.add(FIELD_PAYLOAD);
  }

  public TaskRepository(Jdbi jdbi) {
    super(
        COLLECTION_PATH,
        Entity.TASK,
        Task.class,
        initializeTaskDao(jdbi),
        "assignees,reviewers,watchers,about,createdBy",
        "assignees,reviewers,watchers,about,createdBy");
    supportsSearch = true;
    quoteFqn = false;
    this.allowedFields.add(FIELD_ASSIGNEES);
    this.allowedFields.add(FIELD_REVIEWERS);
    this.allowedFields.add(FIELD_WATCHERS);
    this.allowedFields.add(FIELD_ABOUT);
    this.allowedFields.add(FIELD_COMMENTS);
    this.allowedFields.add(FIELD_RESOLUTION);
    this.allowedFields.add(FIELD_DOMAINS);
    this.allowedFields.add(FIELD_CREATED_BY);
    this.allowedFields.add(FIELD_PAYLOAD);
  }

  @Override
  public ResultList<Task> listAfter(
      UriInfo uriInfo, Fields fields, ListFilter filter, int limitParam, String after) {
    applyTaskDomainFilter(filter);
    return super.listAfter(uriInfo, fields, filter, limitParam, after);
  }

  @Override
  public ResultList<Task> listBefore(
      UriInfo uriInfo, Fields fields, ListFilter filter, int limitParam, String before) {
    applyTaskDomainFilter(filter);
    return super.listBefore(uriInfo, fields, filter, limitParam, before);
  }

  public void addDomainFilter(ListFilter filter, String domainFilter) {
    if (nullOrEmpty(domainFilter)) {
      return;
    }

    List<EntityReference> domains =
        Arrays.stream(domainFilter.split(","))
            .map(String::trim)
            .filter(s -> !s.isEmpty())
            .map(domain -> Entity.getEntityReferenceByName(DOMAIN, domain, NON_DELETED))
            .toList();

    if (!nullOrEmpty(domains)) {
      filter.addQueryParam("requestedDomainId", EntityUtil.getCommaSeparatedIdsFromRefs(domains));
    }
  }

  private static CollectionDAO.TaskDAO initializeTaskDao(Jdbi jdbi) {
    if (Entity.getJdbi() == null) {
      Entity.setJdbi(jdbi);
    }
    if (Entity.getCollectionDAO() == null) {
      Entity.setCollectionDAO(jdbi.onDemand(CollectionDAO.class));
    }
    return Entity.getCollectionDAO().taskDAO();
  }

  public void applyTaskDomainFilter(ListFilter filter) {
    String requestedDomainId = filter.getQueryParam("requestedDomainId");
    String domainId = filter.getQueryParam("domainId");
    boolean domainAccessControl = Boolean.parseBoolean(filter.getQueryParam("domainAccessControl"));

    if (requestedDomainId != null) {
      String effectiveDomainId =
          domainAccessControl && domainId != null
              ? intersectDomainIds(requestedDomainId, domainId)
              : requestedDomainId;
      filter.addQueryParam("domainId", effectiveDomainId);
      domainId = effectiveDomainId;
    }

    if (domainId == null) {
      filter.removeQueryParam("requestedDomainId");
      return;
    }

    // Task queries should only return tasks in the effective domain set. Unlike generic entity
    // listing, no-domain fallback should not apply once task domain scoping is in effect.
    if (ListFilter.NULL_PARAM.equals(domainId) || nullOrEmpty(domainId)) {
      filter.addQueryParam("domainId", NO_MATCH_DOMAIN_ID);
      filter.removeQueryParam("entityType");
    }

    if (domainAccessControl) {
      filter.removeQueryParam("domainAccessControl");
    }
    filter.removeQueryParam("requestedDomainId");
  }

  private String intersectDomainIds(String requestedDomainId, String allowedDomainId) {
    if (ListFilter.NULL_PARAM.equals(allowedDomainId)) {
      return ListFilter.NULL_PARAM;
    }

    List<String> requestedIds =
        Arrays.stream(requestedDomainId.split(","))
            .map(String::trim)
            .filter(id -> !id.isEmpty())
            .toList();
    Set<String> allowedIds =
        new LinkedHashSet<>(
            Arrays.stream(allowedDomainId.split(","))
                .map(String::trim)
                .filter(id -> !id.isEmpty())
                .toList());
    List<String> intersection = requestedIds.stream().filter(allowedIds::contains).toList();

    return intersection.isEmpty() ? ListFilter.NULL_PARAM : String.join(",", intersection);
  }

  @Override
  public void setFields(Task task, Fields fields, RelationIncludes relationIncludes) {
    task.setAssignees(fields.contains(FIELD_ASSIGNEES) ? getAssignees(task) : task.getAssignees());
    task.setReviewers(
        fields.contains(FIELD_REVIEWERS) ? getTaskReviewers(task) : task.getReviewers());
    task.setWatchers(fields.contains(FIELD_WATCHERS) ? getWatchers(task) : task.getWatchers());
    task.setAbout(fields.contains(FIELD_ABOUT) ? getAboutEntity(task) : task.getAbout());
    task.setDomains(fields.contains(FIELD_DOMAINS) ? getDomains(task) : task.getDomains());
    task.setComments(fields.contains(FIELD_COMMENTS) ? getComments(task) : task.getComments());
    task.setCreatedBy(
        fields.contains(FIELD_CREATED_BY) ? getTaskCreatedBy(task) : task.getCreatedBy());
  }

  @Override
  public void setFieldsInBulk(Fields fields, java.util.List<Task> entities) {
    if (entities == null || entities.isEmpty()) {
      return;
    }
    fetchAndSetFields(entities, fields);
    setInheritedFields(entities, fields);
    RelationIncludes defaultIncludes = RelationIncludes.fromInclude(NON_DELETED);
    for (Task entity : entities) {
      setFields(entity, fields, defaultIncludes);
      clearFieldsInternal(entity, fields);
    }
  }

  @Override
  public void clearFields(Task task, Fields fields) {
    task.setAssignees(fields.contains(FIELD_ASSIGNEES) ? task.getAssignees() : null);
    task.setReviewers(fields.contains(FIELD_REVIEWERS) ? task.getReviewers() : null);
    task.setWatchers(fields.contains(FIELD_WATCHERS) ? task.getWatchers() : null);
    task.setAbout(fields.contains(FIELD_ABOUT) ? task.getAbout() : null);
    task.setDomains(fields.contains(FIELD_DOMAINS) ? task.getDomains() : null);
    task.setComments(fields.contains(FIELD_COMMENTS) ? task.getComments() : null);
    task.setCreatedBy(fields.contains(FIELD_CREATED_BY) ? task.getCreatedBy() : null);
  }

  @Override
  public void setFullyQualifiedName(Task task) {
    // FQN is based on taskId (TASK-XXXXX) since that's the unique identifier for lookup via API
    // The name field is a display name that can be customized by users
    task.setFullyQualifiedName(FullyQualifiedName.quoteName(task.getTaskId()));
  }

  @Override
  public void prepare(Task task, boolean update) {
    if (task.getTaskId() == null) {
      task.setTaskId(TaskIdGenerator.generateTaskId(daoCollection));
    }
    if (task.getName() == null) {
      task.setName(task.getTaskId());
    }
    if (task.getStatus() == null) {
      task.setStatus(TaskEntityStatus.Open);
    }
    if (task.getPriority() == null) {
      task.setPriority(TaskPriority.Medium);
    }

    if (!update) {
      setDefaultAssigneesFromEntityOwners(task);
    }
    TaskFieldValidator.validateAssignees(task.getAssignees());
    TaskFieldValidator.validateReviewers(task.getReviewers());
    TaskFieldValidator.validatePayloadAgainstFormSchema(task);

    // Compute aboutFqnHash for efficient querying by target entity FQN
    computeAboutFqnHash(task);

    initializeWorkflowManagedTask(task, update);

    // Task domains MUST be inherited from the target entity (about field)
    // This ensures tasks follow domain-based data isolation policies
    inheritDomainsFromTargetEntity(task);
  }

  /**
   * Compute and store the hash of the target entity's FQN for efficient querying.
   * The hash preserves hierarchical structure for prefix queries (e.g., all tasks for tables in a schema).
   */
  private void computeAboutFqnHash(Task task) {
    EntityReference about = task.getAbout();
    if (about == null || about.getFullyQualifiedName() == null) {
      task.setAboutFqnHash(null);
      return;
    }
    String fqnHash = FullyQualifiedName.buildHash(about.getFullyQualifiedName());
    task.setAboutFqnHash(fqnHash);
  }

  /**
   * If no assignees are specified and the target entity has owners, set the entity owners as default
   * assignees. This ensures tasks about owned entities are automatically routed to the right people.
   */
  private void setDefaultAssigneesFromEntityOwners(Task task) {
    if (!nullOrEmpty(task.getAssignees())) {
      return;
    }

    EntityReference about = task.getAbout();
    if (about == null || about.getId() == null) {
      return;
    }

    try {
      List<EntityReference> owners = Entity.getOwners(about);
      if (!nullOrEmpty(owners)) {
        task.setAssignees(owners);
        LOG.debug(
            "Task {} defaulting assignees to entity owners: {}",
            task.getTaskId(),
            owners.stream().map(EntityReference::getName).toList());
      }
    } catch (Exception e) {
      LOG.debug(
          "Could not resolve owners for task {} from target entity {}: {}",
          task.getTaskId(),
          about.getId(),
          e.getMessage());
    }
  }

  /**
   * Inherit domains from the target entity that this task is about.
   * Tasks must belong to the same domains as their target entity for proper data isolation.
   */
  private void inheritDomainsFromTargetEntity(Task task) {
    EntityReference about = task.getAbout();
    if (about == null || about.getId() == null) {
      // No target entity, task has no domains
      task.setDomains(null);
      return;
    }

    try {
      // Get the target entity to extract its domains
      EntityRepository<?> targetRepo = Entity.getEntityRepository(about.getType());
      Object targetEntity =
          targetRepo.get(null, about.getId(), targetRepo.getFields(FIELD_DOMAINS));

      // Extract domains from target entity using reflection
      List<EntityReference> targetDomains = extractDomainsFromEntity(targetEntity);
      task.setDomains(targetDomains);

      if (!nullOrEmpty(targetDomains)) {
        LOG.debug(
            "Task {} inheriting domains {} from target entity {}",
            task.getTaskId(),
            targetDomains.stream().map(EntityReference::getFullyQualifiedName).toList(),
            about.getFullyQualifiedName());
      }
    } catch (Exception e) {
      LOG.warn(
          "Could not resolve domains for task {} from target entity {}: {}",
          task.getTaskId(),
          about.getId(),
          e.getMessage());
      task.setDomains(null);
    }
  }

  /**
   * Extract domains list from an entity object.
   */
  @SuppressWarnings("unchecked")
  private List<EntityReference> extractDomainsFromEntity(Object entity) {
    if (entity == null) {
      return null;
    }

    try {
      // Use reflection to get domains field - most entities have getDomains()
      java.lang.reflect.Method getDomainsMethod = entity.getClass().getMethod("getDomains");
      Object domains = getDomainsMethod.invoke(entity);
      if (domains instanceof List) {
        return (List<EntityReference>) domains;
      }
    } catch (NoSuchMethodException e) {
      // Entity doesn't have domains field, which is fine
      LOG.debug("Entity {} does not have domains field", entity.getClass().getSimpleName());
    } catch (Exception e) {
      LOG.warn("Error extracting domains from entity: {}", e.getMessage());
    }
    return null;
  }

  @Override
  public void storeEntity(Task task, boolean update) {
    List<EntityReference> domains = task.getDomains();
    EntityReference about = task.getAbout();
    EntityReference createdBy = task.getCreatedBy();
    List<EntityReference> assignees = task.getAssignees();
    List<EntityReference> reviewers = task.getReviewers();
    List<EntityReference> watchers = task.getWatchers();

    // Preserve createdById in JSON for the generated column index
    if (createdBy != null && createdBy.getId() != null) {
      task.setCreatedById(createdBy.getId().toString());
    }

    task.withDomains(null)
        .withAbout(null)
        .withCreatedBy(null)
        .withAssignees(null)
        .withReviewers(null)
        .withWatchers(null);

    if (update) {
      daoCollection
          .taskDAO()
          .update(task.getId(), task.getFullyQualifiedName(), JsonUtils.pojoToJson(task));
    } else {
      daoCollection
          .taskDAO()
          .insertTask(
              task.getId().toString(), JsonUtils.pojoToJson(task), task.getFullyQualifiedName());
    }

    task.withDomains(domains)
        .withAbout(about)
        .withCreatedBy(createdBy)
        .withAssignees(assignees)
        .withReviewers(reviewers)
        .withWatchers(watchers);
  }

  @Override
  public void storeRelationships(Task task) {
    // Store domain relationships (task can belong to multiple domains)
    if (!nullOrEmpty(task.getDomains())) {
      for (EntityReference domain : task.getDomains()) {
        addRelationship(domain.getId(), task.getId(), DOMAIN, Entity.TASK, Relationship.HAS);
      }
    }

    storeAssignees(task);
    storeReviewers(task);
    storeWatchers(task);

    if (task.getCreatedBy() != null) {
      addRelationship(
          task.getCreatedBy().getId(),
          task.getId(),
          Entity.USER,
          Entity.TASK,
          Relationship.CREATED);
    }

    if (task.getAbout() != null) {
      addRelationship(
          task.getAbout().getId(),
          task.getId(),
          task.getAbout().getType(),
          Entity.TASK,
          Relationship.MENTIONED_IN);
    }
  }

  private void storeAssignees(Task task) {
    for (EntityReference assignee : listOrEmpty(task.getAssignees())) {
      addRelationship(
          assignee.getId(),
          task.getId(),
          assignee.getType(),
          Entity.TASK,
          Relationship.ASSIGNED_TO);
    }
  }

  private void storeReviewers(Task task) {
    for (EntityReference reviewer : listOrEmpty(task.getReviewers())) {
      addRelationship(
          reviewer.getId(), task.getId(), reviewer.getType(), Entity.TASK, Relationship.REVIEWS);
    }
  }

  private void storeWatchers(Task task) {
    for (EntityReference watcher : listOrEmpty(task.getWatchers())) {
      addRelationship(
          watcher.getId(), task.getId(), watcher.getType(), Entity.TASK, Relationship.FOLLOWS);
    }
  }

  private List<EntityReference> getAssignees(Task task) {
    return findFromRecordsByRelationship(task.getId(), Entity.TASK, Relationship.ASSIGNED_TO);
  }

  private List<EntityReference> getTaskReviewers(Task task) {
    return findFromRecordsByRelationship(task.getId(), Entity.TASK, Relationship.REVIEWS);
  }

  private List<EntityReference> getWatchers(Task task) {
    return findFromRecordsByRelationship(task.getId(), Entity.TASK, Relationship.FOLLOWS);
  }

  private EntityReference getTaskCreatedBy(Task task) {
    List<EntityReference> refs =
        findFromRecordsByRelationship(task.getId(), Entity.TASK, Relationship.CREATED);
    return nullOrEmpty(refs) ? null : refs.get(0);
  }

  private EntityReference getAboutEntity(Task task) {
    List<EntityReference> refs =
        findFromRecordsByRelationship(task.getId(), Entity.TASK, Relationship.MENTIONED_IN);
    return nullOrEmpty(refs) ? null : refs.get(0);
  }

  @Override
  protected List<EntityReference> getDomains(Task task) {
    return findFrom(task.getId(), Entity.TASK, Relationship.HAS, DOMAIN);
  }

  private List<org.openmetadata.schema.type.TaskComment> getComments(Task task) {
    // Comments are stored in the task JSON blob - already loaded with the entity
    return listOrEmpty(task.getComments());
  }

  /**
   * Add a comment to a task.
   * Anyone who can view the task can add comments.
   */
  public Task addComment(Task task, org.openmetadata.schema.type.TaskComment comment) {
    List<org.openmetadata.schema.type.TaskComment> comments =
        new java.util.ArrayList<>(listOrEmpty(task.getComments()));
    comments.add(comment);
    task.setComments(comments);
    task.setCommentCount(comments.size());
    task.setUpdatedAt(System.currentTimeMillis());
    storeEntity(task, true);

    // Store mentions from the comment message
    storeMentions(task, comment.getMessage());

    return task;
  }

  /**
   * Store mention relationships for users/teams mentioned in task comments.
   * This enables querying tasks where a user was mentioned.
   */
  private void storeMentions(Task task, String message) {
    if (message == null || message.isEmpty()) {
      return;
    }

    List<EntityLink> mentions = MessageParser.getEntityLinks(message);
    mentions.stream()
        .distinct()
        .forEach(
            mention ->
                daoCollection
                    .fieldRelationshipDAO()
                    .insert(
                        mention.getFullyQualifiedFieldValue(),
                        task.getId().toString(),
                        mention.getFullyQualifiedFieldValue(),
                        task.getId().toString(),
                        mention.getFullyQualifiedFieldType(),
                        Entity.TASK,
                        Relationship.MENTIONED_IN.ordinal(),
                        null));
  }

  /**
   * Edit a comment on a task.
   * Only the comment author can edit their own comment.
   */
  public Task editComment(Task task, UUID commentId, String newMessage, String userName) {
    List<org.openmetadata.schema.type.TaskComment> comments =
        new java.util.ArrayList<>(listOrEmpty(task.getComments()));

    boolean found = false;
    for (int i = 0; i < comments.size(); i++) {
      org.openmetadata.schema.type.TaskComment comment = comments.get(i);
      if (comment.getId().equals(commentId)) {
        // Check permission - only author can edit
        if (!isCommentAuthor(comment, userName)) {
          throw new AuthorizationException(
              String.format("User %s is not authorized to edit this comment", userName));
        }
        // Update the comment
        comment.setMessage(newMessage);
        comments.set(i, comment);
        found = true;
        break;
      }
    }

    if (!found) {
      throw new IllegalArgumentException("Comment not found: " + commentId);
    }

    task.setComments(comments);
    task.setUpdatedAt(System.currentTimeMillis());
    storeEntity(task, true);
    return task;
  }

  /**
   * Delete a comment from a task.
   * The comment author or an admin can delete a comment.
   */
  public Task deleteComment(Task task, UUID commentId, String userName, boolean isAdmin) {
    List<org.openmetadata.schema.type.TaskComment> comments =
        new java.util.ArrayList<>(listOrEmpty(task.getComments()));

    boolean found = false;
    for (int i = 0; i < comments.size(); i++) {
      org.openmetadata.schema.type.TaskComment comment = comments.get(i);
      if (comment.getId().equals(commentId)) {
        // Check permission - author or admin can delete
        if (!isAdmin && !isCommentAuthor(comment, userName)) {
          throw new AuthorizationException(
              String.format("User %s is not authorized to delete this comment", userName));
        }
        comments.remove(i);
        found = true;
        break;
      }
    }

    if (!found) {
      throw new IllegalArgumentException("Comment not found: " + commentId);
    }

    task.setComments(comments);
    task.setCommentCount(comments.size());
    task.setUpdatedAt(System.currentTimeMillis());
    storeEntity(task, true);
    return task;
  }

  private boolean isCommentAuthor(
      org.openmetadata.schema.type.TaskComment comment, String userName) {
    EntityReference author = comment.getAuthor();
    return author != null && author.getName() != null && author.getName().equals(userName);
  }

  /**
   * Resolve a task with workflow integration.
   *
   * <p>This method handles both workflow-managed tasks (Flowable) and standalone tasks.
   * For workflow-managed tasks, it coordinates with WorkflowHandler for multi-approval.
   *
   * @param task The task to resolve
   * @param transitionId ID of the transition to follow (from availableTransitions)
   * @param resolutionType The resolution type (Approved, Rejected, etc.)
   * @param newValue Optional new value to apply (for update tasks)
   * @param resolvedPayload Optional structured payload for the resolution
   * @param comment Optional comment from the resolver
   * @param user The user resolving the task
   * @return The updated task, or null if still waiting for more approvals
   */
  public Task resolveTaskWithWorkflow(
      Task task,
      String transitionId,
      TaskResolutionType resolutionType,
      String newValue,
      Object resolvedPayload,
      String comment,
      String user) {
    TaskFieldValidator.validateResolutionPayloadAgainstFormSchema(
        task, transitionId, resolvedPayload, newValue);
    return TaskWorkflowHandler.getInstance()
        .resolveTask(task, transitionId, resolutionType, newValue, resolvedPayload, comment, user);
  }

  /**
   * Reopen a previously resolved task.
   */
  public Task reopenTask(Task task, String user) {
    return TaskWorkflowHandler.getInstance().reopenTask(task, user);
  }

  /**
   * Close a task without applying any entity changes.
   */
  public Task closeTask(Task task, String user, String comment) {
    return TaskWorkflowHandler.getInstance().closeTask(task, user, comment);
  }

  /**
   * Check if user has permission to resolve or close a task.
   * Follows the same pattern as FeedRepository.checkPermissionsForResolveTask.
   *
   * Authorization rules:
   * - Admin can always resolve/close
   * - Assignee can resolve (with permission check on underlying entity) or close
   * - Creator can close (not resolve, unless also assignee)
   * - Owner of target entity can resolve/close
   * - Team member of assigned team can resolve/close
   * - Team member of target entity owner team can resolve/close
   */
  public void checkPermissionsForResolveTask(
      Authorizer authorizer, Task task, boolean closeTask, SecurityContext securityContext) {
    String userName = securityContext.getUserPrincipal().getName();
    User user = Entity.getEntityByName(USER, userName, TEAMS_FIELD, NON_DELETED);

    if (Boolean.TRUE.equals(user.getIsAdmin())) {
      return;
    }

    EntityReference about = task.getAbout();
    List<EntityReference> assignees = task.getAssignees();

    // Allow if user is owner of the target entity
    List<EntityReference> owners = about != null ? Entity.getOwners(about) : null;
    LOG.info(
        "[TaskRepository] checkPermissionsForResolveTask taskId='{}' user='{}' closeTask={} type='{}' about='{}' assignees={} owners={}",
        task.getId(),
        userName,
        closeTask,
        task.getType(),
        about != null ? about.getFullyQualifiedName() : null,
        assignees != null ? assignees.stream().map(EntityReference::getName).toList() : null,
        owners != null ? owners.stream().map(EntityReference::getName).toList() : null);
    if (!nullOrEmpty(owners)
        && owners.stream().anyMatch(owner -> owner.getName().equals(userName))) {
      return;
    }

    // Allow creator to close (not resolve)
    if (closeTask
        && task.getCreatedBy() != null
        && task.getCreatedBy().getName().equals(userName)) {
      return;
    }

    // Allow if user is a direct assignee
    if (!nullOrEmpty(assignees)
        && assignees.stream().anyMatch(assignee -> assignee.getName().equals(userName))) {
      // For approval tasks, assignees (reviewers) are authorized by assignment itself
      if (about != null && !isApprovalTask(task)) {
        validateUnderlyingEntityPermission(authorizer, securityContext, task);
      }
      return;
    }

    // Allow if user belongs to an assigned team or owner team
    List<EntityReference> teams = user.getTeams();
    if (!nullOrEmpty(teams)) {
      List<String> teamNames = teams.stream().map(EntityReference::getName).toList();

      // Check if user's team is an assignee
      if (!nullOrEmpty(assignees)
          && assignees.stream().anyMatch(assignee -> teamNames.contains(assignee.getName()))) {
        // For resolution (not just closing), team members also need entity permission
        // unless it's an approval task where assignment itself grants authorization
        if (!closeTask && about != null && !isApprovalTask(task)) {
          validateUnderlyingEntityPermission(authorizer, securityContext, task);
        }
        return;
      }

      // Check if user's team is owner of target entity
      if (!nullOrEmpty(owners)
          && owners.stream().anyMatch(owner -> teamNames.contains(owner.getName()))) {
        return;
      }
    }

    if (isIncidentTask(task) && hasIncidentEditPermission(authorizer, securityContext, task)) {
      return;
    }

    throw new AuthorizationException(
        CatalogExceptionMessage.taskOperationNotAllowed(
            userName, closeTask ? "closeTask" : "resolveTask"));
  }

  /**
   * Check that the user is allowed to perform an owner-only mutating action on a task,
   * such as reassigning it or changing its priority. Per the task permission matrix,
   * these actions are restricted to:
   * <ul>
   *   <li>Admins</li>
   *   <li>Direct or team owner of the target entity</li>
   *   <li>Domain owner of any domain the target entity belongs to (via team membership)</li>
   * </ul>
   * Assignees and creators cannot perform these actions.
   */
  public void checkPermissionsForOwnerOnlyAction(
      SecurityContext securityContext, Task task, String action) {
    String userName = securityContext.getUserPrincipal().getName();
    User user = Entity.getEntityByName(USER, userName, TEAMS_FIELD, NON_DELETED);

    if (Boolean.TRUE.equals(user.getIsAdmin())) {
      return;
    }

    EntityReference about = task.getAbout();
    List<EntityReference> owners = about != null ? Entity.getOwners(about) : null;

    if (!nullOrEmpty(owners)
        && owners.stream().anyMatch(owner -> owner.getName().equals(userName))) {
      return;
    }

    List<EntityReference> teams = user.getTeams();
    if (!nullOrEmpty(teams) && !nullOrEmpty(owners)) {
      List<String> teamNames = teams.stream().map(EntityReference::getName).toList();
      if (owners.stream().anyMatch(owner -> teamNames.contains(owner.getName()))) {
        return;
      }
    }

    throw new AuthorizationException(
        CatalogExceptionMessage.taskOperationNotAllowed(userName, action));
  }

  private boolean isIncidentTask(Task task) {
    TaskEntityType taskType = task.getType();
    return taskType == TaskEntityType.TestCaseResolution
        || taskType == TaskEntityType.IncidentResolution;
  }

  private boolean hasIncidentEditPermission(
      Authorizer authorizer, SecurityContext securityContext, Task task) {
    EntityReference about = task.getAbout();
    if (about == null || about.getId() == null || !Entity.TEST_CASE.equals(about.getType())) {
      return false;
    }

    try {
      TestCase testCase =
          Entity.getEntity(Entity.TEST_CASE, about.getId(), "entityLink", Include.ALL);
      if (testCase == null) {
        return false;
      }

      ResourceContextInterface testCaseResourceContext =
          TestCaseResourceContext.builder().name(testCase.getFullyQualifiedName()).build();
      EntityLink entityLink = MessageParser.EntityLink.parse(testCase.getEntityLink());
      ResourceContextInterface entityResourceContext =
          entityLink != null
              ? TestCaseResourceContext.builder().entityLink(entityLink).build()
              : TestCaseResourceContext.builder().build();

      List<AuthRequest> requests = new ArrayList<>();
      if (entityLink != null) {
        requests.add(
            new AuthRequest(
                new OperationContext(entityLink.getEntityType(), MetadataOperation.EDIT_TESTS),
                entityResourceContext));
        requests.add(
            new AuthRequest(
                new OperationContext(entityLink.getEntityType(), MetadataOperation.EDIT_ALL),
                entityResourceContext));
      }
      requests.add(
          new AuthRequest(
              new OperationContext(Entity.TEST_CASE, MetadataOperation.EDIT_TESTS),
              testCaseResourceContext));
      requests.add(
          new AuthRequest(
              new OperationContext(Entity.TEST_CASE, MetadataOperation.EDIT_ALL),
              testCaseResourceContext));

      authorizer.authorizeRequests(securityContext, requests, AuthorizationLogic.ANY);
      return true;
    } catch (AuthorizationException e) {
      LOG.debug(
          "[TaskRepository] Incident permission fallback denied for task '{}' and user '{}': {}",
          task.getId(),
          securityContext.getUserPrincipal().getName(),
          e.getMessage());
      return false;
    } catch (Exception e) {
      LOG.warn(
          "[TaskRepository] Failed incident permission fallback for task '{}': {}",
          task.getId(),
          e.getMessage());
      return false;
    }
  }

  private void validateUnderlyingEntityPermission(
      Authorizer authorizer, SecurityContext securityContext, Task task) {
    EntityReference about = task.getAbout();
    if (about == null) {
      return;
    }

    ResourceContext<?> resourceContext =
        new ResourceContext<>(about.getType(), about.getId(), null);

    MetadataOperation operation = getOperationForTask(task);
    if (operation != null && operation != MetadataOperation.EDIT_ALL) {
      // Allow either the specific operation OR EDIT_ALL (which encompasses all edit permissions)
      OperationContext specificOpContext = new OperationContext(about.getType(), operation);
      OperationContext editAllOpContext =
          new OperationContext(about.getType(), MetadataOperation.EDIT_ALL);
      authorizer.authorizeRequests(
          securityContext,
          List.of(
              new AuthRequest(specificOpContext, resourceContext),
              new AuthRequest(editAllOpContext, resourceContext)),
          AuthorizationLogic.ANY);
    } else if (operation == MetadataOperation.EDIT_ALL) {
      OperationContext operationContext = new OperationContext(about.getType(), operation);
      authorizer.authorize(securityContext, operationContext, resourceContext);
    }
  }

  private MetadataOperation getOperationForTask(Task task) {
    TaskEntityType taskType = task.getType();
    if (taskType == null) {
      return null;
    }

    MetadataOperation schemaBoundOperation =
        TaskFormExecutionResolver.resolve(task).permissionOperation();
    if (schemaBoundOperation != null) {
      return schemaBoundOperation;
    }

    // For Suggestion tasks, determine operation from payload's suggestionType
    if (taskType == TaskEntityType.Suggestion) {
      return getOperationForSuggestion(task);
    }

    return switch (taskType) {
      case DescriptionUpdate -> MetadataOperation.EDIT_DESCRIPTION;
      case TagUpdate -> MetadataOperation.EDIT_TAGS;
      case GlossaryApproval, RequestApproval -> MetadataOperation.EDIT_ALL;
      case OwnershipUpdate -> MetadataOperation.EDIT_OWNERS;
      case TierUpdate -> MetadataOperation.EDIT_TIER;
      case DomainUpdate -> MetadataOperation.EDIT_ALL;
      default -> null;
    };
  }

  private boolean isApprovalTask(Task task) {
    TaskEntityType taskType = task.getType();
    return taskType == TaskEntityType.GlossaryApproval
        || taskType == TaskEntityType.RequestApproval;
  }

  private MetadataOperation getOperationForSuggestion(Task task) {
    Object payload = task.getPayload();
    if (payload == null) {
      return MetadataOperation.EDIT_ALL;
    }

    SuggestionPayload suggestionPayload;
    if (payload instanceof SuggestionPayload sp) {
      suggestionPayload = sp;
    } else {
      try {
        suggestionPayload = JsonUtils.convertValue(payload, SuggestionPayload.class);
      } catch (Exception e) {
        return MetadataOperation.EDIT_ALL;
      }
    }

    SuggestionPayload.SuggestionType suggestionType = suggestionPayload.getSuggestionType();
    if (suggestionType == null) {
      return MetadataOperation.EDIT_ALL;
    }

    return switch (suggestionType) {
      case DESCRIPTION -> MetadataOperation.EDIT_DESCRIPTION;
      case TAG -> MetadataOperation.EDIT_TAGS;
      case OWNER -> MetadataOperation.EDIT_OWNERS;
      case TIER -> MetadataOperation.EDIT_TIER;
      case DOMAIN -> MetadataOperation.EDIT_ALL;
      case CUSTOM_PROPERTY -> MetadataOperation.EDIT_CUSTOM_FIELDS;
    };
  }

  /**
   * Internal method to update task resolution status.
   * Called by TaskWorkflowHandler after workflow processing.
   */
  public Task resolveTask(Task task, TaskResolution resolution, String updatedBy) {
    if (resolution == null) {
      throw new IllegalArgumentException("Resolution cannot be null");
    }

    // Read the committed state BEFORE mutating the task so postUpdate gets a
    // meaningful (original, updated) pair. The `task` argument is the caller's
    // in-memory copy which may already have staged fields (e.g., workflowStageId)
    // set by applyTaskResolution, so we can't use it as the pre-image.
    Task original = get(null, task.getId(), getFields("*"));

    TaskEntityStatus newStatus = mapResolutionToStatus(resolution.getType());
    task.setStatus(newStatus);
    task.setResolution(resolution);
    task.setUpdatedBy(updatedBy);
    task.setUpdatedAt(System.currentTimeMillis());

    storeEntity(task, true);

    // storeEntity is the raw persistence path and deliberately skips the full
    // update pipeline. Invoke postUpdate explicitly so lifecycle hooks fire
    // consistently with every other task-update path (PATCH, workflow-driven
    // CreateTask updates, etc.). This is what allows IncidentTcrsSyncHandler
    // — and any future postUpdate handler — to see terminal resolutions.
    postUpdate(original, task);

    return task;
  }

  private TaskEntityStatus mapResolutionToStatus(TaskResolutionType resolutionType) {
    return switch (resolutionType) {
      case Approved, AutoApproved -> TaskEntityStatus.Approved;
      case Rejected, AutoRejected -> TaskEntityStatus.Rejected;
      case Completed -> TaskEntityStatus.Completed;
      case Cancelled -> TaskEntityStatus.Cancelled;
      case TimedOut -> TaskEntityStatus.Failed;
    };
  }

  public List<EntityReference> findFromRecordsByRelationship(
      UUID toId, String toEntity, Relationship relationship) {
    return EntityUtil.getEntityReferences(
        daoCollection.relationshipDAO().findFrom(toId, toEntity, relationship.ordinal()));
  }

  /**
   * Find an open task for the given entity and task type.
   *
   * @param entityFqn Fully qualified name of the target entity
   * @param taskType The type of task to find
   * @return The task if found, or null
   */
  public Task findTaskByEntityTypeAndStatuses(
      String entityFqn, TaskEntityType taskType, List<TaskEntityStatus> statuses) {
    List<String> statusValues = statuses.stream().map(TaskEntityStatus::value).toList();
    String json =
        daoCollection
            .taskDAO()
            .findByAboutAndTypeAndStatuses(entityFqn, taskType.value(), statusValues);
    if (json == null) {
      return null;
    }
    return hydrateStoredTask(JsonUtils.readValue(json, Task.class));
  }

  public Task findOpenTaskByEntityAndType(String entityFqn, TaskEntityType taskType) {
    return findTaskByEntityTypeAndStatuses(entityFqn, taskType, OPEN_TASK_STATUSES);
  }

  public Task findTaskByEntityTypeAndStatus(
      String entityFqn, TaskEntityType taskType, TaskEntityStatus status) {
    return findTaskByEntityTypeAndStatuses(entityFqn, taskType, List.of(status));
  }

  /**
   * Close any open approval task for the given entity. Silently does nothing if no open task exists.
   * This is the replacement for feedRepository.getTask() + feedRepository.closeTask() pattern
   * used by entity repositories when an entity's approval status changes.
   *
   * @param entityFqn Fully qualified name of the target entity
   * @param taskType The type of approval task (e.g., GlossaryApproval, RequestApproval)
   * @param user The user closing the task
   * @param comment Optional comment explaining why the task was closed
   */
  public void closeApprovalTaskForEntity(
      String entityFqn, TaskEntityType taskType, String user, String comment) {
    Task task = findOpenTaskByEntityAndType(entityFqn, taskType);
    if (task != null) {
      closeTask(task, user, comment);
    }
  }

  /**
   * Find an open task for the given entity by category (e.g., Approval).
   *
   * @param entityFqn Fully qualified name of the target entity
   * @param category The category of task to find
   * @return The task if found, or null
   */
  public Task findOpenTaskByEntityAndCategory(String entityFqn, TaskCategory category) {
    String json =
        daoCollection
            .taskDAO()
            .findByAboutAndCategoryAndStatus(
                entityFqn, category.value(), TaskEntityStatus.Open.value());
    if (json == null) {
      return null;
    }
    return hydrateStoredTask(JsonUtils.readValue(json, Task.class));
  }

  public Task hydrateStoredTask(Task task) {
    if (task == null || task.getId() == null) {
      return task;
    }

    return get(
        null,
        task.getId(),
        getFields("assignees,reviewers,watchers,about,domains,createdBy,payload,resolution"));
  }

  /**
   * Close any open approval-category task for the given entity.
   * Searches by category=Approval which covers GlossaryApproval, RequestApproval, and any
   * future approval types. Silently does nothing if no open task exists.
   *
   * @param entityFqn Fully qualified name of the target entity
   * @param user The user closing the task
   * @param comment Optional comment explaining why the task was closed
   */
  public void closeApprovalTaskForEntity(String entityFqn, String user, String comment) {
    Task task = findOpenTaskByEntityAndCategory(entityFqn, TaskCategory.Approval);
    if (task != null) {
      closeTask(task, user, comment);
    }
  }

  /**
   * Update assignees on an open approval task for the given entity.
   * Used when an entity's reviewers change while an approval task is in progress.
   * Silently does nothing if no open task exists.
   *
   * @param entityFqn Fully qualified name of the target entity
   * @param newAssignees The new list of assignees (typically entity reviewers)
   * @param updatedBy The user making the change
   */
  public void updateApprovalTaskAssignees(
      String entityFqn, List<EntityReference> newAssignees, String updatedBy) {
    Task task = findOpenTaskByEntityAndCategory(entityFqn, TaskCategory.Approval);
    if (task == null) {
      return;
    }

    Task currentTask = get(null, task.getId(), getFields("*"));
    Task updatedTask = JsonUtils.deepCopy(currentTask, Task.class);
    updatedTask.setAssignees(newAssignees);
    updatedTask.setUpdatedBy(updatedBy);
    updatedTask.setUpdatedAt(System.currentTimeMillis());

    JsonPatch patch = JsonUtils.getJsonPatch(currentTask, updatedTask);
    if (patch.toJsonArray().isEmpty()) {
      return;
    }

    Task patchedTask = patch(null, currentTask.getId(), updatedBy, patch).entity();
    WebsocketNotificationHandler.handleTaskNotification(patchedTask);
  }

  @Override
  public TaskUpdater getUpdater(
      Task original,
      Task updated,
      Operation operation,
      org.openmetadata.schema.type.change.ChangeSource changeSource) {
    return new TaskUpdater(original, updated, operation, changeSource);
  }

  @Override
  protected void postCreate(Task entity) {
    super.postCreate(entity);
    triggerWorkflowManagedTask(entity);
    IncidentTcrsSyncHandler.handleTaskCreate(entity);
  }

  @Override
  protected void postUpdate(Task original, Task updated) {
    super.postUpdate(original, updated);
    IncidentTcrsSyncHandler.handleTaskUpdate(original, updated);
  }

  private void initializeWorkflowManagedTask(Task task, boolean update) {
    if (update || !shouldCreateWorkflowManagedTask(task)) {
      return;
    }

    TaskWorkflowLifecycleResolver.resolveBinding(task)
        .ifPresent(
            binding -> {
              WorkflowDefinition workflowDefinition =
                  Entity.findByNameOrNull(
                      Entity.WORKFLOW_DEFINITION, binding.workflowDefinitionRef(), NON_DELETED);
              if (workflowDefinition == null) {
                return;
              }

              task.setCategory(
                  TaskWorkflowLifecycleResolver.resolveDefaultTaskCategory(
                      task.getType(), task.getCategory()));
              task.setTaskFormSchemaId(binding.schema() != null ? binding.schema().getId() : null);
              task.setTaskFormSchemaVersion(
                  binding.schema() != null ? binding.schema().getVersion() : null);
              task.setWorkflowDefinitionId(workflowDefinition.getId());
              task.setWorkflowStageId("pending-workflow-start");
              task.setWorkflowStageDisplayName("Starting");
              task.setAvailableTransitions(List.of());
            });
  }

  private void triggerWorkflowManagedTask(Task task) {
    if (!isPendingWorkflowManagedTask(task)) {
      return;
    }

    try {
      LOG.info(
          "[TaskRepository] triggerWorkflowManagedTask taskId='{}' draftAssignees={} createdBy='{}' updatedBy='{}'",
          task.getId(),
          task.getAssignees() != null
              ? task.getAssignees().stream().map(EntityReference::getName).toList()
              : null,
          task.getCreatedBy() != null ? task.getCreatedBy().getName() : null,
          task.getUpdatedBy());
      WorkflowDefinition workflowDefinition =
          Entity.getEntity(
              Entity.WORKFLOW_DEFINITION,
              task.getWorkflowDefinitionId(),
              Entity.FIELD_FULLY_QUALIFIED_NAME,
              NON_DELETED);

      Map<String, Object> variables = new LinkedHashMap<>();
      variables.putAll(TaskWorkflowLifecycleResolver.buildWorkflowStartVariables(task));
      if (task.getAbout() != null && !nullOrEmpty(task.getAbout().getFullyQualifiedName())) {
        variables.put(
            getNamespacedVariableName(GLOBAL_NAMESPACE, RELATED_ENTITY_VARIABLE),
            EntityUtil.buildEntityLink(
                task.getAbout().getType(), task.getAbout().getFullyQualifiedName()));
      }
      variables.put(
          getNamespacedVariableName(GLOBAL_NAMESPACE, UPDATED_BY_VARIABLE), task.getUpdatedBy());
      variables.put(
          "taskFormSchemaId",
          task.getTaskFormSchemaId() != null ? task.getTaskFormSchemaId().toString() : null);
      variables.put("taskFormSchemaVersion", task.getTaskFormSchemaVersion());
      variables.put("workflowDefinitionId", workflowDefinition.getId().toString());

      WorkflowHandler.getInstance()
          .triggerByKey(
              getTriggerWorkflowId(workflowDefinition.getFullyQualifiedName()),
              task.getId().toString(),
              variables);
    } catch (Exception e) {
      LOG.error(
          "Failed to trigger workflow-managed task {} using workflow definition {}",
          task.getId(),
          task.getWorkflowDefinitionId(),
          e);
      markWorkflowTriggerFailure(task);
    }
  }

  private void markWorkflowTriggerFailure(Task task) {
    try {
      task.setWorkflowStageId("workflow-start-failed");
      task.setWorkflowStageDisplayName("Workflow start failed");
      task.setUpdatedAt(System.currentTimeMillis());
      storeEntity(task, true);
    } catch (Exception persistenceException) {
      LOG.error(
          "Failed to persist workflow trigger failure state for task {}",
          task.getId(),
          persistenceException);
    }
  }

  private boolean shouldCreateWorkflowManagedTask(Task task) {
    return task != null
        && task.getType() != null
        && task.getAbout() != null
        && !nullOrEmpty(task.getAbout().getType())
        && !nullOrEmpty(task.getAbout().getFullyQualifiedName())
        && task.getWorkflowInstanceId() == null;
  }

  private boolean isPendingWorkflowManagedTask(Task task) {
    return shouldCreateWorkflowManagedTask(task)
        && task.getWorkflowDefinitionId() != null
        && "pending-workflow-start".equals(task.getWorkflowStageId());
  }

  /**
   * Update domains for all open tasks related to a target entity using bulk operations.
   * Called when an entity's domains change to keep tasks in sync.
   *
   * @param entityId The ID of the entity whose domains changed
   * @param entityType The type of the entity
   * @param newDomains The new domains list (can be null/empty if domains removed)
   */
  public void syncTaskDomainsForEntity(
      UUID entityId, String entityType, List<EntityReference> newDomains) {
    LOG.info(
        "Syncing task domains for entity {} ({}) to domains {}",
        entityId,
        entityType,
        nullOrEmpty(newDomains)
            ? "null"
            : newDomains.stream().map(EntityReference::getFullyQualifiedName).toList());

    // Find all tasks for this entity
    List<CollectionDAO.EntityRelationshipRecord> taskRecords =
        daoCollection
            .relationshipDAO()
            .findTo(entityId, entityType, Relationship.MENTIONED_IN.ordinal(), Entity.TASK);

    if (taskRecords.isEmpty()) {
      LOG.debug("No tasks found for entity {} ({})", entityId, entityType);
      return;
    }

    // Filter to only open/in-progress/pending tasks
    List<UUID> openTaskIds = new ArrayList<>();
    for (CollectionDAO.EntityRelationshipRecord record : taskRecords) {
      try {
        Task task = get(null, record.getId(), getFields("status"));
        if (task.getStatus() == TaskEntityStatus.Open
            || task.getStatus() == TaskEntityStatus.InProgress
            || task.getStatus() == TaskEntityStatus.Pending) {
          openTaskIds.add(record.getId());
        }
      } catch (Exception e) {
        LOG.warn("Could not check task status for {}: {}", record.getId(), e.getMessage());
      }
    }

    if (openTaskIds.isEmpty()) {
      LOG.debug("No open tasks found for entity {} ({})", entityId, entityType);
      return;
    }

    List<String> taskIdStrings = openTaskIds.stream().map(UUID::toString).toList();

    // Bulk delete existing domain relationships for these tasks
    daoCollection.taskDAO().bulkRemoveDomainRelationships(taskIdStrings);

    // Bulk insert new domain relationships for each domain
    if (!nullOrEmpty(newDomains)) {
      for (EntityReference domain : newDomains) {
        daoCollection
            .relationshipDAO()
            .bulkInsertToRelationship(
                domain.getId(), openTaskIds, DOMAIN, Entity.TASK, Relationship.HAS.ordinal());
      }
    }

    LOG.info(
        "Bulk updated {} task domains to {}",
        openTaskIds.size(),
        nullOrEmpty(newDomains)
            ? "null"
            : newDomains.stream().map(EntityReference::getFullyQualifiedName).toList());
  }

  public class TaskUpdater extends EntityUpdater {
    public TaskUpdater(
        Task original,
        Task updated,
        Operation operation,
        org.openmetadata.schema.type.change.ChangeSource changeSource) {
      super(original, updated, operation, changeSource);
    }

    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      updateAssignees();
      updateTaskReviewers();
      updateWorkflowMetadata();
      updateStatus();
      updatePriority();
      updatePayload();
      updateResolution();
      updateWorkflowFields();
    }

    private void updateAssignees() {
      List<EntityReference> origAssignees = new ArrayList<>(listOrEmpty(original.getAssignees()));
      List<EntityReference> updatedAssignees = new ArrayList<>(listOrEmpty(updated.getAssignees()));

      if (operation == Operation.PUT && updated.getAssignees() == null) {
        updated.setAssignees(origAssignees);
        updatedAssignees = new ArrayList<>(origAssignees);
      }

      origAssignees.sort(EntityUtil.compareEntityReference);
      updatedAssignees.sort(EntityUtil.compareEntityReference);

      List<EntityReference> added = new ArrayList<>(updatedAssignees);
      List<EntityReference> removed = new ArrayList<>(origAssignees);
      added.removeAll(origAssignees);
      removed.removeAll(updatedAssignees);

      if (!added.isEmpty() || !removed.isEmpty()) {
        for (EntityReference assignee : added) {
          addRelationship(
              assignee.getId(),
              updated.getId(),
              assignee.getType(),
              Entity.TASK,
              Relationship.ASSIGNED_TO);
        }
        for (EntityReference assignee : removed) {
          deleteRelationship(
              assignee.getId(),
              assignee.getType(),
              updated.getId(),
              Entity.TASK,
              Relationship.ASSIGNED_TO);
        }
        recordChange(FIELD_ASSIGNEES, origAssignees, updatedAssignees);
      }
    }

    private void updateTaskReviewers() {
      List<EntityReference> origReviewers = new ArrayList<>(listOrEmpty(original.getReviewers()));
      List<EntityReference> updatedReviewers = new ArrayList<>(listOrEmpty(updated.getReviewers()));

      if (operation == Operation.PUT && updated.getReviewers() == null) {
        updated.setReviewers(origReviewers);
        updatedReviewers = new ArrayList<>(origReviewers);
      }

      origReviewers.sort(EntityUtil.compareEntityReference);
      updatedReviewers.sort(EntityUtil.compareEntityReference);

      List<EntityReference> added = new java.util.ArrayList<>(updatedReviewers);
      List<EntityReference> removed = new java.util.ArrayList<>(origReviewers);
      added.removeAll(origReviewers);
      removed.removeAll(updatedReviewers);

      if (!added.isEmpty() || !removed.isEmpty()) {
        for (EntityReference reviewer : added) {
          addRelationship(
              reviewer.getId(),
              updated.getId(),
              reviewer.getType(),
              Entity.TASK,
              Relationship.REVIEWS);
        }
        for (EntityReference reviewer : removed) {
          deleteRelationship(
              reviewer.getId(),
              reviewer.getType(),
              updated.getId(),
              Entity.TASK,
              Relationship.REVIEWS);
        }
        recordChange(FIELD_REVIEWERS, origReviewers, updatedReviewers);
      }
    }

    private void updateStatus() {
      if (recordChange("status", original.getStatus(), updated.getStatus())) {
        if (updated.getStatus() != TaskEntityStatus.Open
            && updated.getStatus() != TaskEntityStatus.InProgress
            && updated.getStatus() != TaskEntityStatus.Pending) {
          updated.setResolution(
              updated.getResolution() != null
                  ? updated.getResolution()
                  : new TaskResolution()
                      .withType(TaskResolutionType.Completed)
                      .withResolvedAt(System.currentTimeMillis()));
        }
      }
    }

    private void updatePriority() {
      recordChange("priority", original.getPriority(), updated.getPriority());
    }

    private void updateWorkflowMetadata() {
      recordChange(
          "workflowInstanceId",
          original.getWorkflowInstanceId(),
          updated.getWorkflowInstanceId(),
          false,
          Objects::equals,
          false);
      recordChange(
          "workflowStageId",
          original.getWorkflowStageId(),
          updated.getWorkflowStageId(),
          false,
          Objects::equals,
          false);
      recordChange(
          "workflowStageDisplayName",
          original.getWorkflowStageDisplayName(),
          updated.getWorkflowStageDisplayName(),
          false,
          Objects::equals,
          false);
      recordChange(
          "availableTransitions",
          original.getAvailableTransitions(),
          updated.getAvailableTransitions(),
          true,
          Objects::equals,
          false);
      recordChange(
          "taskFormSchemaId",
          original.getTaskFormSchemaId(),
          updated.getTaskFormSchemaId(),
          false,
          Objects::equals,
          false);
      recordChange(
          "taskFormSchemaVersion",
          original.getTaskFormSchemaVersion(),
          updated.getTaskFormSchemaVersion(),
          false,
          Objects::equals,
          false);
    }

    private void updatePayload() {
      recordChange(
          FIELD_PAYLOAD, original.getPayload(), updated.getPayload(), true, Objects::equals, false);
    }

    private void updateResolution() {
      recordChange(FIELD_RESOLUTION, original.getResolution(), updated.getResolution());
    }

    private void updateWorkflowFields() {
      recordChange("workflowStageId", original.getWorkflowStageId(), updated.getWorkflowStageId());
      recordChange(
          "workflowStageDisplayName",
          original.getWorkflowStageDisplayName(),
          updated.getWorkflowStageDisplayName());
      recordChange(
          "workflowInstanceId", original.getWorkflowInstanceId(), updated.getWorkflowInstanceId());
      recordChange(
          "availableTransitions",
          original.getAvailableTransitions(),
          updated.getAvailableTransitions());
    }
  }
}
