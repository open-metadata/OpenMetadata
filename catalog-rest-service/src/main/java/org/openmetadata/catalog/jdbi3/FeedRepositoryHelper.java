/*
 *  Licensed to the Apache Software Foundation (ASF) under one or more
 *  contributor license agreements. See the NOTICE file distributed with
 *  this work for additional information regarding copyright ownership.
 *  The ASF licenses this file to You under the Apache License, Version 2.0
 *  (the "License"); you may not use this file except in compliance with
 *  the License. You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.catalog.jdbi3;

import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.feed.Thread;
import org.openmetadata.catalog.resources.feeds.FeedUtil;
import org.openmetadata.catalog.resources.feeds.MessageParser;
import org.openmetadata.catalog.resources.feeds.MessageParser.EntityLink;
import org.openmetadata.catalog.resources.feeds.MessageParser.EntityLink.LinkType;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.Post;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.JsonUtils;
import org.skife.jdbi.v2.sqlobject.Transaction;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

public class FeedRepositoryHelper {
  public FeedRepositoryHelper(FeedRepository3 repo3) { this.repo3 = repo3; }

  private final FeedRepository3 repo3;

  @Transaction
  public Thread create(Thread thread) throws IOException {
    // Validate user creating thread
    UUID fromUser = thread.getPosts().get(0).getFrom();
    repo3.userDAO().findEntityById(fromUser.toString());

    // Validate about data entity is valid
    EntityLink about = EntityLink.parse(thread.getAbout());
    EntityReference aboutRef = EntityUtil.validateEntityLink(about, repo3.userDAO(), repo3.teamDAO(), repo3.tableDAO(),
            repo3.databaseDAO(), repo3.metricsDAO(), repo3.dashboardDAO(), repo3.reportDAO(), repo3.topicDAO(),
            repo3.taskDAO(), repo3.modelDAO(), repo3.pipelineDAO());

    // Get owner for the addressed to Entity
    EntityReference owner = EntityUtil.populateOwner(aboutRef.getId(),
            repo3.relationshipDAO(), repo3.userDAO(), repo3.teamDAO());

    // Insert a new thread
    repo3.feedDAO().insert(JsonUtils.pojoToJson(thread));

    // Add relationship User -- created --> Thread relationship
    repo3.relationshipDAO().insert(fromUser.toString(), thread.getId().toString(),
            "user", "thread", Relationship.CREATED.ordinal());

    // Add field relationship data asset Thread -- isAbout ---> entity/entityField
    // relationship
    repo3.fieldRelationshipDAO().insert(thread.getId().toString(), about.getFullyQualifiedFieldValue(),
            "thread", about.getFullyQualifiedFieldType(), Relationship.IS_ABOUT.ordinal());

    // Add the owner also as addressedTo as the entity he owns when addressed, the owner is actually being addressed
    if (owner != null) {
      repo3.relationshipDAO().insert(thread.getId().toString(), owner.getId().toString(), "thread", owner.getType(),
              Relationship.ADDRESSED_TO.ordinal());
    }

    // Create relationship for users, teams, and other entities that are mentioned in the post
    // Multiple mentions of the same entity is handled by taking distinct mentions
    List<EntityLink> mentions = MessageParser.getEntityLinks(thread.getPosts().get(0).getMessage());

    mentions.stream().distinct().forEach(mention ->
            repo3.fieldRelationshipDAO().insert(mention.getFullyQualifiedFieldValue(), thread.getId().toString(),
            mention.getFullyQualifiedFieldType(), "thread", Relationship.MENTIONED_IN.ordinal()));

    return thread;
  }

  public Thread get(String id) throws IOException {
    return EntityUtil.validate(id, repo3.feedDAO().findById(id), Thread.class);
  }

  @Transaction
  public Thread addPostToThread(String id, Post post) throws IOException {
    // Query 1 - validate user creating thread
    UUID fromUser = post.getFrom();
    repo3.userDAO().findEntityById(fromUser.toString());

    // Query 2 - Find the thread
    Thread thread = EntityUtil.validate(id, repo3.feedDAO().findById(id), Thread.class);
    FeedUtil.addPost(thread, post);

    // TODO is rewriting entire json okay?
    // Query 3 - update the JSON document for the feed
    repo3.feedDAO().update(id, JsonUtils.pojoToJson(thread));

    // Query 4 - Add relation User -- repliedTo --> Thread
    // Add relationship from thread to the from entity that is posting a reply
    boolean relationAlreadyExists = false;
    for (Post p : thread.getPosts()) {
      if (p.getFrom().equals(post.getFrom())) {
        relationAlreadyExists = true;
        break;
      }
    }
    if (!relationAlreadyExists) {
      repo3.relationshipDAO().insert(post.getFrom().toString(), thread.getId().toString(),
              "user", "thread", Relationship.REPLIED_TO.ordinal());
    }
    return thread;
  }

  @Transaction
  public List<Thread> listThreads(String link) throws IOException {
    if (link == null) {
      // Not listing thread by data asset or user
      return JsonUtils.readObjects(repo3.feedDAO().list(), Thread.class);
    }
    EntityLink entityLink = EntityLink.parse(link);
    if (entityLink.getLinkType() != LinkType.ENTITY) {
      throw new IllegalArgumentException("Only entity links of type <E#/{entityType}/{entityName}> is allowed");
    }
    EntityReference reference = EntityUtil.validateEntityLink(entityLink, repo3.userDAO(), repo3.teamDAO(),
            repo3.tableDAO(), repo3.databaseDAO(), repo3.metricsDAO(), repo3.dashboardDAO(), repo3.reportDAO(),
            repo3.topicDAO(), repo3.taskDAO(), repo3.modelDAO(), repo3.pipelineDAO());
    List<String> threadIds = new ArrayList<>();
    List<List<String>> result = repo3.fieldRelationshipDAO().listToByPrefix(entityLink.getFullyQualifiedFieldValue(),
            entityLink.getFullyQualifiedFieldType(), "thread",
            Relationship.MENTIONED_IN.ordinal());
    result.forEach(l -> threadIds.add(l.get(1)));

    // TODO remove hardcoding of thread
    // For a user entitylink get created or replied relationships to the thread
    if (reference.getType().equals(Entity.USER)) {
      threadIds.addAll(repo3.relationshipDAO().findTo(reference.getId().toString(),
              Relationship.CREATED.ordinal(), "thread"));
      threadIds.addAll(repo3.relationshipDAO().findTo(reference.getId().toString(),
              Relationship.REPLIED_TO.ordinal(), "thread"));
    } else {
      // Only data assets are added as about
      result = repo3.fieldRelationshipDAO().listToByPrefix(entityLink.getFullyQualifiedFieldValue(),
              entityLink.getFullyQualifiedFieldType(), "thread",
              Relationship.IS_ABOUT.ordinal());
      result.forEach(l -> threadIds.add(l.get(1)));
    }

    List<Thread> threads = new ArrayList<>();
    Set<String> uniqueValues = new HashSet<>();
    for (String t : threadIds) {
      // If an entity has multiple relationships (created, mentioned, repliedTo etc.) to the same thread
      // Don't sent duplicated copies of the thread in response
      if (uniqueValues.add(t)) {
        threads.add(EntityUtil.validate(t, repo3.feedDAO().findById(t), Thread.class));
      }
    }

    return threads;
  }

}