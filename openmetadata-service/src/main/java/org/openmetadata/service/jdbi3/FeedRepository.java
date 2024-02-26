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

package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.EventType.ENTITY_DELETED;
import static org.openmetadata.schema.type.EventType.ENTITY_NO_CHANGE;
import static org.openmetadata.schema.type.EventType.POST_UPDATED;
import static org.openmetadata.schema.type.EventType.TASK_CLOSED;
import static org.openmetadata.schema.type.EventType.TASK_RESOLVED;
import static org.openmetadata.schema.type.EventType.THREAD_UPDATED;
import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.schema.type.Include.NON_DELETED;
import static org.openmetadata.schema.type.Relationship.ADDRESSED_TO;
import static org.openmetadata.schema.type.Relationship.CREATED;
import static org.openmetadata.schema.type.Relationship.IS_ABOUT;
import static org.openmetadata.schema.type.Relationship.REPLIED_TO;
import static org.openmetadata.schema.type.TaskStatus.Open;
import static org.openmetadata.service.Entity.USER;
import static org.openmetadata.service.exception.CatalogExceptionMessage.ANNOUNCEMENT_INVALID_START_TIME;
import static org.openmetadata.service.exception.CatalogExceptionMessage.ANNOUNCEMENT_OVERLAP;
import static org.openmetadata.service.exception.CatalogExceptionMessage.entityNotFound;
import static org.openmetadata.service.jdbi3.UserRepository.TEAMS_FIELD;
import static org.openmetadata.service.util.EntityUtil.compareEntityReference;

import io.jsonwebtoken.lang.Collections;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import javax.json.JsonPatch;
import javax.ws.rs.core.Response.Status;
import javax.ws.rs.core.SecurityContext;
import javax.ws.rs.core.UriInfo;
import lombok.Getter;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.apache.commons.lang3.tuple.Triple;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.json.JSONObject;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.feed.CloseTask;
import org.openmetadata.schema.api.feed.ResolveTask;
import org.openmetadata.schema.api.feed.ThreadCount;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Post;
import org.openmetadata.schema.type.Reaction;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TaskDetails;
import org.openmetadata.schema.type.TaskStatus;
import org.openmetadata.schema.type.TaskType;
import org.openmetadata.schema.type.ThreadType;
import org.openmetadata.schema.utils.EntityInterfaceUtil;
import org.openmetadata.service.Entity;
import org.openmetadata.service.ResourceRegistry;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.formatter.decorators.FeedMessageDecorator;
import org.openmetadata.service.formatter.decorators.MessageDecorator;
import org.openmetadata.service.formatter.util.FeedMessage;
import org.openmetadata.service.resources.feeds.FeedResource;
import org.openmetadata.service.resources.feeds.FeedUtil;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.RestUtil.DeleteResponse;
import org.openmetadata.service.util.RestUtil.PatchResponse;
import org.openmetadata.service.util.ResultList;

/*
 * Feed relationships:
 * - 'user' --- createdBy ---> 'thread' in entity_relationship
 * - 'user' --- repliedTo ---> 'thread' in entity_relationship
 * - 'user' --- mentionedIn ---> 'thread' in entity_relationship
 * - 'user' --- reactedTo ---> 'thread' in entity_relationship
 * - 'thread' --- addressedTo ---> 'user' in field_relationship
 * - 'thread' --- isAbout ---> 'entity' in entity_relationship
 */
@Slf4j
@Repository
public class FeedRepository {
  public static final String DELETED_USER_NAME = "DeletedUser";
  public static final String DELETED_USER_DISPLAY = "User was deleted";
  public static final String DELETED_TEAM_NAME = "DeletedTeam";
  public static final String DELETED_TEAM_DISPLAY = "Team was deleted";
  private final CollectionDAO dao;
  private static final MessageDecorator<FeedMessage> FEED_MESSAGE_FORMATTER =
      new FeedMessageDecorator();

  public FeedRepository() {
    this.dao = Entity.getCollectionDAO();
    Entity.setFeedRepository(this);
    ResourceRegistry.addResource("feed", null, Entity.getEntityFields(Thread.class));
  }

  public enum FilterType {
    OWNER,
    MENTIONS,
    FOLLOWS,
    ASSIGNED_TO,
    ASSIGNED_BY,
    OWNER_OR_FOLLOWS
  }

  public enum PaginationType {
    BEFORE,
    AFTER
  }

  public int getNextTaskId() {
    dao.feedDAO().updateTaskId();
    return dao.feedDAO().getTaskId();
  }

  @Getter
  public static class ThreadContext {
    protected final Thread thread;
    @Setter protected EntityLink about;
    @Setter protected EntityInterface aboutEntity;
    private final EntityReference createdBy;

    ThreadContext(Thread thread) {
      this.thread = thread;
      this.about = EntityLink.parse(thread.getAbout());
      this.aboutEntity = Entity.getEntity(about, getFields(), ALL);
      this.createdBy =
          Entity.getEntityReferenceByName(Entity.USER, thread.getCreatedBy(), NON_DELETED);
      thread.withEntityId(aboutEntity.getId()); // Add entity id to thread
    }

    ThreadContext(Thread thread, ChangeEvent event) {
      this.thread = thread;
      this.about = EntityLink.parse(thread.getAbout());
      if (event.getEventType().equals(ENTITY_DELETED)) {
        String json = (String) event.getEntity();
        this.aboutEntity =
            JsonUtils.readValue(json, Entity.getEntityClassFromType(event.getEntityType()));
      } else {
        this.aboutEntity = Entity.getEntity(about, getFields(), ALL);
      }
      this.createdBy =
          Entity.getEntityReferenceByName(Entity.USER, thread.getCreatedBy(), NON_DELETED);
      thread.withEntityId(aboutEntity.getId()); // Add entity id to thread
    }

    public TaskWorkflow getTaskWorkflow() {
      EntityRepository<?> repository = Entity.getEntityRepository(about.getEntityType());
      return repository.getTaskWorkflow(this);
    }

    public EntityRepository<? extends EntityInterface> getEntityRepository() {
      return Entity.getEntityRepository(about.getEntityType());
    }

    private String getFields() {
      EntityRepository<?> repository = getEntityRepository();
      List<String> fieldList = new ArrayList<>();
      if (repository.supportsOwner) {
        fieldList.add("owner");
      }
      if (repository.supportsTags) {
        fieldList.add("tags");
      }
      return String.join(",", fieldList.toArray(new String[0]));
    }
  }

  public abstract static class TaskWorkflow {
    protected final ThreadContext threadContext;

    TaskWorkflow(ThreadContext threadContext) {
      this.threadContext = threadContext;
    }

    public abstract EntityInterface performTask(String user, ResolveTask resolveTask);

    @SuppressWarnings("unused")
    protected void closeTask(String user, CloseTask closeTask) {}

    protected final TaskType getTaskType() {
      return threadContext.getThread().getTask().getType();
    }

    protected final EntityLink getAbout() {
      return threadContext.getAbout();
    }
  }

  private ThreadContext getThreadContext(Thread thread) {
    return new ThreadContext(thread);
  }

  private ThreadContext getThreadContext(Thread thread, ChangeEvent event) {
    return new ThreadContext(thread, event);
  }

  @Transaction
  public Thread create(Thread thread) {
    ThreadContext threadContext = getThreadContext(thread);
    return createThread(threadContext);
  }

  @Transaction
  public void create(Thread thread, ChangeEvent event) {
    ThreadContext threadContext = getThreadContext(thread, event);
    createThread(threadContext);
  }

  @Transaction
  public void store(ThreadContext threadContext) {
    // Insert a new thread
    dao.feedDAO().insert(JsonUtils.pojoToJson(threadContext.getThread()));
  }

  @Transaction
  public void storeRelationships(ThreadContext threadContext) {
    Thread thread = threadContext.getThread();
    EntityLink about = threadContext.getAbout();
    // Add relationship User -- created --> Thread relationship
    dao.relationshipDAO()
        .insert(
            threadContext.getCreatedBy().getId(),
            thread.getId(),
            USER,
            Entity.THREAD,
            CREATED.ordinal());

    // Add field relationship for data asset - Thread -- isAbout ---> entity/entityField
    dao.fieldRelationshipDAO()
        .insert(
            thread.getId().toString(), // from FQN
            about.getFullyQualifiedFieldValue(), // to FQN,
            thread.getId().toString(),
            about.getFullyQualifiedFieldValue(),
            Entity.THREAD, // From type
            about.getFullyQualifiedFieldType(), // to Type
            IS_ABOUT.ordinal(),
            null);

    // Add the owner also as addressedTo as the entity he owns when addressed, the owner is
    // actually being addressed
    EntityReference entityOwner = threadContext.getAboutEntity().getOwner();
    if (entityOwner != null) {
      dao.relationshipDAO()
          .insert(
              thread.getId(),
              entityOwner.getId(),
              Entity.THREAD,
              entityOwner.getType(),
              ADDRESSED_TO.ordinal());
    }

    // Add mentions to field relationship table
    storeMentions(thread, thread.getMessage());
  }

  public Thread getTask(EntityLink about, TaskType taskType) {
    List<Triple<String, String, String>> tasks =
        dao.fieldRelationshipDAO()
            .findFrom(
                about.getFullyQualifiedFieldValue(),
                about.getFullyQualifiedFieldType(),
                IS_ABOUT.ordinal());
    for (Triple<String, String, String> task : tasks) {
      if (task.getMiddle().equals(Entity.THREAD)) {
        UUID threadId = UUID.fromString(task.getLeft());
        Thread thread =
            EntityUtil.validate(threadId, dao.feedDAO().findById(threadId), Thread.class);
        if (thread.getTask() != null && thread.getTask().getType() == taskType) {
          return thread;
        }
      }
    }
    throw new EntityNotFoundException(
        String.format(
            "Task for entity %s of type %s was not found", about.getEntityType(), taskType));
  }

  private Thread createThread(ThreadContext threadContext) {
    Thread thread = threadContext.getThread();
    if (thread.getType() == ThreadType.Task) {
      validateAssignee(thread);
      thread.getTask().withId(getNextTaskId());
    } else if (thread.getType() == ThreadType.Announcement) {
      // Validate start and end time for announcement
      validateAnnouncement(thread);
    }
    store(threadContext);
    storeRelationships(threadContext);
    populateAssignees(threadContext.getThread());
    return threadContext.getThread();
  }

  public Thread get(UUID id) {
    Thread thread = EntityUtil.validate(id, dao.feedDAO().findById(id), Thread.class);
    sortPosts(thread);
    return thread;
  }

  public Thread getTask(Integer id) {
    Thread task = EntityUtil.validate(id, dao.feedDAO().findByTaskId(id), Thread.class);
    sortPosts(task);
    return populateAssignees(task);
  }

  public PatchResponse<Thread> closeTask(
      UriInfo uriInfo, Thread thread, String user, CloseTask closeTask) {
    // Update the attributes
    closeTask(thread, user, closeTask);
    Thread updatedHref = FeedResource.addHref(uriInfo, thread);
    return new PatchResponse<>(Status.OK, updatedHref, TASK_CLOSED);
  }

  public PatchResponse<Thread> resolveTask(
      UriInfo uriInfo, Thread thread, String user, ResolveTask resolveTask) {
    // perform the task
    ThreadContext threadContext = getThreadContext(thread);
    resolveTask(threadContext, user, resolveTask);
    Thread updatedHref = FeedResource.addHref(uriInfo, thread);
    return new PatchResponse<>(Status.OK, updatedHref, TASK_RESOLVED);
  }

  protected void resolveTask(ThreadContext threadContext, String user, ResolveTask resolveTask) {
    TaskWorkflow taskWorkflow = threadContext.getTaskWorkflow();
    EntityInterface aboutEntity = threadContext.getAboutEntity();
    String origJson = JsonUtils.pojoToJson(aboutEntity);
    EntityInterface updatedEntity = taskWorkflow.performTask(user, resolveTask);
    String updatedEntityJson = JsonUtils.pojoToJson(updatedEntity);
    JsonPatch patch = JsonUtils.getJsonPatch(origJson, updatedEntityJson);
    EntityRepository<?> repository = threadContext.getEntityRepository();
    repository.patch(null, aboutEntity.getId(), user, patch);

    // Update the attributes
    threadContext.getThread().getTask().withNewValue(resolveTask.getNewValue());
    closeTask(threadContext.getThread(), user, new CloseTask());
  }

  private static String getTagFQNs(List<TagLabel> tags) {
    return tags.stream().map(TagLabel::getTagFQN).collect(Collectors.joining(", "));
  }

  @Transaction
  private void addClosingPost(Thread thread, String user, String closingComment) {
    // Add a post to the task
    String message;
    if (closingComment != null) {
      message = closeTaskMessage(closingComment);
    } else {
      // The task was resolved with an update.
      // Add a default message to the Task thread with updated description/tag
      TaskDetails task = thread.getTask();
      TaskType type = task.getType();
      if (EntityUtil.isDescriptionTask(type)) {
        message = resolveDescriptionTaskMessage(task);
      } else if (EntityUtil.isTagTask(type)) {
        message = resolveTagTaskMessage(task);
      } else {
        message = "Resolved the Task.";
      }
    }
    Post post =
        new Post()
            .withId(UUID.randomUUID())
            .withMessage(message)
            .withFrom(user)
            .withReactions(java.util.Collections.emptyList())
            .withPostTs(System.currentTimeMillis());
    addPostToThread(thread.getId(), post, user);
  }

  @Transaction
  public void closeTask(Thread thread, String user, CloseTask closeTask) {
    ThreadContext threadContext = getThreadContext(thread);
    TaskDetails task = thread.getTask();
    if (task.getStatus() != Open) {
      return;
    }
    TaskWorkflow workflow = threadContext.getTaskWorkflow();
    workflow.closeTask(user, closeTask);
    task.withStatus(TaskStatus.Closed).withClosedBy(user).withClosedAt(System.currentTimeMillis());
    thread.withTask(task).withUpdatedBy(user).withUpdatedAt(System.currentTimeMillis());

    dao.feedDAO().update(thread.getId(), JsonUtils.pojoToJson(thread));
    addClosingPost(thread, user, closeTask.getComment());
    sortPosts(thread);
  }

  private void storeMentions(Thread thread, String message) {
    // Create relationship for users, teams, and other entities that are mentioned in the post
    // Multiple mentions of the same entity is handled by taking distinct mentions
    List<EntityLink> mentions = MessageParser.getEntityLinks(message);

    mentions.stream()
        .distinct()
        .forEach(
            mention ->
                dao.fieldRelationshipDAO()
                    .insert(
                        mention.getFullyQualifiedFieldValue(),
                        thread.getId().toString(),
                        mention.getFullyQualifiedFieldValue(),
                        thread.getId().toString(),
                        mention.getFullyQualifiedFieldType(),
                        Entity.THREAD,
                        Relationship.MENTIONED_IN.ordinal(),
                        null));
  }

  @Transaction
  public Thread addPostToThread(UUID id, Post post, String userName) {
    // Validate the user posting the message
    UUID fromUserId = Entity.getEntityReferenceByName(USER, post.getFrom(), NON_DELETED).getId();

    // Update the thread with the new post
    Thread thread = EntityUtil.validate(id, dao.feedDAO().findById(id), Thread.class);

    // Populate Assignees if type is task
    populateAssignees(thread);

    thread.withUpdatedBy(userName).withUpdatedAt(System.currentTimeMillis());
    FeedUtil.addPost(thread, post);
    dao.feedDAO().update(id, JsonUtils.pojoToJson(thread));

    // Add relation User -- repliedTo --> Thread
    // Add relationship from thread to the user entity that is posting a reply
    boolean relationAlreadyExists =
        thread.getPosts().stream().anyMatch(p -> p.getFrom().equals(post.getFrom()));
    if (!relationAlreadyExists) {
      dao.relationshipDAO()
          .insert(fromUserId, thread.getId(), USER, Entity.THREAD, REPLIED_TO.ordinal());
    }

    // Add mentions into field relationship table
    storeMentions(thread, post.getMessage());
    sortPostsInThreads(List.of(thread));
    return thread;
  }

  public Post getPostById(Thread thread, UUID postId) {
    Optional<Post> post =
        thread.getPosts().stream().filter(p -> p.getId().equals(postId)).findAny();
    if (post.isEmpty()) {
      throw EntityNotFoundException.byMessage(entityNotFound("Post", postId));
    }
    return post.get();
  }

  @Transaction
  public DeleteResponse<Post> deletePost(Thread thread, Post post, String userName) {
    List<Post> posts = thread.getPosts();
    // Remove the post to be deleted from the posts list
    posts = posts.stream().filter(p -> !p.getId().equals(post.getId())).toList();
    thread
        .withUpdatedAt(System.currentTimeMillis())
        .withUpdatedBy(userName)
        .withPosts(posts)
        .withPostsCount(posts.size());
    // update the json document
    dao.feedDAO().update(thread.getId(), JsonUtils.pojoToJson(thread));
    return new DeleteResponse<>(post, ENTITY_DELETED);
  }

  @Transaction
  public DeleteResponse<Thread> deleteThread(Thread thread, String deletedByUser) {
    deleteThreadInternal(thread.getId());
    LOG.debug("{} deleted thread with id {}", deletedByUser, thread.getId());
    return new DeleteResponse<>(thread, ENTITY_DELETED);
  }

  @Transaction
  public void deleteThreadInternal(UUID id) {
    // Delete all the relationships to other entities
    dao.relationshipDAO().deleteAll(id, Entity.THREAD);

    // Delete all the field relationships to other entities
    dao.fieldRelationshipDAO().deleteAllByPrefix(id.toString());

    // Finally, delete the thread
    dao.feedDAO().delete(id);
  }

  @Transaction
  public void deleteByAbout(UUID entityId) {
    List<String> threadIds = listOrEmpty(dao.feedDAO().findByEntityId(entityId.toString()));
    for (String threadId : threadIds) {
      try {
        deleteThreadInternal(UUID.fromString(threadId));
      } catch (Exception ex) {
        // Continue deletion
      }
    }
  }

  public List<ThreadCount> getThreadsCount(String link) {
    List<List<String>> result;
    EntityLink entityLink = EntityLink.parse(link);
    List<ThreadCount> threadCounts = new ArrayList<>();
    EntityReference reference = EntityUtil.validateEntityLink(entityLink);
    int mentions;
    if (reference.getType().equals(USER) || reference.getType().equals(Entity.TEAM)) {
      if (reference.getType().equals(USER)) {
        UUID userId = reference.getId();
        User user = Entity.getEntity(USER, userId, TEAMS_FIELD, NON_DELETED);
        List<String> teamIds = getTeamIds(user);
        List<String> teamNames = getTeamNames(user);
        String userTeamJsonMysql = getUserTeamJsonMysql(userId, teamIds);
        List<String> userTeamJsonPostgres = getUserTeamJsonPostgres(userId, teamIds);
        result =
            dao.feedDAO()
                .listCountByOwner(
                    userId, teamIds, user.getName(), userTeamJsonMysql, userTeamJsonPostgres);
        mentions =
            dao.feedDAO()
                .listCountThreadsByMentions(
                    FullyQualifiedName.buildHash(user.getFullyQualifiedName()),
                    teamNames,
                    Relationship.MENTIONED_IN.ordinal(),
                    " where true ");
      } else {
        mentions = 0;
        // team is not supported
        result = new ArrayList<>();
      }
      ThreadCount threadCount = new ThreadCount().withMentionCount(mentions);
      threadCount.setEntityLink(link);
      result.forEach(
          l -> {
            String type = l.get(0);
            String taskStatus = l.get(1);
            int count = Integer.parseInt(l.get(2));
            if (type.equalsIgnoreCase("Conversation")) {
              threadCount.setConversationCount(count);
            } else if (type.equalsIgnoreCase("Task")) {
              if (taskStatus.equals("Open")) {
                threadCount.setOpenTaskCount(count);
              } else if (taskStatus.equals("Closed")) {
                threadCount.setClosedTaskCount(count);
              }
            }
          });
      computeTotalTaskCount(threadCount);
      threadCounts.add(threadCount);
    } else {
      mentions = 0;
      result =
          dao.feedDAO()
              .listCountByEntityLink(
                  reference.getId(),
                  reference.getFullyQualifiedName(),
                  entityLink.getFullyQualifiedFieldType());
      result.forEach(
          l -> {
            ThreadCount threadCount = new ThreadCount().withMentionCount(mentions);
            String eLink = l.get(0);
            String type = l.get(1);
            String taskStatus = l.get(2);
            threadCount.setEntityLink(eLink);
            int count = Integer.parseInt(l.get(3));
            if (type.equalsIgnoreCase("Conversation")) {
              threadCount.setConversationCount(count);
            } else if (type.equalsIgnoreCase("Task")) {
              if (taskStatus.equals("Open")) {
                threadCount.setOpenTaskCount(count);
              } else if (taskStatus.equals("Closed")) {
                threadCount.setClosedTaskCount(count);
              }
            }
            computeTotalTaskCount(threadCount);
            threadCounts.add(threadCount);
          });
    }
    return threadCounts;
  }

  private void computeTotalTaskCount(ThreadCount threadCount) {
    threadCount.setTotalTaskCount(
        (threadCount.getOpenTaskCount() != null ? threadCount.getOpenTaskCount() : 0)
            + (threadCount.getClosedTaskCount() != null ? threadCount.getClosedTaskCount() : 0));
  }

  public List<Post> listPosts(UUID threadId) {
    return get(threadId).getPosts();
  }

  /** List threads based on the filters and limits in the order of the updated timestamp. */
  public ResultList<Thread> list(
      FeedFilter filter, String link, int limitPosts, UUID userId, int limit) {
    int total;
    List<Thread> threads;
    // No filters are enabled. Listing all the threads
    if (link == null && userId == null) {
      // Get one extra result used for computing before cursor
      List<String> jsons = dao.feedDAO().list(limit + 1, filter.getCondition());
      threads = JsonUtils.readObjects(jsons, Thread.class);
      total = dao.feedDAO().listCount(filter.getCondition());
    } else {
      // Either one or both the filters are enabled. We don't support both the filters together.
      // If both are not null, entity link takes precedence
      if (link != null) {
        EntityLink entityLink = EntityLink.parse(link);
        EntityReference reference = EntityUtil.validateEntityLink(entityLink);

        // For a user entityLink get created or replied relationships to the thread
        if (reference.getType().equals(USER)) {
          FilteredThreads filteredThreads = getThreadsByOwner(filter, reference.getId(), limit + 1);
          threads = filteredThreads.threads();
          total = filteredThreads.totalCount();
        } else {
          // Only data assets are added as about
          User user =
              userId != null ? Entity.getEntity(USER, userId, TEAMS_FIELD, NON_DELETED) : null;
          List<String> teamNameHash = getTeamNames(user);
          String userName = user == null ? null : user.getFullyQualifiedName();
          List<String> jsons =
              dao.feedDAO()
                  .listThreadsByEntityLink(
                      filter, entityLink, limit + 1, IS_ABOUT.ordinal(), userName, teamNameHash);
          threads = JsonUtils.readObjects(jsons, Thread.class);
          total =
              dao.feedDAO()
                  .listCountThreadsByEntityLink(
                      filter, entityLink, IS_ABOUT.ordinal(), userName, teamNameHash);
        }
      } else {
        // userId filter present
        FilteredThreads filteredThreads;
        if (ThreadType.Task.equals(filter.getThreadType())) {
          // Only two filter types are supported for tasks -> ASSIGNED_TO, ASSIGNED_BY
          if (FilterType.ASSIGNED_BY.equals(filter.getFilterType())) {
            filteredThreads = getTasksAssignedBy(filter, userId, limit + 1);
          } else if (FilterType.ASSIGNED_TO.equals(filter.getFilterType())) {
            filteredThreads = getTasksAssignedTo(filter, userId, limit + 1);
          } else {
            // Get all the tasks assigned to or created by the user
            filteredThreads = getTasksOfUser(filter, userId, limit + 1);
          }
        } else {
          if (FilterType.FOLLOWS.equals(filter.getFilterType())) {
            filteredThreads = getThreadsByFollows(filter, userId, limit + 1);
          } else if (FilterType.MENTIONS.equals(filter.getFilterType())) {
            filteredThreads = getThreadsByMentions(filter, userId, limit + 1);
          } else if (FilterType.OWNER_OR_FOLLOWS.equals(filter.getFilterType())) {
            filteredThreads = getThreadsByOwnerOrFollows(filter, userId, limit + 1);
          } else {
            filteredThreads = getThreadsByOwner(filter, userId, limit + 1);
          }
        }
        threads = filteredThreads.threads();
        total = filteredThreads.totalCount();
      }
    }
    sortAndLimitPosts(threads, limitPosts);
    populateAssignees(threads);

    String beforeCursor = null;
    String afterCursor = null;
    if (filter.getPaginationType() == PaginationType.BEFORE) {
      if (threads.size()
          > limit) { // If extra result exists, then previous page exists - return before cursor
        threads.remove(0);
        beforeCursor = threads.get(0).getUpdatedAt().toString();
      }
      afterCursor = threads.get(threads.size() - 1).getUpdatedAt().toString();
    } else {
      beforeCursor = filter.getAfter() == null ? null : threads.get(0).getUpdatedAt().toString();
      if (threads.size()
          > limit) { // If extra result exists, then next page exists - return after cursor
        threads.remove(limit);
        afterCursor = threads.get(limit - 1).getUpdatedAt().toString();
      }
    }
    return new ResultList<>(threads, beforeCursor, afterCursor, total);
  }

  @Transaction
  private void storeReactions(Thread thread, String user) {
    // Reactions are captured at the thread level. If the user reacted to a post of a thread,
    // it will still be tracked as "user reacted to thread" since this will only be used to filter
    // threads in the activity feed. Actual reactions are stored in thread.json or post.json itself.
    // Multiple reactions by the same user on same thread or post is handled by
    // field relationship table constraint (primary key)
    dao.fieldRelationshipDAO()
        .insert(
            EntityInterfaceUtil.quoteName(user),
            thread.getId().toString(),
            user,
            thread.getId().toString(),
            USER,
            Entity.THREAD,
            Relationship.REACTED_TO.ordinal(),
            null);
  }

  public final PatchResponse<Post> patchPost(
      Thread thread, Post post, String user, JsonPatch patch) {
    // Apply JSON patch to the original post to get the updated post
    Post updated = JsonUtils.applyPatch(post, patch, Post.class);

    restorePatchAttributes(post, updated);

    // Update the attributes
    populateUserReactions(updated.getReactions());

    // delete the existing post and add the updated post
    List<Post> posts = thread.getPosts();
    posts =
        posts.stream().filter(p -> !p.getId().equals(post.getId())).collect(Collectors.toList());
    posts.add(updated);
    thread.withPosts(posts).withUpdatedAt(System.currentTimeMillis()).withUpdatedBy(user);

    if (!updated.getReactions().isEmpty()) {
      updated
          .getReactions()
          .forEach(reaction -> storeReactions(thread, reaction.getUser().getName()));
    }

    sortPosts(thread);
    EventType change = patchUpdate(thread, post, updated) ? POST_UPDATED : ENTITY_NO_CHANGE;
    return new PatchResponse<>(Status.OK, updated, change);
  }

  public final PatchResponse<Thread> patchThread(
      UriInfo uriInfo, UUID id, String user, JsonPatch patch) {
    // Get all the fields in the original thread that can be updated during PATCH operation
    Thread original = get(id);
    if (original.getTask() != null) {
      List<EntityReference> assignees = original.getTask().getAssignees();
      populateAssignees(original);
      assignees.sort(compareEntityReference);
    }

    // Apply JSON patch to the original thread to get the updated thread
    Thread updated = JsonUtils.applyPatch(original, patch, Thread.class);
    // update the "updatedBy" and "updatedAt" fields
    updated.withUpdatedAt(System.currentTimeMillis()).withUpdatedBy(user);

    restorePatchAttributes(original, updated);

    if (!nullOrEmpty(updated.getReactions())) {
      populateUserReactions(updated.getReactions());
      updated
          .getReactions()
          .forEach(reaction -> storeReactions(updated, reaction.getUser().getName()));
    }

    if (updated.getTask() != null) {
      populateAssignees(updated);
      updated.getTask().getAssignees().sort(compareEntityReference);
    }

    if (updated.getAnnouncement() != null) {
      validateAnnouncement(updated);
    }

    // Update the attributes
    EventType change = patchUpdate(original, updated) ? THREAD_UPDATED : ENTITY_NO_CHANGE;
    sortPosts(updated);
    Thread updatedHref = FeedResource.addHref(uriInfo, updated);
    return new PatchResponse<>(Status.OK, updatedHref, change);
  }

  public void checkPermissionsForResolveTask(
      Thread thread, boolean closeTask, SecurityContext securityContext) {
    String userName = securityContext.getUserPrincipal().getName();
    User user = Entity.getEntityByName(USER, userName, TEAMS_FIELD, NON_DELETED);
    EntityLink about = EntityLink.parse(thread.getAbout());
    EntityReference aboutRef = EntityUtil.validateEntityLink(about);
    if (Boolean.TRUE.equals(user.getIsAdmin())) {
      return; // Allow admin resolve/close task
    }

    // Allow if user is an assignee of the resolve/close task
    // Allow if user is the owner of the resource for which task is created to resolve/close task
    // Allow if user created the task to close task (and not resolve task)
    EntityReference owner = Entity.getOwner(aboutRef);
    List<EntityReference> assignees = thread.getTask().getAssignees();
    if (assignees.stream().anyMatch(assignee -> assignee.getName().equals(userName))
        || owner.getName().equals(userName)
        || closeTask && thread.getCreatedBy().equals(userName)) {
      return;
    }

    // Allow if user belongs to a team that has task assigned to it
    // Allow if user belongs to a team if owner of the resource against which task is created
    List<EntityReference> teams = user.getTeams();
    List<String> teamNames = teams.stream().map(EntityReference::getName).toList();
    if (assignees.stream().anyMatch(assignee -> teamNames.contains(assignee.getName()))
        || teamNames.contains(owner.getName())) {
      return;
    }

    // Finally, operation is not allowed - throw exception
    throw new AuthorizationException(
        CatalogExceptionMessage.taskOperationNotAllowed(
            userName, closeTask ? "closeTask" : "resolveTask"));
  }

  private void validateAnnouncement(Thread thread) {
    long startTime = thread.getAnnouncement().getStartTime();
    long endTime = thread.getAnnouncement().getEndTime();
    if (startTime >= endTime) {
      throw new IllegalArgumentException(ANNOUNCEMENT_INVALID_START_TIME);
    }
    // TODO fix this - overlapping announcements should be allowed
    List<String> announcements =
        dao.feedDAO()
            .listAnnouncementBetween(thread.getId(), thread.getEntityId(), startTime, endTime);
    if (!announcements.isEmpty()) {
      // There is already an announcement that overlaps the new one
      throw new IllegalArgumentException(ANNOUNCEMENT_OVERLAP);
    }
  }

  private void validateAssignee(Thread thread) {
    if (thread != null && ThreadType.Task.equals(thread.getType())) {
      List<EntityReference> assignees = thread.getTask().getAssignees();

      // Assignees can only be user or teams
      assignees.forEach(
          assignee -> {
            if (!assignee.getType().equals(Entity.USER)
                && !assignee.getType().equals(Entity.TEAM)) {
              throw new IllegalArgumentException("Assignees can only be user or teams");
            }
          });

      for (EntityReference ref : assignees) {
        EntityRepository<?> repository = Entity.getEntityRepository(ref.getType());
        if (ref.getType().equals(USER)) {
          User user = (User) repository.get(null, ref.getId(), repository.getFields("id"));
          if (Boolean.TRUE.equals(user.getIsBot())) {
            throw new IllegalArgumentException("Assignees can not be bot");
          }
        }
      }
    }
  }

  private void restorePatchAttributes(Thread original, Thread updated) {
    // Patch can't make changes to following fields. Ignore the changes
    updated.withId(original.getId()).withAbout(original.getAbout()).withType(original.getType());
  }

  private void restorePatchAttributes(Post original, Post updated) {
    // Patch can't make changes to following fields. Ignore the changes
    updated.withId(original.getId()).withPostTs(original.getPostTs()).withFrom(original.getFrom());
  }

  private void populateUserReactions(List<Reaction> reactions) {
    if (!Collections.isEmpty(reactions)) {
      reactions.forEach(
          reaction ->
              reaction.setUser(
                  Entity.getEntityReferenceById(USER, reaction.getUser().getId(), Include.ALL)));
    }
  }

  private boolean patchUpdate(Thread original, Thread updated) {
    // store the updated thread
    // if there is no change, there is no need to apply patch
    if (fieldsChanged(original, updated)) {
      populateUserReactions(updated.getReactions());
      dao.feedDAO().update(updated.getId(), JsonUtils.pojoToJson(updated));
      return true;
    }
    return false;
  }

  private boolean patchUpdate(Thread thread, Post originalPost, Post updatedPost) {
    // store the updated post
    // if there is no change, there is no need to apply patch
    if (fieldsChanged(originalPost, updatedPost)) {
      dao.feedDAO().update(thread.getId(), JsonUtils.pojoToJson(thread));
      return true;
    }
    return false;
  }

  private boolean fieldsChanged(Post original, Post updated) {
    // Patch supports message, and reactions for now
    return !original.getMessage().equals(updated.getMessage())
        || (Collections.isEmpty(original.getReactions())
            && !Collections.isEmpty(updated.getReactions()))
        || (!Collections.isEmpty(original.getReactions())
            && Collections.isEmpty(updated.getReactions()))
        || original.getReactions().size() != updated.getReactions().size()
        || !original.getReactions().containsAll(updated.getReactions());
  }

  private boolean fieldsChanged(Thread original, Thread updated) {
    // Patch supports isResolved, message, task assignees, reactions, and announcements for now
    return !original.getResolved().equals(updated.getResolved())
        || !original.getMessage().equals(updated.getMessage())
        || (Collections.isEmpty(original.getReactions())
            && !Collections.isEmpty(updated.getReactions()))
        || (!Collections.isEmpty(original.getReactions())
            && Collections.isEmpty(updated.getReactions()))
        || (original.getReactions() != null
            && updated.getReactions() != null
            && (original.getReactions().size() != updated.getReactions().size()
                || !original.getReactions().containsAll(updated.getReactions())))
        || (original.getAnnouncement() != null
            && (!original
                    .getAnnouncement()
                    .getDescription()
                    .equals(updated.getAnnouncement().getDescription())
                || !Objects.equals(
                    original.getAnnouncement().getStartTime(),
                    updated.getAnnouncement().getStartTime())
                || !Objects.equals(
                    original.getAnnouncement().getEndTime(),
                    updated.getAnnouncement().getEndTime())))
        || (original.getTask() != null
            && (original.getTask().getAssignees().size() != updated.getTask().getAssignees().size()
                || !original
                    .getTask()
                    .getAssignees()
                    .containsAll(updated.getTask().getAssignees())));
  }

  private void sortPosts(Thread thread) {
    thread.getPosts().sort(Comparator.comparing(Post::getPostTs));
  }

  private void sortPostsInThreads(List<Thread> threads) {
    threads.forEach(this::sortPosts);
  }

  /** Limit the number of posts within each thread to the requested limitPosts. */
  private void sortAndLimitPosts(List<Thread> threads, int limitPosts) {
    for (Thread t : threads) {
      List<Post> posts = t.getPosts();
      sortPosts(t);
      if (posts.size() > limitPosts) {
        // Only keep the last "n" number of posts
        posts = posts.subList(posts.size() - limitPosts, posts.size());
        t.withPosts(posts);
      }
    }
  }

  private String getUserTeamJsonMysql(UUID userId, List<String> teamIds) {
    List<String> result = new ArrayList<>();
    result.add("\"" + userId.toString() + "\"");
    teamIds.forEach(id -> result.add("\"" + id + "\""));
    return result.toString();
  }

  private List<String> getUserTeamJsonPostgres(UUID userId, List<String> teamIds) {
    // Build a list of objects like this for the tasks filter
    // [{"id":"9e78b924-b75c-4141-9845-1b3eb81fdc1b","type":"team"}]','[{"id":"fe21e1ba-ce00-49fa-8b62-3c9a6669a11b","type":"user"}]
    List<String> result = new ArrayList<>();
    JSONObject json = getUserTeamJson(userId, "user");
    result.add(List.of(json.toString()).toString());
    teamIds.forEach(id -> result.add(List.of(getUserTeamJson(id, "team").toString()).toString()));
    return result;
  }

  private JSONObject getUserTeamJson(UUID userId, String type) {
    return new JSONObject().put("id", userId).put("type", type);
  }

  private JSONObject getUserTeamJson(String userId, String type) {
    return new JSONObject().put("id", userId).put("type", type);
  }

  /** Return the tasks assigned to the user. */
  private FilteredThreads getTasksAssignedTo(FeedFilter filter, UUID userId, int limit) {
    List<String> teamIds = getTeamIds(userId);
    List<String> userTeamJsonPostgres = getUserTeamJsonPostgres(userId, teamIds);
    String userTeamJsonMysql = getUserTeamJsonMysql(userId, teamIds);
    List<String> jsons =
        dao.feedDAO()
            .listTasksAssigned(
                userTeamJsonPostgres, userTeamJsonMysql, limit, filter.getCondition());
    List<Thread> threads = JsonUtils.readObjects(jsons, Thread.class);
    int totalCount =
        dao.feedDAO()
            .listCountTasksAssignedTo(
                userTeamJsonPostgres, userTeamJsonMysql, filter.getCondition(false));
    return new FilteredThreads(threads, totalCount);
  }

  private void populateAssignees(List<Thread> threads) {
    threads.forEach(this::populateAssignees);
  }

  private Thread populateAssignees(Thread thread) {
    if (thread != null && ThreadType.Task.equals(thread.getType())) {
      List<EntityReference> assignees = thread.getTask().getAssignees();
      for (EntityReference ref : assignees) {
        try {
          EntityReference ref2 = Entity.getEntityReferenceById(ref.getType(), ref.getId(), ALL);
          EntityUtil.copy(ref2, ref);
        } catch (EntityNotFoundException exception) {
          // mark the not found user as deleted user since
          // user will not be found in case of permanent deletion of user or team
          if (ref.getType().equals(Entity.TEAM)) {
            ref.setName(DELETED_TEAM_NAME);
            ref.setDisplayName(DELETED_TEAM_DISPLAY);
          } else {
            ref.setName(DELETED_USER_NAME);
            ref.setDisplayName(DELETED_USER_DISPLAY);
          }
        }
      }
      assignees.sort(compareEntityReference);
      thread.getTask().setAssignees(assignees);
    }
    return thread;
  }

  /** Return the tasks created by or assigned to the user. */
  private FilteredThreads getTasksOfUser(FeedFilter filter, UUID userId, int limit) {
    String username = Entity.getEntityReferenceById(Entity.USER, userId, NON_DELETED).getName();
    List<String> teamIds = getTeamIds(userId);
    List<String> userTeamJsonPostgres = getUserTeamJsonPostgres(userId, teamIds);
    String userTeamJsonMysql = getUserTeamJsonMysql(userId, teamIds);
    List<String> jsons =
        dao.feedDAO()
            .listTasksOfUser(
                userTeamJsonPostgres, userTeamJsonMysql, username, limit, filter.getCondition());
    List<Thread> threads = JsonUtils.readObjects(jsons, Thread.class);
    int totalCount =
        dao.feedDAO()
            .listCountTasksOfUser(
                userTeamJsonPostgres, userTeamJsonMysql, username, filter.getCondition(false));
    return new FilteredThreads(threads, totalCount);
  }

  /** Return the tasks created by the user. */
  private FilteredThreads getTasksAssignedBy(FeedFilter filter, UUID userId, int limit) {
    String username = Entity.getEntityReferenceById(Entity.USER, userId, NON_DELETED).getName();
    List<String> jsons = dao.feedDAO().listTasksAssigned(username, limit, filter.getCondition());
    List<Thread> threads = JsonUtils.readObjects(jsons, Thread.class);
    int totalCount = dao.feedDAO().listCountTasksAssignedBy(username, filter.getCondition(false));
    return new FilteredThreads(threads, totalCount);
  }

  /**
   * Return the threads associated with user/team owned entities and the threads that were created
   * by or replied to by the user.
   */
  private FilteredThreads getThreadsByOwner(FeedFilter filter, UUID userId, int limit) {
    // add threads on user or team owned entities
    // and threads created by or replied to by the user
    List<String> teamIds = getTeamIds(userId);
    List<String> jsons =
        dao.feedDAO().listThreadsByOwner(userId, teamIds, limit, filter.getCondition());
    List<Thread> threads = JsonUtils.readObjects(jsons, Thread.class);
    int totalCount =
        dao.feedDAO().listCountThreadsByOwner(userId, teamIds, filter.getCondition(false));
    return new FilteredThreads(threads, totalCount);
  }

  /**
   * Returns the threads where the user or the team they belong to were mentioned by other users
   * with @mention.
   */
  private FilteredThreads getThreadsByMentions(FeedFilter filter, UUID userId, int limit) {
    User user = Entity.getEntity(Entity.USER, userId, TEAMS_FIELD, NON_DELETED);
    String userNameHash = getUserNameHash(user);
    // Return the threads where the user or team was mentioned
    List<String> teamNamesHash = getTeamNames(user);

    // Return the threads where the user or team was mentioned
    List<String> jsons =
        dao.feedDAO()
            .listThreadsByMentions(
                userNameHash,
                teamNamesHash,
                limit,
                Relationship.MENTIONED_IN.ordinal(),
                filter.getCondition());
    List<Thread> threads = JsonUtils.readObjects(jsons, Thread.class);
    int totalCount =
        dao.feedDAO()
            .listCountThreadsByMentions(
                userNameHash,
                teamNamesHash,
                Relationship.MENTIONED_IN.ordinal(),
                filter.getCondition(false));
    return new FilteredThreads(threads, totalCount);
  }

  /** Get a list of team ids that the given user is a part of. */
  private List<String> getTeamIds(UUID userId) {
    List<String> teamIds = null;
    if (userId != null) {
      User user = Entity.getEntity(Entity.USER, userId, TEAMS_FIELD, NON_DELETED);
      teamIds = getTeamIds(user);
    }
    return nullOrEmpty(teamIds) ? List.of(StringUtils.EMPTY) : teamIds;
  }

  private List<String> getTeamIds(User user) {
    List<String> teamIds =
        listOrEmpty(user.getTeams()).stream().map(ref -> ref.getId().toString()).toList();
    return nullOrEmpty(teamIds) ? List.of(StringUtils.EMPTY) : teamIds;
  }

  /** Returns the threads that are associated with the entities followed by the user. */
  private FilteredThreads getThreadsByFollows(FeedFilter filter, UUID userId, int limit) {
    List<String> teamIds = getTeamIds(userId);
    List<String> jsons =
        dao.feedDAO()
            .listThreadsByFollows(
                userId, teamIds, limit, Relationship.FOLLOWS.ordinal(), filter.getCondition());
    List<Thread> threads = JsonUtils.readObjects(jsons, Thread.class);
    int totalCount =
        dao.feedDAO()
            .listCountThreadsByFollows(
                userId, teamIds, Relationship.FOLLOWS.ordinal(), filter.getCondition());
    return new FilteredThreads(threads, totalCount);
  }

  private FilteredThreads getThreadsByOwnerOrFollows(FeedFilter filter, UUID userId, int limit) {
    List<String> teamIds = getTeamIds(userId);
    List<String> jsons =
        dao.feedDAO().listThreadsByOwnerOrFollows(userId, teamIds, limit, filter.getCondition());
    List<Thread> threads = JsonUtils.readObjects(jsons, Thread.class);
    int totalCount =
        dao.feedDAO().listCountThreadsByOwnerOrFollows(userId, teamIds, filter.getCondition());
    return new FilteredThreads(threads, totalCount);
  }

  /** Get a list of team names that the given user is a part of. */
  private List<String> getTeamNames(User user) {
    List<String> teamNames = null;
    if (user != null) {
      teamNames =
          listOrEmpty(user.getTeams()).stream()
              .map(x -> FullyQualifiedName.buildHash(x.getFullyQualifiedName()))
              .toList();
    }
    return nullOrEmpty(teamNames) ? List.of(StringUtils.EMPTY) : teamNames;
  }

  private String getUserNameHash(User user) {
    return user != null ? FullyQualifiedName.buildHash(user.getFullyQualifiedName()) : null;
  }

  public static String resolveDescriptionTaskMessage(TaskDetails task) {
    return String.format(
        "Resolved the Task with Description - %s",
        FEED_MESSAGE_FORMATTER.getPlaintextDiff(task.getOldValue(), task.getNewValue()));
  }

  public static String resolveTagTaskMessage(TaskDetails task) {
    String oldValue =
        task.getOldValue() != null
            ? getTagFQNs(JsonUtils.readObjects(task.getOldValue(), TagLabel.class))
            : StringUtils.EMPTY;
    String newValue = getTagFQNs(JsonUtils.readObjects(task.getNewValue(), TagLabel.class));
    return String.format(
        "Resolved the Task with Tag(s) - %s",
        FEED_MESSAGE_FORMATTER.getPlaintextDiff(oldValue, newValue));
  }

  public static String closeTaskMessage(String closingComment) {
    return String.format("Closed the Task with comment - %s", closingComment);
  }

  public record FilteredThreads(List<Thread> threads, int totalCount) {}
}
