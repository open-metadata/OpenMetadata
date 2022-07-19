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

package org.openmetadata.catalog.jdbi3;

import static org.openmetadata.catalog.Entity.DASHBOARD;
import static org.openmetadata.catalog.Entity.PIPELINE;
import static org.openmetadata.catalog.Entity.TABLE;
import static org.openmetadata.catalog.Entity.TOPIC;
import static org.openmetadata.catalog.Entity.getEntityRepository;
import static org.openmetadata.catalog.type.Include.ALL;
import static org.openmetadata.catalog.type.Relationship.ADDRESSED_TO;
import static org.openmetadata.catalog.type.Relationship.CREATED;
import static org.openmetadata.catalog.type.Relationship.IS_ABOUT;
import static org.openmetadata.catalog.type.Relationship.REPLIED_TO;
import static org.openmetadata.catalog.util.ChangeEventParser.getPlaintextDiff;
import static org.openmetadata.catalog.util.EntityUtil.compareEntityReference;
import static org.openmetadata.catalog.util.EntityUtil.populateEntityReferences;
import static org.openmetadata.catalog.util.RestUtil.DELETED_USER_DISPLAY;
import static org.openmetadata.catalog.util.RestUtil.DELETED_USER_NAME;

import com.fasterxml.jackson.core.JsonProcessingException;
import io.jsonwebtoken.lang.Collections;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import javax.json.JsonPatch;
import javax.ws.rs.core.Response.Status;
import javax.ws.rs.core.UriInfo;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.json.JSONObject;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.feed.CloseTask;
import org.openmetadata.catalog.api.feed.EntityLinkThreadCount;
import org.openmetadata.catalog.api.feed.ResolveTask;
import org.openmetadata.catalog.api.feed.ThreadCount;
import org.openmetadata.catalog.entity.data.Dashboard;
import org.openmetadata.catalog.entity.data.Pipeline;
import org.openmetadata.catalog.entity.data.Table;
import org.openmetadata.catalog.entity.data.Topic;
import org.openmetadata.catalog.entity.feed.Thread;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.exception.EntityNotFoundException;
import org.openmetadata.catalog.jdbi3.CollectionDAO.EntityRelationshipRecord;
import org.openmetadata.catalog.resources.feeds.FeedResource;
import org.openmetadata.catalog.resources.feeds.FeedUtil;
import org.openmetadata.catalog.resources.feeds.MessageParser;
import org.openmetadata.catalog.resources.feeds.MessageParser.EntityLink;
import org.openmetadata.catalog.type.Column;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.Include;
import org.openmetadata.catalog.type.Post;
import org.openmetadata.catalog.type.Reaction;
import org.openmetadata.catalog.type.Relationship;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.type.Task;
import org.openmetadata.catalog.type.TaskDetails;
import org.openmetadata.catalog.type.TaskStatus;
import org.openmetadata.catalog.type.TaskType;
import org.openmetadata.catalog.type.ThreadType;
import org.openmetadata.catalog.util.*;
import org.openmetadata.catalog.util.RestUtil.DeleteResponse;
import org.openmetadata.catalog.util.RestUtil.PatchResponse;

@Slf4j
public class FeedRepository {
  private final CollectionDAO dao;

  public FeedRepository(CollectionDAO dao) {
    this.dao = dao;
  }

  public enum FilterType {
    OWNER,
    MENTIONS,
    FOLLOWS,
    ASSIGNED_TO,
    ASSIGNED_BY
  }

  public enum PaginationType {
    BEFORE,
    AFTER
  }

  @Transaction
  public int getNextTaskId() {
    dao.feedDAO().updateTaskId();
    return dao.feedDAO().getTaskId();
  }

  @Transaction
  public Thread create(Thread thread, UUID entityId, EntityReference entityOwner, EntityLink about) throws IOException {

    String createdBy = thread.getCreatedBy();

    // Validate user creating thread
    User createdByUser = dao.userDAO().findEntityByName(createdBy);

    // Add entity id to thread
    thread.withEntityId(entityId);

    // if thread is of type "task", assign a taskId
    if (thread.getType().equals(ThreadType.Task)) {
      thread.withTask(thread.getTask().withId(getNextTaskId()));
    }

    // Insert a new thread
    dao.feedDAO().insert(JsonUtils.pojoToJson(thread));

    // Add relationship User -- created --> Thread relationship
    dao.relationshipDAO().insert(createdByUser.getId(), thread.getId(), Entity.USER, Entity.THREAD, CREATED.ordinal());

    // Add field relationship data asset Thread -- isAbout ---> entity/entityField
    // relationship
    dao.fieldRelationshipDAO()
        .insert(
            thread.getId().toString(), // from FQN
            about.getFullyQualifiedFieldValue(), // to FQN
            Entity.THREAD, // From type
            about.getFullyQualifiedFieldType(), // to Type
            IS_ABOUT.ordinal(),
            null);

    // Add the owner also as addressedTo as the entity he owns when addressed, the owner is actually being addressed
    if (entityOwner != null) {
      dao.relationshipDAO()
          .insert(thread.getId(), entityOwner.getId(), Entity.THREAD, entityOwner.getType(), ADDRESSED_TO.ordinal());
    }

    // Add mentions to field relationship table
    storeMentions(thread, thread.getMessage());

    return thread;
  }

  @Transaction
  public Thread create(Thread thread) throws IOException {
    // Validate about data entity is valid
    EntityLink about = EntityLink.parse(thread.getAbout());
    EntityReference aboutRef = EntityUtil.validateEntityLink(about);

    // Get owner for the addressed to Entity
    EntityReference owner = Entity.getOwner(aboutRef);

    UUID entityId = aboutRef.getId();

    return create(thread, entityId, owner, about);
  }

  public Thread get(String id) throws IOException {
    Thread thread = EntityUtil.validate(id, dao.feedDAO().findById(id), Thread.class);
    sortPosts(thread);
    return thread;
  }

  public Thread getTask(Integer id) throws IOException {
    Thread task = EntityUtil.validate(id.toString(), dao.feedDAO().findByTaskId(id), Thread.class);
    sortPosts(task);
    return populateAssignees(task);
  }

  public PatchResponse<Thread> closeTask(UriInfo uriInfo, Thread thread, String user, CloseTask closeTask)
      throws IOException {
    // Update the attributes
    closeTask(thread, user, closeTask.getComment());
    Thread updatedHref = FeedResource.addHref(uriInfo, thread);
    return new PatchResponse<>(Status.OK, updatedHref, RestUtil.ENTITY_UPDATED);
  }

  private void performTask(
      TaskDetails task, EntityLink entityLink, EntityReference reference, UriInfo uriInfo, String newValue, String user)
      throws IOException {
    TaskType taskType = task.getType();
    List<TaskType> descriptionTasks = List.of(TaskType.RequestDescription, TaskType.UpdateDescription);
    List<TaskType> tagTasks = List.of(TaskType.RequestTag, TaskType.UpdateTag);
    List<TaskType> supportedTasks =
        Stream.concat(descriptionTasks.stream(), tagTasks.stream()).collect(Collectors.toList());
    // task needs to be completed only for Request or update description or tags.
    if (supportedTasks.contains(taskType)) {
      EntityRepository<?> repository = getEntityRepository(reference.getType());
      String json = repository.dao.findJsonByFqn(entityLink.getEntityFQN(), Include.ALL);
      switch (entityLink.getEntityType()) {
        case TABLE:
          Table table = JsonUtils.readValue(json, Table.class);
          String oldJson = JsonUtils.pojoToJson(table);
          if (entityLink.getFieldName() != null) {
            if (entityLink.getFieldName().equals("columns")) {
              Optional<Column> col =
                  table.getColumns().stream()
                      .filter(c -> c.getName().equals(entityLink.getArrayFieldName()))
                      .findFirst();
              if (col.isPresent()) {
                Column column = col.get();
                if (descriptionTasks.contains(taskType)) {
                  column.setDescription(newValue);
                } else if (tagTasks.contains(taskType)) {
                  List<TagLabel> tags = JsonUtils.readObjects(newValue, TagLabel.class);
                  column.setTags(tags);
                }
              } else {
                throw new IllegalArgumentException(
                    String.format(
                        "The Column with name '%s' is not found in the table.", entityLink.getArrayFieldName()));
              }
            } else if (descriptionTasks.contains(taskType) && entityLink.getFieldName().equals("description")) {
              table.setDescription(newValue);
            } else if (tagTasks.contains(taskType) && entityLink.getFieldName().equals("tags")) {
              List<TagLabel> tags = JsonUtils.readObjects(newValue, TagLabel.class);
              table.setTags(tags);
            } else {
              // Not supported
              throw new IllegalArgumentException(
                  String.format(
                      "The field name %s is not supported for %s task.", entityLink.getFieldName(), task.getType()));
            }
          } else {
            // Not supported
            throw new IllegalArgumentException(
                String.format(
                    "The Entity link with no field name - %s is not supported for %s task.",
                    entityLink, task.getType()));
          }
          String updatedEntityJson = JsonUtils.pojoToJson(table);
          JsonPatch patch = JsonUtils.getJsonPatch(oldJson, updatedEntityJson);
          repository.patch(uriInfo, table.getId(), user, patch);
          break;
        case TOPIC:
          Topic topic = JsonUtils.readValue(json, Topic.class);
          oldJson = JsonUtils.pojoToJson(topic);
          if (descriptionTasks.contains(taskType) && entityLink.getFieldName().equals("description")) {
            topic.setDescription(newValue);
          } else if (tagTasks.contains(taskType) && entityLink.getFieldName().equals("tags")) {
            List<TagLabel> tags = JsonUtils.readObjects(newValue, TagLabel.class);
            topic.setTags(tags);
          } else {
            // Not supported
            throw new IllegalArgumentException(
                String.format(
                    "The field name %s is not supported for %s task.", entityLink.getFieldName(), task.getType()));
          }
          updatedEntityJson = JsonUtils.pojoToJson(topic);
          patch = JsonUtils.getJsonPatch(oldJson, updatedEntityJson);
          repository.patch(uriInfo, topic.getId(), user, patch);
          break;
        case DASHBOARD:
          Dashboard dashboard = JsonUtils.readValue(json, Dashboard.class);
          oldJson = JsonUtils.pojoToJson(dashboard);
          if (descriptionTasks.contains(taskType) && entityLink.getFieldName().equals("description")) {
            dashboard.setDescription(newValue);
          } else if (entityLink.getFieldName().equals("charts")) {
            Optional<EntityReference> ch =
                dashboard.getCharts().stream()
                    .filter(c -> c.getName().equals(entityLink.getArrayFieldName()))
                    .findFirst();
            if (ch.isPresent()) {
              EntityReference chart = ch.get();
              if (descriptionTasks.contains(taskType)) {
                chart.setDescription(newValue);
              }
            } else {
              throw new IllegalArgumentException(
                  String.format(
                      "The Chart with name '%s' is not found in the dashboard.", entityLink.getArrayFieldName()));
            }
          } else {
            // Not supported
            throw new IllegalArgumentException(
                String.format(
                    "The field name %s is not supported for %s task.", entityLink.getFieldName(), task.getType()));
          }
          updatedEntityJson = JsonUtils.pojoToJson(dashboard);
          patch = JsonUtils.getJsonPatch(oldJson, updatedEntityJson);
          repository.patch(uriInfo, dashboard.getId(), user, patch);
          break;
        case PIPELINE:
          Pipeline pipeline = JsonUtils.readValue(json, Pipeline.class);
          oldJson = JsonUtils.pojoToJson(pipeline);
          if (descriptionTasks.contains(taskType) && entityLink.getFieldName().equals("description")) {
            pipeline.setDescription(newValue);
          } else if (entityLink.getFieldName().equals("tasks")) {
            Optional<Task> tsk =
                pipeline.getTasks().stream()
                    .filter(c -> c.getName().equals(entityLink.getArrayFieldName()))
                    .findFirst();
            if (tsk.isPresent()) {
              Task pipelineTask = tsk.get();
              if (descriptionTasks.contains(taskType)) {
                pipelineTask.setDescription(newValue);
              } else if (tagTasks.contains(taskType)) {
                List<TagLabel> tags = JsonUtils.readObjects(newValue, TagLabel.class);
                pipelineTask.setTags(tags);
              }
            } else {
              throw new IllegalArgumentException(
                  String.format(
                      "The Task with name '%s' is not found in the pipeline.", entityLink.getArrayFieldName()));
            }
          } else {
            // Not supported
            throw new IllegalArgumentException(
                String.format(
                    "The field name %s is not supported for %s task.", entityLink.getFieldName(), task.getType()));
          }
          updatedEntityJson = JsonUtils.pojoToJson(pipeline);
          patch = JsonUtils.getJsonPatch(oldJson, updatedEntityJson);
          repository.patch(uriInfo, pipeline.getId(), user, patch);
          break;
        default:
          break;
      }
    }
  }

  public PatchResponse<Thread> resolveTask(UriInfo uriInfo, Thread thread, String user, ResolveTask resolveTask)
      throws IOException {
    // perform the task
    TaskDetails task = thread.getTask();
    EntityLink entityLink = EntityLink.parse(thread.getAbout());
    EntityReference reference = EntityUtil.validateEntityLink(entityLink);
    performTask(task, entityLink, reference, uriInfo, resolveTask.getNewValue(), user);

    // Update the attributes
    task.withNewValue(resolveTask.getNewValue());
    closeTask(thread, user, null);
    Thread updatedHref = FeedResource.addHref(uriInfo, thread);
    return new PatchResponse<>(Status.OK, updatedHref, RestUtil.ENTITY_UPDATED);
  }

  private String getTagFQNs(List<TagLabel> tags) {
    return tags.stream().map(TagLabel::getTagFQN).collect(Collectors.joining(", "));
  }

  private void addClosingPost(Thread thread, String user, String closingComment) throws IOException {
    // Add a post to the task
    String message;
    if (closingComment != null) {
      message = String.format("Closed the Task with comment - %s", closingComment);
    } else {
      // The task was resolved with an update.
      // Add a default message to the Task thread with updated description/tag
      TaskDetails task = thread.getTask();
      TaskType type = task.getType();
      String oldValue = StringUtils.EMPTY;
      if (List.of(TaskType.RequestDescription, TaskType.UpdateDescription).contains(type)) {
        if (task.getOldValue() != null) {
          oldValue = task.getOldValue();
        }
        message =
            String.format(
                "Resolved the Task with Description - %s",
                getPlaintextDiff(ChangeEventParser.PUBLISH_TO.FEED, oldValue, task.getNewValue()));
      } else if (List.of(TaskType.RequestTag, TaskType.UpdateTag).contains(type)) {
        List<TagLabel> tags;
        if (task.getOldValue() != null) {
          tags = JsonUtils.readObjects(task.getOldValue(), TagLabel.class);
          oldValue = getTagFQNs(tags);
        }
        tags = JsonUtils.readObjects(task.getNewValue(), TagLabel.class);
        String newValue = getTagFQNs(tags);
        message =
            String.format(
                "Resolved the Task with Tag(s) - %s",
                getPlaintextDiff(ChangeEventParser.PUBLISH_TO.FEED, oldValue, newValue));
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
    try {
      addPostToThread(thread.getId().toString(), post, user);
    } catch (IOException exception) {
      LOG.error("Unable to post a reply to the Task upon closing.", exception);
    }
  }

  private void closeTask(Thread thread, String user, String closingComment) throws IOException {
    TaskDetails task = thread.getTask();
    task.withStatus(TaskStatus.Closed).withClosedBy(user).withClosedAt(System.currentTimeMillis());
    thread.withTask(task).withUpdatedBy(user).withUpdatedAt(System.currentTimeMillis());

    dao.feedDAO().update(thread.getId().toString(), JsonUtils.pojoToJson(thread));
    addClosingPost(thread, user, closingComment);
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
                        mention.getFullyQualifiedFieldType(),
                        Entity.THREAD,
                        Relationship.MENTIONED_IN.ordinal(),
                        null));
  }

  @Transaction
  public Thread addPostToThread(String id, Post post, String userName) throws IOException {
    // Query 1 - validate the user posting the message
    User fromUser = dao.userDAO().findEntityByName(post.getFrom());

    // Query 2 - Find the thread
    Thread thread = EntityUtil.validate(id, dao.feedDAO().findById(id), Thread.class);
    thread.withUpdatedBy(userName).withUpdatedAt(System.currentTimeMillis());
    FeedUtil.addPost(thread, post);

    // TODO is rewriting entire json okay?
    // Query 3 - update the JSON document for the feed
    dao.feedDAO().update(id, JsonUtils.pojoToJson(thread));

    // Query 4 - Add relation User -- repliedTo --> Thread
    // Add relationship from thread to the user entity that is posting a reply
    boolean relationAlreadyExists = false;
    for (Post p : thread.getPosts()) {
      if (p.getFrom().equals(post.getFrom())) {
        relationAlreadyExists = true;
        break;
      }
    }
    if (!relationAlreadyExists) {
      dao.relationshipDAO().insert(fromUser.getId(), thread.getId(), Entity.USER, Entity.THREAD, REPLIED_TO.ordinal());
    }

    // Add mentions into field relationship table
    storeMentions(thread, post.getMessage());

    sortPostsInThreads(List.of(thread));

    return thread;
  }

  public Post getPostById(Thread thread, String postId) {
    Optional<Post> post = thread.getPosts().stream().filter(p -> p.getId().equals(UUID.fromString(postId))).findAny();
    if (post.isEmpty()) {
      throw EntityNotFoundException.byMessage(CatalogExceptionMessage.entityNotFound("Post", postId));
    }
    return post.get();
  }

  @Transaction
  public DeleteResponse<Post> deletePost(Thread thread, Post post, String userName) throws IOException {
    List<Post> posts = thread.getPosts();
    // Remove the post to be deleted from the posts list
    posts = posts.stream().filter(p -> !p.getId().equals(post.getId())).collect(Collectors.toList());
    thread
        .withUpdatedAt(System.currentTimeMillis())
        .withUpdatedBy(userName)
        .withPosts(posts)
        .withPostsCount(posts.size());
    // update the json document
    dao.feedDAO().update(thread.getId().toString(), JsonUtils.pojoToJson(thread));

    return new DeleteResponse<>(post, RestUtil.ENTITY_DELETED);
  }

  public EntityReference getOwnerOfPost(Post post) {
    User fromUser = dao.userDAO().findEntityByName(post.getFrom());
    return fromUser.getEntityReference();
  }

  @Transaction
  public ThreadCount getThreadsCount(String link, ThreadType type, TaskStatus taskStatus, boolean isResolved) {
    ThreadCount threadCount = new ThreadCount();
    List<List<String>> result;
    List<EntityLinkThreadCount> entityLinkThreadCounts = new ArrayList<>();
    AtomicInteger totalCount = new AtomicInteger(0);
    if (link == null) {
      // Get thread count of all entities
      result =
          dao.feedDAO()
              .listCountByEntityLink(null, Entity.THREAD, null, IS_ABOUT.ordinal(), type, taskStatus, isResolved);
    } else {
      EntityLink entityLink = EntityLink.parse(link);
      EntityReference reference = EntityUtil.validateEntityLink(entityLink);
      if (reference.getType().equals(Entity.USER) || reference.getType().equals(Entity.TEAM)) {
        if (reference.getType().equals(Entity.USER)) {
          String userId = reference.getId().toString();
          List<String> teamIds = getTeamIds(userId);
          result = dao.feedDAO().listCountByOwner(userId, teamIds, type, isResolved);
        } else {
          // team is not supported
          result = new ArrayList<>();
        }
      } else {
        result =
            dao.feedDAO()
                .listCountByEntityLink(
                    entityLink.getFullyQualifiedFieldValue(),
                    Entity.THREAD,
                    entityLink.getFullyQualifiedFieldType(),
                    IS_ABOUT.ordinal(),
                    type,
                    taskStatus,
                    isResolved);
      }
    }
    result.forEach(
        l -> {
          int count = Integer.parseInt(l.get(1));
          entityLinkThreadCounts.add(new EntityLinkThreadCount().withEntityLink(l.get(0)).withCount(count));
          totalCount.addAndGet(count);
        });
    threadCount.withTotalCount(totalCount.get());
    threadCount.withCounts(entityLinkThreadCounts);
    return threadCount;
  }

  public List<Post> listPosts(String threadId) throws IOException {
    Thread thread = get(threadId);
    return thread.getPosts();
  }

  /** List threads based on the filters and limits in the order of the updated timestamp. */
  @Transaction
  public final ResultList<Thread> list(
      String link,
      int limitPosts,
      String userId,
      FilterType filterType,
      int limit,
      String pageMarker,
      boolean isResolved,
      PaginationType paginationType,
      ThreadType threadType,
      TaskStatus taskStatus)
      throws IOException {
    List<Thread> threads;
    int total;
    // Here updatedAt time is used for page marker since threads are sorted by last update time
    long time = Long.MAX_VALUE;
    // if paginationType is "before", it must have a pageMarker time.
    // "after" could be null to get the first page. In this case we set time to MAX_VALUE
    // to get any entry with updatedTime < MAX_VALUE
    if (pageMarker != null) {
      time = Long.parseLong(RestUtil.decodeCursor(pageMarker));
    }

    // No filters are enabled. Listing all the threads
    if (link == null && userId == null) {
      // Get one extra result used for computing before cursor
      List<String> jsons;
      if (paginationType == PaginationType.BEFORE) {
        jsons = dao.feedDAO().listBefore(limit + 1, time, taskStatus, isResolved, threadType);
      } else {
        jsons = dao.feedDAO().listAfter(limit + 1, time, taskStatus, isResolved, threadType);
      }
      threads = JsonUtils.readObjects(jsons, Thread.class);
      total = dao.feedDAO().listCount(taskStatus, isResolved, threadType);
    } else {
      // Either one or both the filters are enabled
      // we don't support both the filters together. If both are not null, entity link takes precedence

      if (link != null) {
        EntityLink entityLink = EntityLink.parse(link);
        EntityReference reference = EntityUtil.validateEntityLink(entityLink);

        // For a user entityLink get created or replied relationships to the thread
        if (reference.getType().equals(Entity.USER)) {
          FilteredThreads filteredThreads =
              getThreadsByOwner(reference.getId().toString(), limit + 1, time, threadType, isResolved, paginationType);
          threads = filteredThreads.getThreads();
          total = filteredThreads.getTotalCount();
        } else {
          // Only data assets are added as about
          List<String> jsons;
          if (paginationType == PaginationType.BEFORE) {
            jsons =
                dao.feedDAO()
                    .listThreadsByEntityLinkBefore(
                        entityLink.getFullyQualifiedFieldValue(),
                        entityLink.getFullyQualifiedFieldType(),
                        limit + 1,
                        time,
                        threadType,
                        taskStatus,
                        isResolved,
                        IS_ABOUT.ordinal());
          } else {
            jsons =
                dao.feedDAO()
                    .listThreadsByEntityLinkAfter(
                        entityLink.getFullyQualifiedFieldValue(),
                        entityLink.getFullyQualifiedFieldType(),
                        limit + 1,
                        time,
                        threadType,
                        taskStatus,
                        isResolved,
                        IS_ABOUT.ordinal());
          }
          threads = JsonUtils.readObjects(jsons, Thread.class);
          total =
              dao.feedDAO()
                  .listCountThreadsByEntityLink(
                      entityLink.getFullyQualifiedFieldValue(),
                      entityLink.getFullyQualifiedFieldType(),
                      threadType,
                      taskStatus,
                      isResolved,
                      IS_ABOUT.ordinal());
        }
      } else {
        // userId filter present
        FilteredThreads filteredThreads;
        if (ThreadType.Task.equals(threadType)) {
          // Only two filter types are supported for tasks -> ASSIGNED_TO, ASSIGNED_BY
          if (filterType == FilterType.ASSIGNED_BY) {
            filteredThreads = getTasksAssignedBy(userId, limit + 1, time, taskStatus, paginationType);
          } else {
            // make ASSIGNED_TO a default filter
            filteredThreads = getTasksAssignedTo(userId, limit + 1, time, taskStatus, paginationType);
          }
        } else {
          if (filterType == FilterType.FOLLOWS) {
            filteredThreads = getThreadsByFollows(userId, limit + 1, time, threadType, isResolved, paginationType);
          } else if (filterType == FilterType.MENTIONS) {
            filteredThreads = getThreadsByMentions(userId, limit + 1, time, threadType, isResolved, paginationType);
          } else {
            filteredThreads = getThreadsByOwner(userId, limit + 1, time, threadType, isResolved, paginationType);
          }
        }
        threads = filteredThreads.getThreads();
        total = filteredThreads.getTotalCount();
      }
    }
    limitPostsInThreads(threads, limitPosts);
    populateAssignees(threads);

    String beforeCursor = null;
    String afterCursor = null;
    if (paginationType == PaginationType.BEFORE) {
      if (threads.size() > limit) { // If extra result exists, then previous page exists - return before cursor
        threads.remove(0);
        beforeCursor = threads.get(0).getUpdatedAt().toString();
      }
      afterCursor = threads.get(threads.size() - 1).getUpdatedAt().toString();
    } else {
      beforeCursor = pageMarker == null ? null : threads.get(0).getUpdatedAt().toString();
      if (threads.size() > limit) { // If extra result exists, then next page exists - return after cursor
        threads.remove(limit);
        afterCursor = threads.get(limit - 1).getUpdatedAt().toString();
      }
    }
    return new ResultList<>(threads, beforeCursor, afterCursor, total);
  }

  private void storeReactions(Thread thread, String user) {
    // Reactions are captured at the thread level. If the user reacted to a post of a thread,
    // it will still be tracked as "user reacted to thread" since this will only be used to filter
    // threads in the activity feed. Actual reactions are stored in thread.json or post.json itself.
    // Multiple reactions by the same user on same thread or post is handled by
    // field relationship table constraint (primary key)
    dao.fieldRelationshipDAO()
        .insert(user, thread.getId().toString(), Entity.USER, Entity.THREAD, Relationship.REACTED_TO.ordinal(), null);
  }

  @Transaction
  public final PatchResponse<Post> patchPost(Thread thread, Post post, String user, JsonPatch patch)
      throws IOException {
    // Apply JSON patch to the original post to get the updated post
    Post updated = JsonUtils.applyPatch(post, patch, Post.class);

    restorePatchAttributes(post, updated);

    // Update the attributes
    populateUserReactions(updated.getReactions());

    // delete the existing post and add the updated post
    List<Post> posts = thread.getPosts();
    posts = posts.stream().filter(p -> !p.getId().equals(post.getId())).collect(Collectors.toList());
    posts.add(updated);
    thread.withPosts(posts).withUpdatedAt(System.currentTimeMillis()).withUpdatedBy(user);

    if (!updated.getReactions().isEmpty()) {
      updated.getReactions().forEach(reaction -> storeReactions(thread, reaction.getUser().getName()));
    }

    sortPosts(thread);
    String change = patchUpdate(thread, post, updated) ? RestUtil.ENTITY_UPDATED : RestUtil.ENTITY_NO_CHANGE;
    return new PatchResponse<>(Status.OK, updated, change);
  }

  @Transaction
  public final PatchResponse<Thread> patchThread(UriInfo uriInfo, UUID id, String user, JsonPatch patch)
      throws IOException {
    // Get all the fields in the original thread that can be updated during PATCH operation
    Thread original = get(id.toString());
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

    if (!updated.getReactions().isEmpty()) {
      populateUserReactions(updated.getReactions());
      updated.getReactions().forEach(reaction -> storeReactions(updated, reaction.getUser().getName()));
    }

    if (updated.getTask() != null) {
      populateAssignees(updated);
      updated.getTask().getAssignees().sort(compareEntityReference);
    }

    // Update the attributes
    String change = patchUpdate(original, updated) ? RestUtil.ENTITY_UPDATED : RestUtil.ENTITY_NO_CHANGE;
    sortPosts(updated);
    Thread updatedHref = FeedResource.addHref(uriInfo, updated);
    return new PatchResponse<>(Status.OK, updatedHref, change);
  }

  private void restorePatchAttributes(Thread original, Thread updated) {
    // Patch can't make changes to following fields. Ignore the changes
    updated.withId(original.getId()).withAbout(original.getAbout());
  }

  private void restorePatchAttributes(Post original, Post updated) {
    // Patch can't make changes to following fields. Ignore the changes
    updated.withId(original.getId()).withPostTs(original.getPostTs()).withFrom(original.getFrom());
  }

  private void populateUserReactions(List<Reaction> reactions) {
    if (!Collections.isEmpty(reactions)) {
      reactions.forEach(
          reaction -> {
            try {
              reaction.setUser(Entity.getEntityReferenceById(Entity.USER, reaction.getUser().getId(), Include.ALL));
            } catch (IOException e) {
              throw new RuntimeException(e);
            }
          });
    }
  }

  private boolean patchUpdate(Thread original, Thread updated) throws JsonProcessingException {
    // store the updated thread
    // if there is no change, there is no need to apply patch
    if (fieldsChanged(original, updated)) {
      populateUserReactions(updated.getReactions());
      dao.feedDAO().update(updated.getId().toString(), JsonUtils.pojoToJson(updated));
      return true;
    }
    return false;
  }

  private boolean patchUpdate(Thread thread, Post originalPost, Post updatedPost) throws JsonProcessingException {
    // store the updated post
    // if there is no change, there is no need to apply patch
    if (fieldsChanged(originalPost, updatedPost)) {
      dao.feedDAO().update(thread.getId().toString(), JsonUtils.pojoToJson(thread));
      return true;
    }
    return false;
  }

  private boolean fieldsChanged(Post original, Post updated) {
    // Patch supports message, and reactions for now
    return !original.getMessage().equals(updated.getMessage())
        || (Collections.isEmpty(original.getReactions()) && !Collections.isEmpty(updated.getReactions()))
        || (!Collections.isEmpty(original.getReactions()) && Collections.isEmpty(updated.getReactions()))
        || original.getReactions().size() != updated.getReactions().size()
        || !original.getReactions().containsAll(updated.getReactions());
  }

  private boolean fieldsChanged(Thread original, Thread updated) {
    // Patch supports isResolved, message, task assignees, and reactions for now
    return !original.getResolved().equals(updated.getResolved())
        || !original.getMessage().equals(updated.getMessage())
        || (Collections.isEmpty(original.getReactions()) && !Collections.isEmpty(updated.getReactions()))
        || (!Collections.isEmpty(original.getReactions()) && Collections.isEmpty(updated.getReactions()))
        || original.getReactions().size() != updated.getReactions().size()
        || !original.getReactions().containsAll(updated.getReactions())
        || (original.getTask() != null
            && (original.getTask().getAssignees().size() != updated.getTask().getAssignees().size()
                || !original.getTask().getAssignees().containsAll(updated.getTask().getAssignees())));
  }

  private void sortPosts(Thread thread) {
    thread.getPosts().sort(Comparator.comparing(Post::getPostTs));
  }

  private void sortPostsInThreads(List<Thread> threads) {
    for (Thread t : threads) {
      sortPosts(t);
    }
  }

  /** Limit the number of posts within each thread. */
  private void limitPostsInThreads(List<Thread> threads, int limitPosts) {
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

  private String getUserTeamJsonMysql(String userId, List<String> teamIds) {
    // Build a string like this for the tasks filter
    // [{"id":"9e78b924-b75c-4141-9845-1b3eb81fdc1b","type":"team"},{"id":"fe21e1ba-ce00-49fa-8b62-3c9a6669a11b","type":"user"}]
    List<String> result = new ArrayList<>();
    JSONObject json = getUserTeamJson(userId, "user");
    result.add(json.toString());
    teamIds.forEach(id -> result.add(getUserTeamJson(id, "team").toString()));
    return result.toString();
  }

  private List<String> getUserTeamJsonPostgres(String userId, List<String> teamIds) {
    // Build a list of objects like this for the tasks filter
    // [{"id":"9e78b924-b75c-4141-9845-1b3eb81fdc1b","type":"team"}]','[{"id":"fe21e1ba-ce00-49fa-8b62-3c9a6669a11b","type":"user"}]
    List<String> result = new ArrayList<>();
    JSONObject json = getUserTeamJson(userId, "user");
    result.add(List.of(json.toString()).toString());
    teamIds.forEach(id -> result.add(List.of(getUserTeamJson(id, "team").toString()).toString()));
    return result;
  }

  private JSONObject getUserTeamJson(String userId, String type) {
    return new JSONObject().put("id", userId).put("type", type);
  }

  /** Return the tasks assigned to the user. */
  private FilteredThreads getTasksAssignedTo(
      String userId, int limit, long time, TaskStatus status, PaginationType paginationType) throws IOException {
    List<String> teamIds = getTeamIds(userId);
    List<String> jsons;
    List<String> userTeamJsonPostgres = getUserTeamJsonPostgres(userId, teamIds);
    String userTeamJsonMysql = getUserTeamJsonMysql(userId, teamIds);
    if (paginationType == PaginationType.BEFORE) {
      jsons = dao.feedDAO().listTasksAssignedToBefore(userTeamJsonPostgres, userTeamJsonMysql, limit, time, status);
    } else {
      jsons = dao.feedDAO().listTasksAssignedToAfter(userTeamJsonPostgres, userTeamJsonMysql, limit, time, status);
    }
    List<Thread> threads = JsonUtils.readObjects(jsons, Thread.class);
    int totalCount = dao.feedDAO().listCountTasksAssignedTo(userTeamJsonPostgres, userTeamJsonMysql, status);
    sortPostsInThreads(threads);
    return new FilteredThreads(threads, totalCount);
  }

  private void populateAssignees(List<Thread> threads) {
    threads.forEach(this::populateAssignees);
  }

  private Thread populateAssignees(Thread thread) {
    if (thread.getType().equals(ThreadType.Task)) {
      List<EntityReference> assignees = thread.getTask().getAssignees();
      for (EntityReference ref : assignees) {
        try {
          EntityReference ref2 = Entity.getEntityReferenceById(ref.getType(), ref.getId(), ALL);
          EntityUtil.copy(ref2, ref);
        } catch (EntityNotFoundException exception) {
          // mark the not found user as deleted user since
          // user will not be found in case of permanent deletion of user or team
          ref.setName(DELETED_USER_NAME);
          ref.setDisplayName(DELETED_USER_DISPLAY);
        } catch (IOException ioException) {
          throw new RuntimeException(ioException);
        }
      }
      assignees.sort(compareEntityReference);
      thread.getTask().setAssignees(assignees);
    }
    return thread;
  }

  /** Return the tasks created by the user. */
  private FilteredThreads getTasksAssignedBy(
      String userId, int limit, long time, TaskStatus status, PaginationType paginationType) throws IOException {
    User user = dao.userDAO().findEntityById(UUID.fromString(userId));
    String username = user.getName();
    List<String> jsons;
    if (paginationType == PaginationType.BEFORE) {
      jsons = dao.feedDAO().listTasksAssignedByBefore(username, limit, time, status);
    } else {
      jsons = dao.feedDAO().listTasksAssignedByAfter(username, limit, time, status);
    }
    List<Thread> threads = JsonUtils.readObjects(jsons, Thread.class);
    int totalCount = dao.feedDAO().listCountTasksAssignedBy(username, status);
    sortPostsInThreads(threads);
    return new FilteredThreads(threads, totalCount);
  }

  /**
   * Return the threads associated with user/team owned entities and the threads that were created by or replied to by
   * the user.
   */
  private FilteredThreads getThreadsByOwner(
      String userId, int limit, long time, ThreadType type, boolean isResolved, PaginationType paginationType)
      throws IOException {
    // add threads on user or team owned entities
    // and threads created by or replied to by the user
    List<String> teamIds = getTeamIds(userId);
    List<String> jsons;
    if (paginationType == PaginationType.BEFORE) {
      jsons = dao.feedDAO().listThreadsByOwnerBefore(userId, teamIds, limit, time, type, isResolved);
    } else {
      jsons = dao.feedDAO().listThreadsByOwnerAfter(userId, teamIds, limit, time, type, isResolved);
    }
    List<Thread> threads = JsonUtils.readObjects(jsons, Thread.class);
    int totalCount = dao.feedDAO().listCountThreadsByOwner(userId, teamIds, type, isResolved);
    sortPostsInThreads(threads);
    return new FilteredThreads(threads, totalCount);
  }

  /** Get a list of team ids that the given user is a part of. */
  private List<String> getTeamIds(String userId) {
    List<EntityRelationshipRecord> records =
        dao.relationshipDAO().findFrom(userId, Entity.USER, Relationship.HAS.ordinal(), Entity.TEAM);
    List<String> teamIds = new ArrayList<>();
    for (EntityRelationshipRecord record : records) {
      teamIds.add(record.getId().toString());
    }
    return teamIds.isEmpty() ? List.of(StringUtils.EMPTY) : teamIds;
  }

  /** Returns the threads where the user or the team they belong to were mentioned by other users with @mention. */
  private FilteredThreads getThreadsByMentions(
      String userId, int limit, long time, ThreadType type, boolean isResolved, PaginationType paginationType)
      throws IOException {
    List<EntityReference> teams =
        populateEntityReferences(
            dao.relationshipDAO().findFrom(userId, Entity.USER, Relationship.HAS.ordinal(), Entity.TEAM), Entity.TEAM);
    List<String> teamNames = teams.stream().map(EntityReference::getName).collect(Collectors.toList());
    if (teamNames.isEmpty()) {
      teamNames = List.of(StringUtils.EMPTY);
    }
    User user = dao.userDAO().findEntityById(UUID.fromString(userId));

    // Return the threads where the user or team was mentioned
    List<String> jsons;
    if (paginationType == PaginationType.BEFORE) {
      jsons =
          dao.feedDAO()
              .listThreadsByMentionsBefore(
                  user.getName(), teamNames, limit, time, type, isResolved, Relationship.MENTIONED_IN.ordinal());
    } else {
      jsons =
          dao.feedDAO()
              .listThreadsByMentionsAfter(
                  user.getName(), teamNames, limit, time, type, isResolved, Relationship.MENTIONED_IN.ordinal());
    }
    List<Thread> threads = JsonUtils.readObjects(jsons, Thread.class);
    int totalCount =
        dao.feedDAO()
            .listCountThreadsByMentions(
                user.getName(), teamNames, type, isResolved, Relationship.MENTIONED_IN.ordinal());
    sortPostsInThreads(threads);
    return new FilteredThreads(threads, totalCount);
  }

  /** Returns the threads that are associated with the entities followed by the user. */
  private FilteredThreads getThreadsByFollows(
      String userId, int limit, long time, ThreadType type, boolean isResolved, PaginationType paginationType)
      throws IOException {
    List<String> jsons;
    List<String> teamIds = getTeamIds(userId);
    if (paginationType == PaginationType.BEFORE) {
      jsons =
          dao.feedDAO()
              .listThreadsByFollowsBefore(
                  userId, teamIds, limit, time, type, isResolved, Relationship.FOLLOWS.ordinal());
    } else {
      jsons =
          dao.feedDAO()
              .listThreadsByFollowsAfter(
                  userId, teamIds, limit, time, type, isResolved, Relationship.FOLLOWS.ordinal());
    }
    List<Thread> threads = JsonUtils.readObjects(jsons, Thread.class);
    int totalCount =
        dao.feedDAO().listCountThreadsByFollows(userId, teamIds, type, isResolved, Relationship.FOLLOWS.ordinal());
    sortPostsInThreads(threads);
    return new FilteredThreads(threads, totalCount);
  }

  public static class FilteredThreads {
    @Getter private final List<Thread> threads;
    @Getter private final int totalCount;

    public FilteredThreads(List<Thread> threads, int totalCount) {
      this.threads = threads;
      this.totalCount = totalCount;
    }
  }
}
