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

import com.fasterxml.jackson.core.JsonProcessingException;
import java.io.IOException;
import java.text.ParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;
import javax.json.JsonPatch;
import javax.ws.rs.core.Response.Status;
import javax.ws.rs.core.UriInfo;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.feed.EntityLinkThreadCount;
import org.openmetadata.catalog.api.feed.ThreadCount;
import org.openmetadata.catalog.entity.feed.Thread;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.exception.EntityNotFoundException;
import org.openmetadata.catalog.resources.feeds.FeedResource;
import org.openmetadata.catalog.resources.feeds.FeedUtil;
import org.openmetadata.catalog.resources.feeds.MessageParser;
import org.openmetadata.catalog.resources.feeds.MessageParser.EntityLink;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.Post;
import org.openmetadata.catalog.type.Relationship;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.RestUtil;
import org.openmetadata.catalog.util.RestUtil.DeleteResponse;
import org.openmetadata.catalog.util.RestUtil.PatchResponse;
import org.openmetadata.catalog.util.ResultList;

@Slf4j
public class FeedRepository {
  private final CollectionDAO dao;

  public FeedRepository(CollectionDAO dao) {
    this.dao = dao;
  }

  public enum FilterType {
    OWNER,
    MENTIONS,
    FOLLOWS
  }

  public enum PaginationType {
    BEFORE,
    AFTER
  }

  @Transaction
  public Thread create(Thread thread) throws IOException {
    String createdBy = thread.getCreatedBy();

    // Validate user creating thread
    User createdByUser = dao.userDAO().findEntityByName(createdBy);

    // Validate about data entity is valid
    EntityLink about = EntityLink.parse(thread.getAbout());
    EntityReference aboutRef = EntityUtil.validateEntityLink(about);

    // Get owner for the addressed to Entity
    EntityReference owner = Entity.getOwner(aboutRef);

    // Add entity id to thread
    thread.withEntityId(aboutRef.getId());

    // Insert a new thread
    dao.feedDAO().insert(JsonUtils.pojoToJson(thread));

    // Add relationship User -- created --> Thread relationship
    dao.relationshipDAO()
        .insert(
            createdByUser.getId().toString(),
            thread.getId().toString(),
            Entity.USER,
            Entity.THREAD,
            Relationship.CREATED.ordinal());

    // Add field relationship data asset Thread -- isAbout ---> entity/entityField
    // relationship
    dao.fieldRelationshipDAO()
        .insert(
            thread.getId().toString(), // from FQN
            about.getFullyQualifiedFieldValue(), // to FQN
            Entity.THREAD, // From type
            about.getFullyQualifiedFieldType(), // to Type
            Relationship.IS_ABOUT.ordinal());

    // Add the owner also as addressedTo as the entity he owns when addressed, the owner is actually being addressed
    if (owner != null) {
      dao.relationshipDAO()
          .insert(
              thread.getId().toString(),
              owner.getId().toString(),
              Entity.THREAD,
              owner.getType(),
              Relationship.ADDRESSED_TO.ordinal());
    }

    // Add mentions to field relationship table
    storeMentions(thread, thread.getMessage());

    return thread;
  }

  public Thread get(String id) throws IOException {
    return EntityUtil.validate(id, dao.feedDAO().findById(id), Thread.class);
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
                        Relationship.MENTIONED_IN.ordinal()));
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
      dao.relationshipDAO()
          .insert(
              fromUser.getId().toString(),
              thread.getId().toString(),
              Entity.USER,
              Entity.THREAD,
              Relationship.REPLIED_TO.ordinal());
    }

    // Add mentions into field relationship table
    storeMentions(thread, post.getMessage());

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

  public EntityReference getOwnerOfPost(Post post) throws IOException {
    User fromUser = dao.userDAO().findEntityByName(post.getFrom());
    return Entity.getEntityReference(fromUser);
  }

  @Transaction
  public ThreadCount getThreadsCount(String link, boolean isResolved) throws IOException {
    ThreadCount threadCount = new ThreadCount();
    List<List<String>> result;
    List<EntityLinkThreadCount> entityLinkThreadCounts = new ArrayList<>();
    AtomicInteger totalCount = new AtomicInteger(0);
    if (link == null) {
      // Get thread count of all entities
      result =
          dao.feedDAO()
              .listCountByEntityLink(
                  StringUtils.EMPTY, Entity.THREAD, StringUtils.EMPTY, Relationship.IS_ABOUT.ordinal(), isResolved);
    } else {
      EntityLink entityLink = EntityLink.parse(link);
      EntityReference reference = EntityUtil.validateEntityLink(entityLink);
      if (reference.getType().equals(Entity.USER) || reference.getType().equals(Entity.TEAM)) {
        if (reference.getType().equals(Entity.USER)) {
          String userId = reference.getId().toString();
          List<String> teamIds = getTeamIds(userId);
          result = dao.feedDAO().listCountByOwner(userId, teamIds, isResolved);
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
                    Relationship.IS_ABOUT.ordinal(),
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

  /**
   * List threads based on the filters and limits in the order of the updated timestamp.
   *
   * @param link entity link filter
   * @param limitPosts the number of posts to limit per thread
   * @param userId UUID of the user. Enables UserId filter
   * @param filterType Type of the filter to be applied with userId filter
   * @param limit the number of threads to limit in the response
   * @param pageMarker the before/after updatedTime to be used as pagination marker for queries
   * @param isResolved whether the thread is resolved or open
   * @param paginationType before or after
   * @return a list of threads as ResultList
   * @throws IOException on error
   * @throws ParseException on error
   */
  @Transaction
  public final ResultList<Thread> list(
      String link,
      int limitPosts,
      String userId,
      FilterType filterType,
      int limit,
      String pageMarker,
      boolean isResolved,
      PaginationType paginationType)
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
        jsons = dao.feedDAO().listBefore(limit + 1, time, isResolved);
      } else {
        jsons = dao.feedDAO().listAfter(limit + 1, time, isResolved);
      }
      threads = JsonUtils.readObjects(jsons, Thread.class);
      total = dao.feedDAO().listCount(isResolved);
    } else {
      // Either one or both the filters are enabled
      // we don't support both the filters together. If both are not null, entity link takes precedence

      if (link != null) {
        EntityLink entityLink = EntityLink.parse(link);
        EntityReference reference = EntityUtil.validateEntityLink(entityLink);

        // For a user entityLink get created or replied relationships to the thread
        if (reference.getType().equals(Entity.USER)) {
          FilteredThreads filteredThreads =
              getThreadsByOwner(reference.getId().toString(), limit + 1, time, isResolved, paginationType);
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
                        isResolved,
                        Relationship.IS_ABOUT.ordinal());
          } else {
            jsons =
                dao.feedDAO()
                    .listThreadsByEntityLinkAfter(
                        entityLink.getFullyQualifiedFieldValue(),
                        entityLink.getFullyQualifiedFieldType(),
                        limit + 1,
                        time,
                        isResolved,
                        Relationship.IS_ABOUT.ordinal());
          }
          threads = JsonUtils.readObjects(jsons, Thread.class);
          total =
              dao.feedDAO()
                  .listCountThreadsByEntityLink(
                      entityLink.getFullyQualifiedFieldValue(),
                      entityLink.getFullyQualifiedFieldType(),
                      isResolved,
                      Relationship.IS_ABOUT.ordinal());
        }
      } else {
        FilteredThreads filteredThreads;
        if (filterType == FilterType.FOLLOWS) {
          filteredThreads = getThreadsByFollows(userId, limit + 1, time, isResolved, paginationType);
        } else if (filterType == FilterType.MENTIONS) {
          filteredThreads = getThreadsByMentions(userId, limit + 1, time, isResolved, paginationType);
        } else {
          filteredThreads = getThreadsByOwner(userId, limit + 1, time, isResolved, paginationType);
        }
        threads = filteredThreads.getThreads();
        total = filteredThreads.getTotalCount();
      }
    }

    limitPostsInThreads(threads, limitPosts);

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

  @Transaction
  public final PatchResponse<Thread> patch(UriInfo uriInfo, UUID id, String user, JsonPatch patch) throws IOException {
    // Get all the fields in the original thread that can be updated during PATCH operation
    Thread original = get(id.toString());

    // Apply JSON patch to the original thread to get the updated thread
    Thread updated = JsonUtils.applyPatch(original, patch, Thread.class);
    // update the "updatedBy" and "updatedAt" fields
    updated.withUpdatedAt(System.currentTimeMillis()).withUpdatedBy(user);

    restorePatchAttributes(original, updated);

    // Update the attributes
    String change = patchUpdate(original, updated) ? RestUtil.ENTITY_UPDATED : RestUtil.ENTITY_NO_CHANGE;
    Thread updatedHref = FeedResource.addHref(uriInfo, updated);
    return new PatchResponse<>(Status.OK, updatedHref, change);
  }

  private void restorePatchAttributes(Thread original, Thread updated) {
    // Patch can't make changes to following fields. Ignore the changes
    updated.withId(original.getId()).withAbout(original.getAbout());
  }

  private boolean patchUpdate(Thread original, Thread updated) throws JsonProcessingException {
    updated.setId(original.getId());

    // store the updated thread
    // if there is no change, there is no need to apply patch
    if (fieldsChanged(original, updated)) {
      dao.feedDAO().update(updated.getId().toString(), JsonUtils.pojoToJson(updated));
      return true;
    }
    return false;
  }

  private boolean fieldsChanged(Thread original, Thread updated) {
    // Patch supports only isResolved and message for now
    return original.getResolved() != updated.getResolved() || !original.getMessage().equals(updated.getMessage());
  }

  /**
   * Limit the number of posts within each thread.
   *
   * @param threads list of threads
   * @param limitPosts the number of posts to limit per thread
   */
  private void limitPostsInThreads(List<Thread> threads, int limitPosts) {
    for (Thread t : threads) {
      List<Post> posts = t.getPosts();
      if (posts.size() > limitPosts) {
        // Only keep the last "n" number of posts
        posts.sort(Comparator.comparing(Post::getPostTs));
        posts = posts.subList(posts.size() - limitPosts, posts.size());
        t.withPosts(posts);
      }
    }
  }

  /**
   * Return the threads associated with user/team owned entities and the threads that were created by or replied to by
   * the user.
   *
   * @param userId UUID of the user
   * @param limit number of threads to limit
   * @param time updatedTime before/after which the results should be filtered for pagination
   * @param isResolved whether the thread is resolved or open
   * @param paginationType before or after
   * @return a list of threads and the total count of threads
   * @throws IOException on error
   */
  private FilteredThreads getThreadsByOwner(
      String userId, int limit, long time, boolean isResolved, PaginationType paginationType) throws IOException {
    // add threads on user or team owned entities
    // and threads created by or replied to by the user
    List<String> teamIds = getTeamIds(userId);
    List<String> jsons;
    if (paginationType == PaginationType.BEFORE) {
      jsons = dao.feedDAO().listThreadsByOwnerBefore(userId, teamIds, limit, time, isResolved);
    } else {
      jsons = dao.feedDAO().listThreadsByOwnerAfter(userId, teamIds, limit, time, isResolved);
    }
    List<Thread> threads = JsonUtils.readObjects(jsons, Thread.class);
    int totalCount = dao.feedDAO().listCountThreadsByOwner(userId, teamIds, isResolved);
    return new FilteredThreads(threads, totalCount);
  }

  /**
   * Get a list of team ids that the given user is a part of.
   *
   * @param userId UUID of the user.
   * @return list of team ids.
   */
  private List<String> getTeamIds(String userId) {
    List<String> teamIds = dao.relationshipDAO().findFrom(userId, Entity.USER, Relationship.HAS.ordinal(), Entity.TEAM);
    if (teamIds.isEmpty()) {
      teamIds = List.of(StringUtils.EMPTY);
    }
    return teamIds;
  }
  /**
   * Returns the threads where the user or the team they belong to were mentioned by other users with @mention.
   *
   * @param userId UUID of the user
   * @param limit number of threads to limit
   * @param time updatedTime before/after which the results should be filtered for pagination
   * @param isResolved whether the thread is resolved or open
   * @param paginationType before or after
   * @return a list of threads and the total count of threads
   * @throws IOException on error
   */
  private FilteredThreads getThreadsByMentions(
      String userId, int limit, long time, boolean isResolved, PaginationType paginationType) throws IOException {
    List<EntityReference> teams =
        EntityUtil.populateEntityReferences(
            dao.relationshipDAO().findFromEntity(userId, Entity.USER, Relationship.HAS.ordinal(), Entity.TEAM));
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
                  user.getName(), teamNames, limit, time, isResolved, Relationship.MENTIONED_IN.ordinal());
    } else {
      jsons =
          dao.feedDAO()
              .listThreadsByMentionsAfter(
                  user.getName(), teamNames, limit, time, isResolved, Relationship.MENTIONED_IN.ordinal());
    }
    List<Thread> threads = JsonUtils.readObjects(jsons, Thread.class);
    int totalCount =
        dao.feedDAO()
            .listCountThreadsByMentions(user.getName(), teamNames, isResolved, Relationship.MENTIONED_IN.ordinal());
    return new FilteredThreads(threads, totalCount);
  }

  /**
   * Returns the threads that are associated with the entities followed by the user.
   *
   * @param userId UUID of the user
   * @param limit number of threads to limit
   * @param time updatedTime before/after which the results should be filtered for pagination
   * @param isResolved whether the thread is resolved or open
   * @param paginationType before or after
   * @return a list of threads and the total count of threads
   * @throws IOException on error
   */
  private FilteredThreads getThreadsByFollows(
      String userId, int limit, long time, boolean isResolved, PaginationType paginationType) throws IOException {
    List<String> jsons;
    if (paginationType == PaginationType.BEFORE) {
      jsons = dao.feedDAO().listThreadsByFollowsBefore(userId, limit, time, isResolved, Relationship.FOLLOWS.ordinal());
    } else {
      jsons = dao.feedDAO().listThreadsByFollowsAfter(userId, limit, time, isResolved, Relationship.FOLLOWS.ordinal());
    }
    List<Thread> threads = JsonUtils.readObjects(jsons, Thread.class);
    int totalCount = dao.feedDAO().listCountThreadsByFollows(userId, isResolved, Relationship.FOLLOWS.ordinal());
    return new FilteredThreads(threads, totalCount);
  }

  public static class FilteredThreads {
    List<Thread> threads;
    int totalCount;

    public FilteredThreads(List<Thread> threads, int totalCount) {
      this.threads = threads;
      this.totalCount = totalCount;
    }

    public List<Thread> getThreads() {
      return threads;
    }

    public int getTotalCount() {
      return totalCount;
    }
  }
}
