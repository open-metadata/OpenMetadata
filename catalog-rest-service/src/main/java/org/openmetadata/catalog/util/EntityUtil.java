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

package org.openmetadata.catalog.util;

import org.joda.time.Period;
import org.joda.time.format.ISOPeriodFormat;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.teams.Team;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.exception.EntityNotFoundException;
import org.openmetadata.catalog.jdbi3.CollectionDAO;
import org.openmetadata.catalog.jdbi3.CollectionDAO.EntityRelationshipDAO;
import org.openmetadata.catalog.jdbi3.CollectionDAO.TagDAO;
import org.openmetadata.catalog.jdbi3.CollectionDAO.TeamDAO;
import org.openmetadata.catalog.jdbi3.CollectionDAO.UsageDAO;
import org.openmetadata.catalog.jdbi3.CollectionDAO.UserDAO;
import org.openmetadata.catalog.jdbi3.Relationship;
import org.openmetadata.catalog.resources.charts.ChartResource;
import org.openmetadata.catalog.resources.dashboards.DashboardResource;
import org.openmetadata.catalog.resources.databases.DatabaseResource;
import org.openmetadata.catalog.resources.databases.TableResource;
import org.openmetadata.catalog.resources.feeds.MessageParser.EntityLink;
import org.openmetadata.catalog.resources.models.ModelResource;
import org.openmetadata.catalog.resources.pipelines.PipelineResource;
import org.openmetadata.catalog.resources.services.dashboard.DashboardServiceResource;
import org.openmetadata.catalog.resources.services.database.DatabaseServiceResource;
import org.openmetadata.catalog.resources.services.messaging.MessagingServiceResource;
import org.openmetadata.catalog.resources.services.pipeline.PipelineServiceResource;
import org.openmetadata.catalog.resources.teams.TeamResource;
import org.openmetadata.catalog.resources.teams.UserResource;
import org.openmetadata.catalog.resources.topics.TopicResource;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.Tag;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.type.TagLabel.LabelType;
import org.openmetadata.catalog.type.UsageDetails;
import org.openmetadata.catalog.type.UsageStats;
import org.openmetadata.catalog.type.Schedule;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.ws.rs.WebApplicationException;
import javax.ws.rs.core.UriInfo;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.Date;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;

public final class EntityUtil {
  private static final Logger LOG = LoggerFactory.getLogger(EntityUtil.class);

  private EntityUtil() {

  }

  /**
   * Validate Ingestion Schedule 
   */
  public static void validateIngestionSchedule(Schedule ingestion) {
    if (ingestion == null) {
      return;
    }
    String duration = ingestion.getRepeatFrequency();

    // ISO8601 duration format is P{y}Y{m}M{d}DT{h}H{m}M{s}S.
    String[] splits = duration.split("T");
    if (splits[0].contains("Y") || splits[0].contains("M") ||
            (splits.length == 2 && splits[1].contains("S"))) {
      throw new IllegalArgumentException("Ingestion repeatFrequency can only contain Days, Hours, and Minutes - " +
              "example P{d}DT{h}H{m}M");
    }

    Period period;
    try {
      period = ISOPeriodFormat.standard().parsePeriod(duration);
    } catch (IllegalArgumentException e) {
      throw new IllegalArgumentException("Invalid ingestion repeatFrequency " + duration, e);
    }
    if (period.toStandardMinutes().getMinutes() < 60) {
      throw new IllegalArgumentException("Ingestion repeatFrequency is too short and must be more than 60 minutes");
    }
  }

  /**
   * Validate that JSON payload can be turned into POJO object
   */
  public static <T> T validate(String identity, String json, Class<T> clz) throws WebApplicationException, IOException {
    T entity = null;
    if (json != null) {
      entity = JsonUtils.readValue(json, clz);
    }
    if (entity == null) {
      throw EntityNotFoundException.byMessage(CatalogExceptionMessage.entityNotFound(clz.getSimpleName(), identity));
    }
    return entity;
  }

  public static EntityReference getService(EntityRelationshipDAO dao, UUID entityId) {
    List<EntityReference> refs = dao.findFrom(entityId.toString(), Relationship.CONTAINS.ordinal());
    if (refs.size() > 1) {
      LOG.warn("Possible database issues - multiple services found for entity {}", entityId);
      return refs.get(0);
    }
    return refs.isEmpty() ? null : refs.get(0);
  }

  public static EntityReference getService(EntityRelationshipDAO dao, UUID entityId, String serviceType) {
    List<EntityReference> refs = dao.findFromEntity(entityId.toString(), Relationship.CONTAINS.ordinal(), serviceType);
    if (refs.size() > 1) {
      LOG.warn("Possible database issues - multiple services found for entity {}", entityId);
      return refs.get(0);
    }
    return refs.isEmpty() ? null : refs.get(0);
  }

  /**
   * Populate EntityRef with href
   */
  public static void addHref(UriInfo uriInfo, EntityReference ref) {
    if (ref == null) {
      return;
    }
    String entity = ref.getType();
    if (entity.equalsIgnoreCase(Entity.TEAM)) {
      TeamResource.addHref(uriInfo, ref);
    } else if (entity.equalsIgnoreCase(Entity.USER)) {
      UserResource.addHref(uriInfo, ref);
    } else if (entity.equalsIgnoreCase(Entity.TABLE)) {
      TableResource.addHref(uriInfo, ref);
    } else if (entity.equalsIgnoreCase(Entity.DATABASE)) {
      DatabaseResource.addHref(uriInfo, ref);
    } else if (entity.equalsIgnoreCase(Entity.TOPIC)) {
      TopicResource.addHref(uriInfo, ref);
    } else if (entity.equalsIgnoreCase(Entity.CHART)) {
      ChartResource.addHref(uriInfo, ref);
    } else if (entity.equalsIgnoreCase(Entity.DASHBOARD)) {
      DashboardResource.addHref(uriInfo, ref);
    } else if (entity.equalsIgnoreCase(Entity.MODEL)) {
      ModelResource.addHref(uriInfo, ref);
    } else if (entity.equalsIgnoreCase(Entity.PIPELINE)) {
      PipelineResource.addHref(uriInfo, ref);
    } else if (entity.equalsIgnoreCase(Entity.DATABASE_SERVICE)) {
      DatabaseServiceResource.addHref(uriInfo, ref);
    } else if (entity.equalsIgnoreCase(Entity.MESSAGING_SERVICE)) {
      MessagingServiceResource.addHref(uriInfo, ref);
    } else if (entity.equalsIgnoreCase(Entity.DASHBOARD_SERVICE)) {
      DashboardServiceResource.addHref(uriInfo, ref);
    } else if (entity.equalsIgnoreCase(Entity.PIPELINE_SERVICE)) {
      PipelineServiceResource.addHref(uriInfo, ref);
    } else {
      throw EntityNotFoundException.byMessage(CatalogExceptionMessage.entityTypeNotFound(ref.getType()));
    }
  }

  public static void addHref(UriInfo uriInfo, List<EntityReference> list) {
    Optional.ofNullable(list).orElse(Collections.emptyList()).forEach(ref -> addHref(uriInfo, ref));
  }

  public static void validateUser(UserDAO userDAO, UUID userId) {
    if (!userDAO.exists(userId)) {
      throw EntityNotFoundException.byMessage(CatalogExceptionMessage.entityNotFound(Entity.USER, userId));
    }
  }

  // Get owner for a given entity
  public static EntityReference populateOwner(UUID id, EntityRelationshipDAO entityRelationshipDAO, UserDAO userDAO,
                                              TeamDAO teamDAO) throws IOException {
    List<EntityReference> ids = entityRelationshipDAO.findFrom(id.toString(), Relationship.OWNS.ordinal());
    if (ids.size() > 1) {
      LOG.warn("Possible database issues - multiple owners {} found for entity {}", ids, id);
    }
    return ids.isEmpty() ? null : EntityUtil.populateOwner(userDAO, teamDAO, ids.get(0));
  }

  public static EntityReference populateOwner(UserDAO userDAO, TeamDAO teamDAO,
                                              EntityReference owner)
          throws IOException {
    if (owner == null) {
      return null;
    }
    UUID id = owner.getId();
    if (owner.getType().equalsIgnoreCase("user")) {
      User ownerInstance = userDAO.findEntityById(id);
      owner.setName(ownerInstance.getName());
      if (Optional.ofNullable(ownerInstance.getDeactivated()).orElse(false)) {
        throw new IllegalArgumentException(CatalogExceptionMessage.deactivatedUser(id));
      }
    } else if (owner.getType().equalsIgnoreCase("team")) {
      Team ownerInstance = teamDAO.findEntityById(id);
      owner.setDescription(ownerInstance.getDescription());
      owner.setName(ownerInstance.getName());
    } else {
      throw new IllegalArgumentException(String.format("Invalid ownerType %s", owner.getType()));
    }
    return owner;
  }

  public static void setOwner(EntityRelationshipDAO dao, UUID ownedEntityId, String ownedEntityType,
                              EntityReference owner) {
    // Add relationship owner --- owns ---> ownedEntity
    if (owner != null) {
      LOG.info("Adding owner {}:{} for entity {}:{}", owner.getType(), owner.getId(), ownedEntityType, ownedEntityId);
      dao.insert(owner.getId().toString(), ownedEntityId.toString(), owner.getType(), ownedEntityType,
              Relationship.OWNS.ordinal());
    }
  }

  /**
   * Unassign owner relationship for a given entity
   */
  public static void unassignOwner(EntityRelationshipDAO dao, EntityReference owner, String ownedEntityId) {
    if (owner != null && owner.getId() != null) {
      LOG.info("Removing owner {}:{} for entity {}", owner.getType(), owner.getId(),
              ownedEntityId);
      dao.delete(owner.getId().toString(), ownedEntityId, Relationship.OWNS.ordinal());
    }
  }

  public static void updateOwner(EntityRelationshipDAO dao, EntityReference originalOwner, EntityReference newOwner,
                                 UUID ownedEntityId, String ownedEntityType) {
    // TODO inefficient use replace instead of delete and add?
    // TODO check for orig and new owners being the same
    unassignOwner(dao, originalOwner, ownedEntityId.toString());
    setOwner(dao, ownedEntityId, ownedEntityType, newOwner);
  }

  public static List<EntityReference> getEntityReference(List<EntityReference> list, CollectionDAO dao)
          throws IOException {
    for (EntityReference ref : list) {
      getEntityReference(ref, dao);
    }
    return list;
  }

  public static EntityReference getEntityReference(EntityReference ref, CollectionDAO dao) throws IOException {
    // Note href to entity reference is not added here
    EntityReference ref2 = getEntityReference(ref.getType(), ref.getId(), dao);
    return ref.withDescription(ref2.getDescription()).withName(ref2.getName());
  }

  public static EntityReference getEntityReference(String entity, UUID id, CollectionDAO dao) throws IOException {
    if (entity.equalsIgnoreCase(Entity.TABLE)) {
      return dao.tableDAO().findEntityReferenceById(id);
    } else if (entity.equalsIgnoreCase(Entity.DATABASE)) {
      return dao.databaseDAO().findEntityReferenceById(id);
    } else if (entity.equalsIgnoreCase(Entity.METRICS)) {
      return dao.metricsDAO().findEntityReferenceById(id);
    } else if (entity.equalsIgnoreCase(Entity.DASHBOARD)) {
      return dao.dashboardDAO().findEntityReferenceById(id);
    } else if (entity.equalsIgnoreCase(Entity.REPORT)) {
      return dao.reportDAO().findEntityReferenceById(id);
    } else if (entity.equalsIgnoreCase(Entity.TOPIC)) {
      return dao.topicDAO().findEntityReferenceById(id);
    } else if (entity.equalsIgnoreCase(Entity.CHART)) {
      return dao.chartDAO().findEntityReferenceById(id);
    } else if (entity.equalsIgnoreCase(Entity.PIPELINE)) {
      return dao.pipelineDAO().findEntityReferenceById(id);
    } else if (entity.equalsIgnoreCase(Entity.MODEL)) {
      return dao.modelDAO().findEntityReferenceById(id);
    }
    throw EntityNotFoundException.byMessage(CatalogExceptionMessage.entityTypeNotFound(entity));
  }

  public static EntityReference getEntityReferenceByName(String entity, String fqn, CollectionDAO dao)
          throws IOException {
    if (entity.equalsIgnoreCase(Entity.TABLE)) {
      return dao.tableDAO().findEntityReferenceByName(fqn);
    } else if (entity.equalsIgnoreCase(Entity.DATABASE)) {
      return dao.databaseDAO().findEntityReferenceByName(fqn);
    } else if (entity.equalsIgnoreCase(Entity.METRICS)) {
      return dao.metricsDAO().findEntityReferenceByName(fqn);
    } else if (entity.equalsIgnoreCase(Entity.REPORT)) {
      return dao.reportDAO().findEntityReferenceByName(fqn);
    } else if (entity.equalsIgnoreCase(Entity.TOPIC)) {
      return dao.topicDAO().findEntityReferenceByName(fqn);
    } else if (entity.equalsIgnoreCase(Entity.CHART)) {
      return dao.chartDAO().findEntityReferenceByName(fqn);
    } else if (entity.equalsIgnoreCase(Entity.DASHBOARD)) {
      return dao.dashboardDAO().findEntityReferenceByName(fqn);
    } else if (entity.equalsIgnoreCase(Entity.PIPELINE)) {
      return dao.pipelineDAO().findEntityReferenceByName(fqn);
    } else if (entity.equalsIgnoreCase(Entity.MODEL)) {
      return dao.modelDAO().findEntityReferenceByName(fqn);
    } else if (entity.equalsIgnoreCase(Entity.USER)) {
      return dao.userDAO().findEntityReferenceByName(fqn);
    } else if (entity.equalsIgnoreCase(Entity.TEAM)) {
      return dao.teamDAO().findEntityReferenceByName(fqn);
    }
    throw EntityNotFoundException.byMessage(CatalogExceptionMessage.entityNotFound(entity, fqn));
  }


  public static EntityReference validateEntityLink(EntityLink entityLink, CollectionDAO dao)
          throws IOException {
    String entityType = entityLink.getEntityType();
    String fqn = entityLink.getEntityId();
    return getEntityReferenceByName(entityType, fqn, dao);
  }

  public static UsageDetails getLatestUsage(UsageDAO usageDAO, UUID entityId) {
    LOG.debug("Getting latest usage for {}", entityId);
    UsageDetails details = usageDAO.getLatestUsage(entityId.toString());
    if (details == null) {
      LOG.debug("Usage details not found. Sending default usage");
      UsageStats stats = new UsageStats().withCount(0).withPercentileRank(0.0);
      details = new UsageDetails().withDailyStats(stats).withWeeklyStats(stats).withMonthlyStats(stats)
              .withDate(RestUtil.DATE_FORMAT.format(new Date()));
    }
    return details;
  }

  /**
   * Apply tags {@code tagLabels} to the entity or field identified by {@code targetFQN}
   */
  public static void applyTags(TagDAO tagDAO, List<TagLabel> tagLabels, String targetFQN) throws IOException {
    for (TagLabel tagLabel : Optional.ofNullable(tagLabels).orElse(Collections.emptyList())) {
      String json = tagDAO.findTag(tagLabel.getTagFQN());
      if (json == null) {
        // Invalid TagLabel
        throw EntityNotFoundException.byMessage(CatalogExceptionMessage.entityNotFound(Tag.class.getSimpleName(),
                tagLabel.getTagFQN()));
      }
      Tag tag = JsonUtils.readValue(json, Tag.class);

      // Apply tagLabel to targetFQN that identifies an entity or field
      tagDAO.applyTag(tagLabel.getTagFQN(), targetFQN, tagLabel.getLabelType().ordinal(),
              tagLabel.getState().ordinal());

      // Apply derived tags
      List<TagLabel> derivedTags = getDerivedTags(tagLabel, tag);
      applyTags(tagDAO, derivedTags, targetFQN);
    }
  }

  public static List<TagLabel> getDerivedTags(TagLabel tagLabel, Tag tag) {
    List<TagLabel> derivedTags = new ArrayList<>();
    for (String fqn : Optional.ofNullable(tag.getAssociatedTags()).orElse(Collections.emptyList())) {
      derivedTags.add(new TagLabel().withTagFQN(fqn).withState(tagLabel.getState()).withLabelType(LabelType.DERIVED));
    }
    return derivedTags;
  }

  /**
   * Validate given list of tags and add derived tags to it
   */
  public static List<TagLabel> addDerivedTags(TagDAO tagDAO, List<TagLabel> tagLabels) throws IOException {
    List<TagLabel> updatedTagLabels = new ArrayList<>();
    for (TagLabel tagLabel : Optional.ofNullable(tagLabels).orElse(Collections.emptyList())) {
      String json = tagDAO.findTag(tagLabel.getTagFQN());
      if (json == null) {
        // Invalid TagLabel
        throw EntityNotFoundException.byMessage(CatalogExceptionMessage.entityNotFound(Tag.class.getSimpleName(),
                tagLabel.getTagFQN()));
      }
      Tag tag = JsonUtils.readValue(json, Tag.class);
      updatedTagLabels.add(tagLabel);

      // Apply derived tags
      List<TagLabel> derivedTags = getDerivedTags(tagLabel, tag);
      updatedTagLabels = EntityUtil.mergeTags(updatedTagLabels, derivedTags);
    }
    return updatedTagLabels;
  }

  public static void removeTags(TagDAO tagDAO, String fullyQualifiedName) {
    tagDAO.deleteTags(fullyQualifiedName);
  }

  public static void removeTagsByPrefix(TagDAO tagDAO, String fullyQualifiedName) {
    tagDAO.deleteTagsByPrefix(fullyQualifiedName);
  }

  public static List<TagLabel> mergeTags(List<TagLabel> list1, List<TagLabel> list2) {
    List<TagLabel> mergedTags = Stream.concat(Optional.ofNullable(list1).orElse(Collections.emptyList()).stream(),
            Optional.ofNullable(list2).orElse(Collections.emptyList()).stream())
            .distinct().collect(Collectors.toList());
    return mergedTags.isEmpty() ? null : mergedTags;
  }

  public static void publishEntityCreatedEvent(String entity, String entityName, String event) {
    String print = String.format("Entity Created: [%s] Name: [%s] Event: [%s]", entity, entityName, event);
    LOG.info(print);
  }

  public static void publishEntityUpdatedEvent(String entity,
                                               String entityName,
                                               String oldEvent,
                                               String newEvent) {
    String diff = JsonUtils.diffTwoJson(oldEvent, newEvent);
    String print = String.format("Entity Updated: [%s] Name: [%s] DiffString: [%s]", entity, entityName, diff);
    LOG.info(print);
  }

  public static boolean addFollower(EntityRelationshipDAO dao, UserDAO userDAO,
                                    UUID followedEntityId,
                                    String followedEntityType, UUID followerId, String followerEntity)
          throws IOException {
    User user = userDAO.findEntityById(followerId);
    if (Optional.ofNullable(user.getDeactivated()).orElse(false)) {
      throw new IllegalArgumentException(CatalogExceptionMessage.deactivatedUser(followerId));
    }
    return dao.insert(followerId.toString(), followedEntityId.toString(), followerEntity, followedEntityType,
            Relationship.FOLLOWS.ordinal()) > 0;
  }

  public static void removeFollower(EntityRelationshipDAO dao, UUID followedEntityId, UUID followerId) {
    dao.delete(followerId.toString(), followedEntityId.toString(), Relationship.FOLLOWS.ordinal());
  }

  public static List<EntityReference> getFollowers(UUID followedEntityId, EntityRelationshipDAO entityRelationshipDAO,
                                                   UserDAO userDAO) throws IOException {
    List<String> followerIds = entityRelationshipDAO.findFrom(followedEntityId.toString(),
            Relationship.FOLLOWS.ordinal(),
            Entity.USER);
    List<EntityReference> followers = new ArrayList<>();
    for (String followerId : followerIds) {
      User user = userDAO.findEntityById(UUID.fromString(followerId));
      followers.add(new EntityReference().withName(user.getName()).withId(user.getId()).withType("user"));
    }
    return followers;
  }

  public static class Fields {
    public static final Fields EMPTY_FIELDS = new Fields(null, null);
    private final List<String> fieldList;

    public Fields(List<String> validFields, String fieldsParam) {
      if (fieldsParam == null) {
        fieldList = Collections.emptyList();
        return;
      }
      fieldList = Arrays.asList(fieldsParam.replaceAll("\\s", "").split(","));
      for (String field : fieldList) {
        if (!validFields.contains(field)) {
          throw new IllegalArgumentException(CatalogExceptionMessage.invalidField(field));
        }
      }
    }

    public boolean contains(String field) {
      return fieldList.contains(field);
    }
  }

  public static List<UUID> getIDList(List<EntityReference> refList) {
    if (refList == null) {
      return null;
    }
    return refList.stream().sorted(Comparator.comparing(EntityReference::getId)).map(EntityReference::getId)
            .collect(Collectors.toList());
  }

  public static String getVersionExtension(String entityName, Double version) {
    return String.format("%s.%s.%s", entityName, "version", version.toString());
  }

  public static String getVersionExtensionPrefix(String entityName) {
    return String.format("%s.%s", entityName, "version");
  }

  public static Double getVersion(String extension) {
    String[] s = extension.split("\\.");
    String versionString = s[2] + "." + s[3];
    return Double.valueOf(versionString);
  }

  public static String getLocalColumnName(String fqn) {
    // Return for fqn=service.database.table.c1 -> c1
    // Return for fqn=service.database.table.c1.c2 -> c1.c2 (note different from just the local name of the column c2)
    StringBuilder localColumnName = new StringBuilder();
    String[] s = fqn.split("\\.");
    for (int i = 3; i < s.length -1 ; i++) {
      localColumnName.append(s[i]).append(".");
    }
    localColumnName.append(s[s.length - 1]);
    return localColumnName.toString();
  }
}
