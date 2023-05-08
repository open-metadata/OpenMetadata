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
import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.schema.type.Relationship.ADDRESSED_TO;
import static org.openmetadata.schema.type.Relationship.CREATED;
import static org.openmetadata.schema.type.Relationship.IS_ABOUT;
import static org.openmetadata.schema.type.Relationship.REPLIED_TO;
import static org.openmetadata.service.Entity.DASHBOARD;
import static org.openmetadata.service.Entity.DASHBOARD_DATA_MODEL;
import static org.openmetadata.service.Entity.DATABASE_SCHEMA;
import static org.openmetadata.service.Entity.FIELD_DESCRIPTION;
import static org.openmetadata.service.Entity.PIPELINE;
import static org.openmetadata.service.Entity.TABLE;
import static org.openmetadata.service.Entity.TOPIC;
import static org.openmetadata.service.Entity.getEntityRepository;
import static org.openmetadata.service.exception.CatalogExceptionMessage.ANNOUNCEMENT_INVALID_START_TIME;
import static org.openmetadata.service.exception.CatalogExceptionMessage.ANNOUNCEMENT_OVERLAP;
import static org.openmetadata.service.exception.CatalogExceptionMessage.entityNotFound;
import static org.openmetadata.service.util.ChangeEventParser.getPlaintextDiff;
import static org.openmetadata.service.util.EntityUtil.compareEntityReference;
import static org.openmetadata.service.util.EntityUtil.populateEntityReferences;
import static org.openmetadata.service.util.RestUtil.DELETED_TEAM_DISPLAY;
import static org.openmetadata.service.util.RestUtil.DELETED_TEAM_NAME;
import static org.openmetadata.service.util.RestUtil.DELETED_USER_DISPLAY;
import static org.openmetadata.service.util.RestUtil.DELETED_USER_NAME;

import com.fasterxml.jackson.core.JsonProcessingException;
import io.jsonwebtoken.lang.Collections;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import javax.json.JsonPatch;
import javax.ws.rs.core.Response.Status;
import javax.ws.rs.core.SecurityContext;
import javax.ws.rs.core.UriInfo;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.json.JSONObject;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.feed.CloseTask;
import org.openmetadata.schema.api.feed.EntityLinkThreadCount;
import org.openmetadata.schema.api.feed.ResolveTask;
import org.openmetadata.schema.api.feed.ThreadCount;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.AnnouncementDetails;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Post;
import org.openmetadata.schema.type.Reaction;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.Task;
import org.openmetadata.schema.type.TaskDetails;
import org.openmetadata.schema.type.TaskStatus;
import org.openmetadata.schema.type.TaskType;
import org.openmetadata.schema.type.ThreadType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.ResourceRegistry;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.resources.feeds.FeedResource;
import org.openmetadata.service.resources.feeds.FeedUtil;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.SubjectCache;
import org.openmetadata.service.util.*;
import org.openmetadata.service.util.ChangeEventParser.PublishTo;
import org.openmetadata.service.util.RestUtil.DeleteResponse;
import org.openmetadata.service.util.RestUtil.PatchResponse;

@Slf4j
public class FeedRepository {
  private static final String UNSUPPORTED_FIELD_NAME_FOR_TASK = "The field name %s is not supported for %s task.";
  private final CollectionDAO dao;

  public FeedRepository(CollectionDAO dao) {
    this.dao = dao;
    ResourceRegistry.addResource("feed", null, Entity.getEntityFields(Thread.class));
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
  public Thread create(Thread thread) throws IOException {
    // Validate about data entity is valid and get the owner for that entity
    EntityLink about = EntityLink.parse(thread.getAbout());
    EntityInterface aboutEntity = Entity.getEntity(about, "owner", ALL);
    thread.withEntityId(aboutEntity.getId()); // Add entity id to thread
    EntityReference entityOwner = aboutEntity.getOwner();

    // Validate user creating the thread
    User createdByUser = SubjectCache.getInstance().getUser(thread.getCreatedBy());

    if (thread.getType().equals(ThreadType.Task)) {
      thread.withTask(thread.getTask().withId(getNextTaskId())); // Assign taskId for a task
    } else if (thread.getType().equals(ThreadType.Announcement)) {
      // Validate start and end time for announcement
      validateAnnouncement(thread.getAnnouncement());
      long startTime = thread.getAnnouncement().getStartTime();
      long endTime = thread.getAnnouncement().getEndTime();
      // TODO fix this - overlapping announcements should be allowed
      List<String> announcements =
          dao.feedDAO()
              .listAnnouncementBetween(thread.getId().toString(), thread.getEntityId().toString(), startTime, endTime);
      if (announcements.size() > 0) {
        // There is already an announcement that overlaps the new one
        throw new IllegalArgumentException(ANNOUNCEMENT_OVERLAP);
      }
    }

    // Insert a new thread
    dao.feedDAO().insert(JsonUtils.pojoToJson(thread));

    // Add relationship User -- created --> Thread relationship
    dao.relationshipDAO().insert(createdByUser.getId(), thread.getId(), Entity.USER, Entity.THREAD, CREATED.ordinal());

    // Add field relationship for data asset - Thread -- isAbout ---> entity/entityField
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
            } else if (descriptionTasks.contains(taskType) && entityLink.getFieldName().equals(FIELD_DESCRIPTION)) {
              table.setDescription(newValue);
            } else if (tagTasks.contains(taskType) && entityLink.getFieldName().equals("tags")) {
              List<TagLabel> tags = JsonUtils.readObjects(newValue, TagLabel.class);
              table.setTags(tags);
            } else {
              // Not supported
              throw new IllegalArgumentException(
                  String.format(UNSUPPORTED_FIELD_NAME_FOR_TASK, entityLink.getFieldName(), task.getType()));
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
          if (descriptionTasks.contains(taskType) && entityLink.getFieldName().equals(FIELD_DESCRIPTION)) {
            topic.setDescription(newValue);
          } else if (tagTasks.contains(taskType) && entityLink.getFieldName().equals("tags")) {
            List<TagLabel> tags = JsonUtils.readObjects(newValue, TagLabel.class);
            topic.setTags(tags);
          } else {
            // Not supported
            throw new IllegalArgumentException(
                String.format(UNSUPPORTED_FIELD_NAME_FOR_TASK, entityLink.getFieldName(), task.getType()));
          }
          updatedEntityJson = JsonUtils.pojoToJson(topic);
          patch = JsonUtils.getJsonPatch(oldJson, updatedEntityJson);
          repository.patch(uriInfo, topic.getId(), user, patch);
          break;
        case DASHBOARD:
          Dashboard dashboard = JsonUtils.readValue(json, Dashboard.class);
          oldJson = JsonUtils.pojoToJson(dashboard);
          if (descriptionTasks.contains(taskType) && entityLink.getFieldName().equals(FIELD_DESCRIPTION)) {
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
                String.format(UNSUPPORTED_FIELD_NAME_FOR_TASK, entityLink.getFieldName(), task.getType()));
          }
          updatedEntityJson = JsonUtils.pojoToJson(dashboard);
          patch = JsonUtils.getJsonPatch(oldJson, updatedEntityJson);
          repository.patch(uriInfo, dashboard.getId(), user, patch);
          break;
        case DASHBOARD_DATA_MODEL:
          DashboardDataModel dashboardDataModel = JsonUtils.readValue(json, DashboardDataModel.class);
          oldJson = JsonUtils.pojoToJson(dashboardDataModel);
          if (entityLink.getFieldName() != null) {
            if (entityLink.getFieldName().equals("columns")) {
              Optional<Column> col =
                  dashboardDataModel.getColumns().stream()
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
                        "The Column with name '%s' is not found in the dashboard data model.",
                        entityLink.getArrayFieldName()));
              }
            } else if (descriptionTasks.contains(taskType) && entityLink.getFieldName().equals(FIELD_DESCRIPTION)) {
              dashboardDataModel.setDescription(newValue);
            } else if (tagTasks.contains(taskType) && entityLink.getFieldName().equals("tags")) {
              List<TagLabel> tags = JsonUtils.readObjects(newValue, TagLabel.class);
              dashboardDataModel.setTags(tags);
            } else {
              // Not supported
              throw new IllegalArgumentException(
                  String.format(UNSUPPORTED_FIELD_NAME_FOR_TASK, entityLink.getFieldName(), task.getType()));
            }
          } else {
            // Not supported
            throw new IllegalArgumentException(
                String.format(
                    "The Entity link with no field name - %s is not supported for %s task.",
                    entityLink, task.getType()));
          }
          updatedEntityJson = JsonUtils.pojoToJson(dashboardDataModel);
          patch = JsonUtils.getJsonPatch(oldJson, updatedEntityJson);
          repository.patch(uriInfo, dashboardDataModel.getId(), user, patch);
          break;
        case PIPELINE:
          Pipeline pipeline = JsonUtils.readValue(json, Pipeline.class);
          oldJson = JsonUtils.pojoToJson(pipeline);
          if (descriptionTasks.contains(taskType) && entityLink.getFieldName().equals(FIELD_DESCRIPTION)) {
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
                String.format(UNSUPPORTED_FIELD_NAME_FOR_TASK, entityLink.getFieldName(), task.getType()));
          }
          updatedEntityJson = JsonUtils.pojoToJson(pipeline);
          patch = JsonUtils.getJsonPatch(oldJson, updatedEntityJson);
          repository.patch(uriInfo, pipeline.getId(), user, patch);
          break;
        case DATABASE_SCHEMA:
          DatabaseSchema databaseSchema = JsonUtils.readValue(json, DatabaseSchema.class);
          oldJson = JsonUtils.pojoToJson(databaseSchema);
          if (entityLink.getFieldName() != null) {
            if (descriptionTasks.contains(taskType) && entityLink.getFieldName().equals(FIELD_DESCRIPTION)) {
              databaseSchema.setDescription(newValue);
            } else if (tagTasks.contains(taskType) && entityLink.getFieldName().equals("tags")) {
              List<TagLabel> tags = JsonUtils.readObjects(newValue, TagLabel.class);
              databaseSchema.setTags(tags);
            } else {
              // Not supported
              throw new IllegalArgumentException(
                  String.format(UNSUPPORTED_FIELD_NAME_FOR_TASK, entityLink.getFieldName(), task.getType()));
            }
          } else {
            // Not supported
            throw new IllegalArgumentException(
                String.format(
                    "The Entity link with no field name - %s is not supported for %s task.",
                    entityLink, task.getType()));
          }
          updatedEntityJson = JsonUtils.pojoToJson(databaseSchema);
          patch = JsonUtils.getJsonPatch(oldJson, updatedEntityJson);
          repository.patch(uriInfo, databaseSchema.getId(), user, patch);
          break;
        default:
          throw new IllegalArgumentException("Task is not supported for the Data Asset.");
      }
    }
  }

  public PatchResponse<Thread> resolveTask(UriInfo uriInfo, Thread thread, String user, ResolveTask resolveTask)
      throws IOException {
    // perform the task
    TaskDetails task = thread.getTask();
    EntityLink about = EntityLink.parse(thread.getAbout());
    EntityReference aboutRef = EntityUtil.validateEntityLink(about);
    performTask(task, about, aboutRef, uriInfo, resolveTask.getNewValue(), user);

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
                getPlaintextDiff(PublishTo.FEED, oldValue, task.getNewValue()));
      } else if (List.of(TaskType.RequestTag, TaskType.UpdateTag).contains(type)) {
        List<TagLabel> tags;
        if (task.getOldValue() != null) {
          tags = JsonUtils.readObjects(task.getOldValue(), TagLabel.class);
          oldValue = getTagFQNs(tags);
        }
        tags = JsonUtils.readObjects(task.getNewValue(), TagLabel.class);
        String newValue = getTagFQNs(tags);
        message =
            String.format("Resolved the Task with Tag(s) - %s", getPlaintextDiff(PublishTo.FEED, oldValue, newValue));
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
    // Validate the user posting the message
    User fromUser = SubjectCache.getInstance().getUser(post.getFrom());

    // Update the thread with the new post
    Thread thread = EntityUtil.validate(id, dao.feedDAO().findById(id), Thread.class);
    thread.withUpdatedBy(userName).withUpdatedAt(System.currentTimeMillis());
    FeedUtil.addPost(thread, post);
    dao.feedDAO().update(id, JsonUtils.pojoToJson(thread));

    // Add relation User -- repliedTo --> Thread
    // Add relationship from thread to the user entity that is posting a reply
    boolean relationAlreadyExists = thread.getPosts().stream().anyMatch(p -> p.getFrom().equals(post.getFrom()));
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
      throw EntityNotFoundException.byMessage(entityNotFound("Post", postId));
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

  @Transaction
  public DeleteResponse<Thread> deleteThread(Thread thread, String deletedByUser) {
    String id = thread.getId().toString();

    // Delete all the relationships to other entities
    dao.relationshipDAO().deleteAll(id, Entity.THREAD);

    // Delete all the field relationships to other entities
    dao.fieldRelationshipDAO().deleteAllByPrefix(id);

    // Finally, delete the entity
    dao.feedDAO().delete(id);

    LOG.info("{} deleted thread with id {}", deletedByUser, thread.getId());
    return new DeleteResponse<>(thread, RestUtil.ENTITY_DELETED);
  }

  @Transaction
  public ThreadCount getThreadsCount(FeedFilter filter, String link) {
    List<List<String>> result;
    if (link == null) {
      // Get thread count of all entities
      result =
          // TODO fix this
          dao.feedDAO()
              .listCountByEntityLink(
                  null,
                  Entity.THREAD,
                  null,
                  IS_ABOUT.ordinal(),
                  filter.getThreadType(),
                  filter.getTaskStatus(),
                  filter.getResolved());
    } else {
      EntityLink entityLink = EntityLink.parse(link);
      EntityReference reference = EntityUtil.validateEntityLink(entityLink);
      if (reference.getType().equals(Entity.USER) || reference.getType().equals(Entity.TEAM)) {
        if (reference.getType().equals(Entity.USER)) {
          String userId = reference.getId().toString();
          List<String> teamIds = getTeamIds(userId);
          result = dao.feedDAO().listCountByOwner(userId, teamIds, filter.getCondition());
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
                    filter.getThreadType(),
                    filter.getTaskStatus(),
                    filter.getResolved());
      }
    }

    AtomicInteger totalCount = new AtomicInteger(0);
    List<EntityLinkThreadCount> entityLinkThreadCounts = new ArrayList<>();
    result.forEach(
        l -> {
          int count = Integer.parseInt(l.get(1));
          entityLinkThreadCounts.add(new EntityLinkThreadCount().withEntityLink(l.get(0)).withCount(count));
          totalCount.addAndGet(count);
        });
    return new ThreadCount().withTotalCount(totalCount.get()).withCounts(entityLinkThreadCounts);
  }

  public List<Post> listPosts(String threadId) throws IOException {
    return get(threadId).getPosts();
  }

  /** List threads based on the filters and limits in the order of the updated timestamp. */
  @Transaction
  public ResultList<Thread> list(FeedFilter filter, String link, int limitPosts, String userId, int limit)
      throws IOException {
    int total;
    List<Thread> threads;
    // No filters are enabled. Listing all the threads
    if (link == null && userId == null) {
      // Get one extra result used for computing before cursor
      List<String> jsons = dao.feedDAO().list(limit + 1, filter.getCondition());
      threads = JsonUtils.readObjects(jsons, Thread.class);
      total = dao.feedDAO().listCount(filter.getCondition());
    } else {
      // Either one or both the filters are enabled
      // we don't support both the filters together. If both are not null, entity link takes precedence

      if (link != null) {
        EntityLink entityLink = EntityLink.parse(link);
        EntityReference reference = EntityUtil.validateEntityLink(entityLink);

        // For a user entityLink get created or replied relationships to the thread
        if (reference.getType().equals(Entity.USER)) {
          FilteredThreads filteredThreads = getThreadsByOwner(filter, reference.getId().toString(), limit + 1);
          threads = filteredThreads.getThreads();
          total = filteredThreads.getTotalCount();
        } else {
          // Only data assets are added as about
          String userName = userId != null ? SubjectCache.getInstance().getUserById(userId).getName() : null;
          List<String> teamNames = getTeamNames(userId);
          List<String> jsons;
          jsons =
              dao.feedDAO()
                  .listThreadsByEntityLink(filter, entityLink, limit + 1, IS_ABOUT.ordinal(), userName, teamNames);
          threads = JsonUtils.readObjects(jsons, Thread.class);
          total =
              dao.feedDAO().listCountThreadsByEntityLink(filter, entityLink, IS_ABOUT.ordinal(), userName, teamNames);
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
          } else {
            filteredThreads = getThreadsByOwner(filter, userId, limit + 1);
          }
        }
        threads = filteredThreads.getThreads();
        total = filteredThreads.getTotalCount();
      }
    }
    sortAndLimitPosts(threads, limitPosts);
    populateAssignees(threads);

    String beforeCursor = null;
    String afterCursor = null;
    if (filter.getPaginationType() == PaginationType.BEFORE) {
      if (threads.size() > limit) { // If extra result exists, then previous page exists - return before cursor
        threads.remove(0);
        beforeCursor = threads.get(0).getUpdatedAt().toString();
      }
      afterCursor = threads.get(threads.size() - 1).getUpdatedAt().toString();
    } else {
      beforeCursor = filter.getAfter() == null ? null : threads.get(0).getUpdatedAt().toString();
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

    if (updated.getAnnouncement() != null) {
      validateAnnouncement(updated.getAnnouncement());
      // check if the announcement start and end time clashes with other existing announcements
      List<String> announcements =
          dao.feedDAO()
              .listAnnouncementBetween(
                  id.toString(),
                  updated.getEntityId().toString(),
                  updated.getAnnouncement().getStartTime(),
                  updated.getAnnouncement().getEndTime());
      if (announcements.size() > 0) {
        throw new IllegalArgumentException(ANNOUNCEMENT_OVERLAP);
      }
    }

    // Update the attributes
    String change = patchUpdate(original, updated) ? RestUtil.ENTITY_UPDATED : RestUtil.ENTITY_NO_CHANGE;
    sortPosts(updated);
    Thread updatedHref = FeedResource.addHref(uriInfo, updated);
    return new PatchResponse<>(Status.OK, updatedHref, change);
  }

  public void checkPermissionsForResolveTask(Thread thread, SecurityContext securityContext, Authorizer authorizer)
      throws IOException {
    if (!thread.getType().equals(ThreadType.Task)) {
      return; // Nothing to resolve
    }
    EntityLink about = EntityLink.parse(thread.getAbout());
    EntityReference aboutRef = EntityUtil.validateEntityLink(about);

    // Get owner for the addressed to Entity
    EntityReference owner = Entity.getOwner(aboutRef);

    String userName = securityContext.getUserPrincipal().getName();
    User loggedInUser = SubjectCache.getInstance().getUser(userName);
    List<EntityReference> teams =
        populateEntityReferences(
            dao.relationshipDAO()
                .findFrom(loggedInUser.getId().toString(), Entity.USER, Relationship.HAS.ordinal(), Entity.TEAM),
            Entity.TEAM);
    List<String> teamNames = teams.stream().map(EntityReference::getName).collect(Collectors.toList());

    // check if logged-in user satisfies any of the following
    // - Creator of the task
    // - logged-in user or the teams they belong to were assigned the task
    // - logged-in user or the teams they belong to, owns the entity that the task is about
    List<EntityReference> assignees = thread.getTask().getAssignees();
    if (!thread.getCreatedBy().equals(userName)
        && assignees.stream().noneMatch(assignee -> assignee.getName().equals(userName))
        && assignees.stream().noneMatch(assignee -> teamNames.contains(assignee.getName()))
        && !owner.getName().equals(userName)
        && !teamNames.contains(owner.getName())) {
      // Only admins or bots can close or resolve task other than the above-mentioned users
      authorizer.authorizeAdmin(securityContext);
    }
  }

  private void validateAnnouncement(AnnouncementDetails announcementDetails) {
    if (announcementDetails.getStartTime() >= announcementDetails.getEndTime()) {
      throw new IllegalArgumentException(ANNOUNCEMENT_INVALID_START_TIME);
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
    // Patch supports isResolved, message, task assignees, reactions, and announcements for now
    return !original.getResolved().equals(updated.getResolved())
        || !original.getMessage().equals(updated.getMessage())
        || (Collections.isEmpty(original.getReactions()) && !Collections.isEmpty(updated.getReactions()))
        || (!Collections.isEmpty(original.getReactions()) && Collections.isEmpty(updated.getReactions()))
        || original.getReactions().size() != updated.getReactions().size()
        || !original.getReactions().containsAll(updated.getReactions())
        || (original.getAnnouncement() != null
            && (!original.getAnnouncement().getDescription().equals(updated.getAnnouncement().getDescription())
                || !Objects.equals(original.getAnnouncement().getStartTime(), updated.getAnnouncement().getStartTime())
                || !Objects.equals(original.getAnnouncement().getEndTime(), updated.getAnnouncement().getEndTime())))
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
  private FilteredThreads getTasksAssignedTo(FeedFilter filter, String userId, int limit) throws IOException {
    List<String> teamIds = getTeamIds(userId);
    List<String> userTeamJsonPostgres = getUserTeamJsonPostgres(userId, teamIds);
    String userTeamJsonMysql = getUserTeamJsonMysql(userId, teamIds);
    List<String> jsons =
        dao.feedDAO().listTasksAssigned(userTeamJsonPostgres, userTeamJsonMysql, limit, filter.getCondition());
    List<Thread> threads = JsonUtils.readObjects(jsons, Thread.class);
    int totalCount =
        dao.feedDAO().listCountTasksAssignedTo(userTeamJsonPostgres, userTeamJsonMysql, filter.getCondition(false));
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
          if (ref.getType().equals(Entity.TEAM)) {
            ref.setName(DELETED_TEAM_NAME);
            ref.setDisplayName(DELETED_TEAM_DISPLAY);
          } else {
            ref.setName(DELETED_USER_NAME);
            ref.setDisplayName(DELETED_USER_DISPLAY);
          }
        } catch (IOException ioException) {
          throw new RuntimeException(ioException);
        }
      }
      assignees.sort(compareEntityReference);
      thread.getTask().setAssignees(assignees);
    }
    return thread;
  }

  /** Return the tasks created by or assigned to the user. */
  private FilteredThreads getTasksOfUser(FeedFilter filter, String userId, int limit) throws IOException {
    String username = SubjectCache.getInstance().getUserById(userId).getName();
    List<String> teamIds = getTeamIds(userId);
    List<String> userTeamJsonPostgres = getUserTeamJsonPostgres(userId, teamIds);
    String userTeamJsonMysql = getUserTeamJsonMysql(userId, teamIds);
    List<String> jsons =
        dao.feedDAO().listTasksOfUser(userTeamJsonPostgres, userTeamJsonMysql, username, limit, filter.getCondition());
    List<Thread> threads = JsonUtils.readObjects(jsons, Thread.class);
    int totalCount =
        dao.feedDAO()
            .listCountTasksOfUser(userTeamJsonPostgres, userTeamJsonMysql, username, filter.getCondition(false));
    return new FilteredThreads(threads, totalCount);
  }

  /** Return the tasks created by the user. */
  private FilteredThreads getTasksAssignedBy(FeedFilter filter, String userId, int limit) throws IOException {
    String username = SubjectCache.getInstance().getUserById(userId).getName();
    List<String> jsons = dao.feedDAO().listTasksAssigned(username, limit, filter.getCondition());
    List<Thread> threads = JsonUtils.readObjects(jsons, Thread.class);
    int totalCount = dao.feedDAO().listCountTasksAssignedBy(username, filter.getCondition(false));
    return new FilteredThreads(threads, totalCount);
  }

  /**
   * Return the threads associated with user/team owned entities and the threads that were created by or replied to by
   * the user.
   */
  private FilteredThreads getThreadsByOwner(FeedFilter filter, String userId, int limit) throws IOException {
    // add threads on user or team owned entities
    // and threads created by or replied to by the user
    List<String> teamIds = getTeamIds(userId);
    List<String> jsons = dao.feedDAO().listThreadsByOwner(userId, teamIds, limit, filter.getCondition());
    List<Thread> threads = JsonUtils.readObjects(jsons, Thread.class);
    int totalCount = dao.feedDAO().listCountThreadsByOwner(userId, teamIds, filter.getCondition(false));
    return new FilteredThreads(threads, totalCount);
  }

  /** Get a list of team ids that the given user is a part of. */
  private List<String> getTeamIds(String userId) {
    List<String> teamIds = null;
    if (userId != null) {
      User user = SubjectCache.getInstance().getUserById(userId);
      teamIds = listOrEmpty(user.getTeams()).stream().map(ref -> ref.getId().toString()).collect(Collectors.toList());
    }
    return nullOrEmpty(teamIds) ? List.of(StringUtils.EMPTY) : teamIds;
  }

  /** Get a list of team names that the given user is a part of. */
  private List<String> getTeamNames(String userId) {
    List<String> teamNames = null;
    if (userId != null) {
      User user = SubjectCache.getInstance().getUserById(userId);
      teamNames = listOrEmpty(user.getTeams()).stream().map(EntityReference::getName).collect(Collectors.toList());
    }
    return nullOrEmpty(teamNames) ? List.of(StringUtils.EMPTY) : teamNames;
  }

  /** Returns the threads where the user or the team they belong to were mentioned by other users with @mention. */
  private FilteredThreads getThreadsByMentions(FeedFilter filter, String userId, int limit) throws IOException {
    List<EntityReference> teams =
        populateEntityReferences(
            dao.relationshipDAO().findFrom(userId, Entity.USER, Relationship.HAS.ordinal(), Entity.TEAM), Entity.TEAM);
    List<String> teamNames = teams.stream().map(EntityReference::getName).collect(Collectors.toList());
    if (teamNames.isEmpty()) {
      teamNames = List.of(StringUtils.EMPTY);
    }
    User user = dao.userDAO().findEntityById(UUID.fromString(userId));

    // Return the threads where the user or team was mentioned
    List<String> jsons =
        dao.feedDAO()
            .listThreadsByMentions(
                user.getName(), teamNames, limit, Relationship.MENTIONED_IN.ordinal(), filter.getCondition());
    List<Thread> threads = JsonUtils.readObjects(jsons, Thread.class);
    int totalCount =
        dao.feedDAO()
            .listCountThreadsByMentions(
                user.getName(), teamNames, Relationship.MENTIONED_IN.ordinal(), filter.getCondition(false));
    return new FilteredThreads(threads, totalCount);
  }

  /** Returns the threads that are associated with the entities followed by the user. */
  private FilteredThreads getThreadsByFollows(FeedFilter filter, String userId, int limit) throws IOException {
    List<String> teamIds = getTeamIds(userId);
    List<String> jsons =
        dao.feedDAO()
            .listThreadsByFollows(userId, teamIds, limit, Relationship.FOLLOWS.ordinal(), filter.getCondition());
    List<Thread> threads = JsonUtils.readObjects(jsons, Thread.class);
    int totalCount =
        dao.feedDAO().listCountThreadsByFollows(userId, teamIds, Relationship.FOLLOWS.ordinal(), filter.getCondition());
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
