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
import org.openmetadata.catalog.entity.teams.User;

import org.openmetadata.catalog.resources.feeds.FeedUtil;
import org.openmetadata.catalog.resources.feeds.MessageParser;
import org.openmetadata.catalog.resources.feeds.MessageParser.EntityLink;
import org.openmetadata.catalog.resources.feeds.MessageParser.EntityLink.LinkType;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.Post;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.JsonUtils;
import org.skife.jdbi.v2.sqlobject.Bind;
import org.skife.jdbi.v2.sqlobject.CreateSqlObject;
import org.skife.jdbi.v2.sqlobject.SqlQuery;
import org.skife.jdbi.v2.sqlobject.SqlUpdate;
import org.skife.jdbi.v2.sqlobject.Transaction;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

public abstract class FeedRepository {
  @CreateSqlObject
  abstract FeedDAO feedDAO();

  @CreateSqlObject
  abstract EntityRelationshipDAO relationshipDAO();

  @CreateSqlObject
  abstract FieldRelationshipDAO fieldRelationshipDAO();

  @CreateSqlObject
  abstract UserDAO userDAO();

  @CreateSqlObject
  abstract TeamDAO teamDAO();

  @CreateSqlObject
  abstract TableDAO tableDAO();

  @CreateSqlObject
  abstract DatabaseDAO databaseDAO();

  @CreateSqlObject
  abstract MetricsDAO metricsDAO();

  @CreateSqlObject
  abstract DashboardDAO dashboardDAO();

  @CreateSqlObject
  abstract ReportDAO reportDAO();

  @CreateSqlObject
  abstract TopicDAO topicDAO();

  @CreateSqlObject
  abstract TaskDAO taskDAO();

  @CreateSqlObject
  abstract PipelineDAO pipelineDAO();

  @CreateSqlObject
  abstract ModelDAO modelDAO();

  @Transaction
  public Thread create(Thread thread) throws IOException {
    // Validate user creating thread
    UUID fromUser = thread.getPosts().get(0).getFrom();
    EntityUtil.validate(fromUser.toString(), userDAO().findById(fromUser.toString()), User.class);

    // Validate about data entity is valid
    EntityLink about = EntityLink.parse(thread.getAbout());
    EntityReference aboutRef = EntityUtil.validateEntityLink(about, userDAO(), teamDAO(), tableDAO(),
            databaseDAO(), metricsDAO(), dashboardDAO(), reportDAO(), topicDAO(), taskDAO(), modelDAO(), pipelineDAO());

    // Get owner for the addressed to Entity
    EntityReference owner = EntityUtil.populateOwner(aboutRef.getId(), relationshipDAO(), userDAO(), teamDAO());

    // Insert a new thread
    feedDAO().insert(JsonUtils.pojoToJson(thread));

    // Add relationship User -- created --> Thread relationship
    relationshipDAO().insert(fromUser.toString(), thread.getId().toString(),
            "user", "thread", Relationship.CREATED.ordinal());

    // Add field relationship data asset Thread -- isAbout ---> entity/entityField
    // relationship
    fieldRelationshipDAO().insert(thread.getId().toString(), about.getFullyQualifiedFieldValue(),
            "thread", about.getFullyQualifiedFieldType(), Relationship.IS_ABOUT.ordinal());

    // Add the owner also as addressedTo as the entity he owns when addressed, the owner is actually being addressed
    if (owner != null) {
      relationshipDAO().insert(thread.getId().toString(), owner.getId().toString(), "thread", owner.getType(),
              Relationship.ADDRESSED_TO.ordinal());
    }

    // Create relationship for users, teams, and other entities that are mentioned in the post
    // Multiple mentions of the same entity is handled by taking distinct mentions
    List<EntityLink> mentions = MessageParser.getEntityLinks(thread.getPosts().get(0).getMessage());

    mentions.stream().distinct().forEach(mention ->
            fieldRelationshipDAO().insert(mention.getFullyQualifiedFieldValue(), thread.getId().toString(),
            mention.getFullyQualifiedFieldType(), "thread", Relationship.MENTIONED_IN.ordinal()));

    return thread;
  }

  public Thread get(String id) throws IOException {
    return EntityUtil.validate(id, feedDAO().findById(id), Thread.class);
  }

  @Transaction
  public Thread addPostToThread(String id, Post post) throws IOException {
    // Query 1 - validate user creating thread
    UUID fromUser = post.getFrom();
    EntityUtil.validate(fromUser.toString(), userDAO().findById(fromUser.toString()), User.class);

    // Query 2 - Find the thread
    Thread thread = EntityUtil.validate(id, feedDAO().findById(id), Thread.class);
    FeedUtil.addPost(thread, post);

    // TODO is rewriting entire json okay?
    // Query 3 - update the JSON document for the feed
    feedDAO().update(id, JsonUtils.pojoToJson(thread));

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
      relationshipDAO().insert(post.getFrom().toString(), thread.getId().toString(),
              "user", "thread", Relationship.REPLIED_TO.ordinal());
    }
    return thread;
  }

  @Transaction
  public List<Thread> listThreads(String link) throws IOException {
    if (link == null) {
      // Not listing thread by data asset or user
      return JsonUtils.readObjects(feedDAO().list(), Thread.class);
    }
    EntityLink entityLink = EntityLink.parse(link);
    if (entityLink.getLinkType() != LinkType.ENTITY) {
      throw new IllegalArgumentException("Only entity links of type <E#/{entityType}/{entityName}> is allowed");
    }
    EntityReference reference = EntityUtil.validateEntityLink(entityLink, userDAO(), teamDAO(), tableDAO(),
            databaseDAO(), metricsDAO(), dashboardDAO(), reportDAO(), topicDAO(), taskDAO(), modelDAO(), pipelineDAO());
    List<String> threadIds = new ArrayList<>();
    List<List<String>> result = fieldRelationshipDAO().listToByPrefix(entityLink.getFullyQualifiedFieldValue(),
            entityLink.getFullyQualifiedFieldType(), "thread",
            Relationship.MENTIONED_IN.ordinal());
    result.forEach(l -> threadIds.add(l.get(1)));

    // TODO remove hardcoding of thread
    // For a user entitylink get created or replied relationships to the thread
    if (reference.getType().equals(Entity.USER)) {
      threadIds.addAll(relationshipDAO().findTo(reference.getId().toString(),
              Relationship.CREATED.ordinal(), "thread"));
      threadIds.addAll(relationshipDAO().findTo(reference.getId().toString(),
              Relationship.REPLIED_TO.ordinal(), "thread"));
    } else {
      // Only data assets are added as about
      result = fieldRelationshipDAO().listToByPrefix(entityLink.getFullyQualifiedFieldValue(),
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
        threads.add(EntityUtil.validate(t, feedDAO().findById(t), Thread.class));
      }
    }

    return threads;
  }

  public interface FeedDAO {
    @SqlUpdate("INSERT INTO thread_entity(json) VALUES (:json)")
    void insert(@Bind("json") String json);

    @SqlQuery("SELECT json FROM thread_entity WHERE id = :id")
    String findById(@Bind("id") String id);

    @SqlQuery("SELECT json FROM thread_entity")
    List<String> list();

    @SqlUpdate("UPDATE thread_entity SET json = :json where id = :id")
    void update(@Bind("id") String id, @Bind("json") String json);
  }
}