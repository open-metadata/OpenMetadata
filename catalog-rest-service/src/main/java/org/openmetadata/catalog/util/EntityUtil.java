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

import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.data.Dashboard;
import org.openmetadata.catalog.entity.data.Database;
import org.openmetadata.catalog.entity.data.Metrics;
import org.openmetadata.catalog.entity.data.Report;
import org.openmetadata.catalog.entity.data.Table;
import org.openmetadata.catalog.entity.services.DatabaseService;
import org.openmetadata.catalog.entity.teams.Team;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.exception.EntityNotFoundException;
import org.openmetadata.catalog.jdbi3.DashboardRepository.DashboardDAO;
import org.openmetadata.catalog.jdbi3.DatabaseRepository.DatabaseDAO;
import org.openmetadata.catalog.jdbi3.EntityRelationshipDAO;
import org.openmetadata.catalog.jdbi3.MetricsRepository.MetricsDAO;
import org.openmetadata.catalog.jdbi3.Relationship;
import org.openmetadata.catalog.jdbi3.ReportRepository.ReportDAO;
import org.openmetadata.catalog.jdbi3.TableRepository.TableDAO;
import org.openmetadata.catalog.jdbi3.TagRepository.TagDAO;
import org.openmetadata.catalog.jdbi3.TeamRepository.TeamDAO;
import org.openmetadata.catalog.jdbi3.UsageRepository.UsageDAO;
import org.openmetadata.catalog.jdbi3.UserRepository.UserDAO;
import org.openmetadata.catalog.resources.databases.DatabaseResource;
import org.openmetadata.catalog.resources.databases.TableResource;
import org.openmetadata.catalog.resources.feeds.MessageParser.EntityLink;
import org.openmetadata.catalog.resources.services.database.DatabaseServiceResource;
import org.openmetadata.catalog.resources.teams.TeamResource;
import org.openmetadata.catalog.resources.teams.UserResource;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.Tag;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.type.TagLabel.LabelType;
import org.openmetadata.catalog.type.UsageDetails;
import org.openmetadata.catalog.type.UsageStats;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.ws.rs.WebApplicationException;
import javax.ws.rs.core.UriInfo;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
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

  /**
   * Populate EntityRef with href
   */
  public static void addHref(UriInfo uriInfo, EntityReference ref) {
    if (ref == null) {
      return;
    }
    switch (ref.getType()) {
      case Entity.TEAM:
        TeamResource.addHref(uriInfo, ref);
        break;
      case Entity.USER:
        UserResource.addHref(uriInfo, ref);
        break;
      case Entity.TABLE:
        TableResource.addHref(uriInfo, ref);
        break;
      case Entity.DATABASE:
        DatabaseResource.addHref(uriInfo, ref);
        break;
      case Entity.DATABASE_SERVICE:
        DatabaseServiceResource.addHref(uriInfo, ref);
        break;
      default:
        throw EntityNotFoundException.byMessage(CatalogExceptionMessage.entityTypeNotFound(ref.getType()));
    }
  }

  public static void addHref(UriInfo uriInfo, List<EntityReference> list) {
    Optional.ofNullable(list).orElse(Collections.emptyList()).forEach(ref -> addHref(uriInfo, ref));
  }

  public static void validateUser(UserDAO userDAO, String userId) {
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
    EntityReference ref =  ids.isEmpty() ? null : EntityUtil.populateOwner(userDAO, teamDAO, ids.get(0));
    return ref;
  }

  /**
   * For given Owner with Id and Type that can be either team or user,
   * validate Owner ID and return fully populated Owner
   */
  public static EntityReference populateOwner(UserDAO userDAO, TeamDAO teamDAO, EntityReference owner)
          throws IOException {
    if (owner == null) {
      return null;
    }
    String id = owner.getId().toString();
    if (owner.getType().equalsIgnoreCase("user")) {
      User ownerInstance = EntityUtil.validate(id, userDAO.findById(id), User.class);
      owner.setName(ownerInstance.getName());
      if (Optional.ofNullable(ownerInstance.getDeactivated()).orElse(false)) {
        throw new IllegalArgumentException(CatalogExceptionMessage.deactivatedUser(id));
      }
    } else if (owner.getType().equalsIgnoreCase("team")) {
      Team ownerInstance = EntityUtil.validate(id, teamDAO.findById(id), Team.class);
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
      LOG.info("Owner {}:{} for entity {}", owner.getType(), owner.getId(), ownedEntityId);
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
    EntityUtil.unassignOwner(dao, originalOwner, ownedEntityId.toString());
    setOwner(dao, ownedEntityId, ownedEntityType, newOwner);
  }

  public static List<EntityReference> getEntityReference(List<EntityReference> list, TableDAO tableDAO,
                                                         DatabaseDAO databaseDAO,
                                                         MetricsDAO metricsDAO, DashboardDAO dashboardDAO,
                                                         ReportDAO reportDAO) throws IOException {
    for (EntityReference ref : list) {
      getEntityReference(ref, tableDAO, databaseDAO, metricsDAO, dashboardDAO, reportDAO);
    }
    return list;
  }

  public static EntityReference getEntityReference(EntityReference ref, TableDAO tableDAO, DatabaseDAO databaseDAO,
                                                   MetricsDAO metricsDAO, DashboardDAO dashboardDAO,
                                                   ReportDAO reportDAO) throws IOException {
    // Note href to entity reference is not added here
    String entity = ref.getType();
    String id = ref.getId().toString();
    if (entity.equalsIgnoreCase(Entity.TABLE)) {
      Table instance = EntityUtil.validate(id, tableDAO.findById(id), Table.class);
      return ref.withDescription(instance.getDescription()).withName(instance.getName());
    } else if (entity.equalsIgnoreCase(Entity.DATABASE)) {
      Database instance = EntityUtil.validate(id, databaseDAO.findById(id), Database.class);
      return ref.withDescription(instance.getDescription()).withName(instance.getName());
    } else if (entity.equalsIgnoreCase(Entity.METRICS)) {
      Metrics instance = EntityUtil.validate(id, metricsDAO.findById(id), Metrics.class);
      return ref.withDescription(instance.getDescription()).withName(instance.getName());
    } else if (entity.equalsIgnoreCase(Entity.DATABASE_SERVICE)) {
      Dashboard instance = EntityUtil.validate(id, dashboardDAO.findById(id), Dashboard.class);
      return ref.withDescription(instance.getDescription()).withName(instance.getName());
    } else if (entity.equalsIgnoreCase(Entity.REPORT)) {
      Report instance = EntityUtil.validate(id, reportDAO.findById(id), Report.class);
      return ref.withDescription(instance.getDescription()).withName(instance.getName());
    }
    throw EntityNotFoundException.byMessage(CatalogExceptionMessage.entityTypeNotFound(entity));
  }

  public static EntityReference getEntityReference(String entity, String id, TableDAO tableDAO, DatabaseDAO databaseDAO,
                                                   MetricsDAO metricsDAO, DashboardDAO dashboardDAO,
                                                   ReportDAO reportDAO) throws IOException {
    EntityReference ref = new EntityReference().withId(UUID.fromString(id)).withType(entity);
    return getEntityReference(ref, tableDAO, databaseDAO, metricsDAO, dashboardDAO, reportDAO);
  }

  public static EntityReference getEntityReferenceByName(String entity, String fqn, TableDAO tableDAO,
                                                         DatabaseDAO databaseDAO, MetricsDAO metricsDAO,
                                                         ReportDAO reportDAO) throws IOException {
    if (entity.equalsIgnoreCase(Entity.TABLE)) {
      Table instance = EntityUtil.validate(fqn, tableDAO.findByFQN(fqn), Table.class);
      return new EntityReference().withId(instance.getId()).withName(instance.getName()).withType(Entity.TABLE)
              .withDescription(instance.getDescription());
    } else if (entity.equalsIgnoreCase(Entity.DATABASE)) {
      Database instance = EntityUtil.validate(fqn, databaseDAO.findByFQN(fqn), Database.class);
      return new EntityReference().withId(instance.getId()).withName(instance.getName()).withType(Entity.DATABASE)
              .withDescription(instance.getDescription());
    } else if (entity.equalsIgnoreCase(Entity.METRICS)) {
      Metrics instance = EntityUtil.validate(fqn, metricsDAO.findByFQN(fqn), Metrics.class);
      return new EntityReference().withId(instance.getId()).withName(instance.getName()).withType(Entity.METRICS)
              .withDescription(instance.getDescription());
    } else if (entity.equalsIgnoreCase(Entity.REPORT)) {
      Report instance = EntityUtil.validate(fqn, reportDAO.findByFQN(fqn), Report.class);
      return new EntityReference().withId(instance.getId()).withName(instance.getName()).withType(Entity.REPORT)
              .withDescription(instance.getDescription());
    }
    throw EntityNotFoundException.byMessage(CatalogExceptionMessage.entityNotFound(entity, fqn));
  }

  public static EntityReference getEntityReference(Object entity, Class<?> clazz) throws IOException {
    if (clazz.toString().toLowerCase().endsWith(Entity.TABLE.toLowerCase())) {
      Table instance = (Table) entity;
      return getEntityReference(instance);
    } else if (clazz.toString().toLowerCase().endsWith(Entity.DATABASE.toLowerCase())) {
      Database instance = (Database) entity;
      return getEntityReference(instance);
    } else if (clazz.toString().toLowerCase().endsWith(Entity.METRICS.toLowerCase())) {
      Metrics instance = (Metrics) entity;
      return getEntityReference(instance);
    } else if (clazz.toString().toLowerCase().endsWith(Entity.DATABASE_SERVICE.toLowerCase())) {
      DatabaseService instance = (DatabaseService) entity;
      return getEntityReference(instance);
    } else if (clazz.toString().toLowerCase().endsWith(Entity.REPORT.toLowerCase())) {
      Report instance = (Report) entity;
      return getEntityReference(instance);
    } else if (clazz.toString().toLowerCase().endsWith(Entity.TEAM.toLowerCase())) {
      Team instance = (Team) entity;
      return getEntityReference(instance);
    } else if (clazz.toString().toLowerCase().endsWith(Entity.USER.toLowerCase())) {
      User instance = (User) entity;
      return getEntityReference(instance);
    }
    throw EntityNotFoundException.byMessage(CatalogExceptionMessage.entityTypeNotFound(
            String.format("Failed to find entity class {}", clazz.toString())));
  }

  public static EntityReference getEntityReference(DatabaseService service) {
    return new EntityReference().withName(service.getName()).withId(service.getId())
            .withType(Entity.DATABASE_SERVICE);
  }

  public static EntityReference validateEntityLink(EntityLink entityLink, UserDAO userDAO, TeamDAO teamDAO,
                                                   TableDAO tableDAO, DatabaseDAO databaseDAO, MetricsDAO metricsDAO,
                                                   DashboardDAO dashboardDAO, ReportDAO reportDAO) throws IOException {
    String entityType = entityLink.getEntityType();
    String fqn = entityLink.getEntityId();
    if (entityType.equals(Entity.USER)) {
      return getEntityReference(EntityUtil.validate(fqn, userDAO.findByName(fqn), User.class));
    } else  if (entityType.equals(Entity.TEAM)) {
      return getEntityReference(EntityUtil.validate(fqn, teamDAO.findByName(fqn), Team.class));
    } else if (entityType.equals(Entity.TABLE)) {
      return getEntityReference(EntityUtil.validate(fqn, tableDAO.findByFQN(fqn), Table.class));
    } else if (entityType.equals(Entity.DATABASE)) {
      return getEntityReference(EntityUtil.validate(fqn, databaseDAO.findByFQN(fqn), Database.class));
    } else if (entityType.equals(Entity.METRICS)) {
      return getEntityReference(EntityUtil.validate(fqn, metricsDAO.findByFQN(fqn), Metrics.class));
    } else if (entityType.equals(Entity.DASHBOARD)) {
      return getEntityReference(EntityUtil.validate(fqn, dashboardDAO.findByFQN(fqn), Dashboard.class));
    } else if (entityType.equals(Entity.REPORT)) {
      return getEntityReference(EntityUtil.validate(fqn, reportDAO.findByFQN(fqn), Report.class));
    } else {
      throw EntityNotFoundException.byMessage(CatalogExceptionMessage.entityNotFound(entityType, fqn));
    }
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

  public static EntityReference getEntityReference(Database database) {
    return new EntityReference().withDescription(database.getDescription()).withId(database.getId())
            .withName(database.getName()).withType(Entity.DATABASE);
  }

  public static EntityReference getEntityReference(Table table) {
    return new EntityReference().withDescription(table.getDescription()).withId(table.getId())
            .withName(table.getName()).withType(Entity.TABLE);
  }

  public static EntityReference getEntityReference(Report report) {
    return new EntityReference().withDescription(report.getDescription()).withId(report.getId())
            .withName(report.getName()).withType(Entity.REPORT);
  }

  public static EntityReference getEntityReference(Metrics metrics) {
    return new EntityReference().withDescription(metrics.getDescription()).withId(metrics.getId())
            .withName(metrics.getName()).withType(Entity.METRICS);
  }

  public static EntityReference getEntityReference(Dashboard dashboard) {
    return new EntityReference().withDescription(dashboard.getDescription()).withId(dashboard.getId())
            .withName(dashboard.getName()).withType(Entity.DASHBOARD);
  }

  public static EntityReference getEntityReference(Team team) {
    return new EntityReference().withDescription(team.getDescription()).withId(team.getId())
            .withName(team.getName()).withType(Entity.TEAM);
  }

  public static EntityReference getEntityReference(User user) {
    return new EntityReference().withDescription(user.getDisplayName()).withId(user.getId())
            .withName(user.getName()).withType(Entity.USER);
  }

  public static void validateTags(TagDAO tagDAO, List<TagLabel> tagLabels) {
    Optional.ofNullable(tagLabels).orElse(Collections.emptyList()).forEach(tagLabel -> {
      if (!tagDAO.tagExists(tagLabel.getTagFQN())) {
        throw EntityNotFoundException.byMessage(CatalogExceptionMessage.entityNotFound(Tag.class.getSimpleName(),
                tagLabel.getTagFQN()));
      }
    });
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
      LOG.info("Applying tag {} to targetFQN {}", tagLabel.getTagFQN(), targetFQN);
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

  public static void removeTags(TagDAO tagDAO, String fullyQualifiedName) {
    tagDAO.deleteTags(fullyQualifiedName);
  }

  public static void removeTagsByPrefix(TagDAO tagDAO, String fullyQualifiedName) {
    tagDAO.deleteTagsByPrefix(fullyQualifiedName);
  }

  public static List<TagLabel> mergeTags(List<TagLabel> list1, List<TagLabel> list2) {
    return Stream.concat(Optional.ofNullable(list1).orElse(Collections.emptyList()).stream(),
            Optional.ofNullable(list2).orElse(Collections.emptyList()).stream())
            .distinct().collect(Collectors.toList());
  }

  public static void publishEntityCreatedEvent(String entity, String entityName, String event) {
    String print = String.format("Entity Created: [%s] Name: [%s] Event: [%s]", entity, entityName, event);
    LOG.info(print);
  }

  public static void publishEntityUpdatedEvent(String entity,
                                               String entityName,
                                               String oldEvent,
                                               String newEvent) {
    String diff = JsonSchemaUtil.diffTwoJson(oldEvent, newEvent);
    String print = String.format("Entity Updated: [%s] Name: [%s] DiffString: [%s]", entity, entityName, diff);
    LOG.info(print);
  }

  public static boolean addFollower(EntityRelationshipDAO dao, UserDAO userDAO, String followedEntityId,
                                    String followedEntityType, String followerId, String followerEntity)
          throws IOException {
    User user = EntityUtil.validate(followerId, userDAO.findById(followerId), User.class);
    if (Optional.ofNullable(user.getDeactivated()).orElse(false)) {
      throw new IllegalArgumentException(CatalogExceptionMessage.deactivatedUser(followerId));
    }
    return dao.insert(followerId, followedEntityId, followerEntity, followedEntityType,
            Relationship.FOLLOWS.ordinal()) > 0;
  }

  public static void removeFollower(EntityRelationshipDAO dao, String followedEntityId, String followerId) {
    dao.delete(followerId, followedEntityId, Relationship.FOLLOWS.ordinal());
  }

  public static List<EntityReference> getFollowers(UUID followedEntityId, EntityRelationshipDAO entityRelationshipDAO,
                                                   UserDAO userDAO) throws IOException {
    List<String> followerIds = entityRelationshipDAO.findFrom(followedEntityId.toString(),
            Relationship.FOLLOWS.ordinal(),
            Entity.USER);
    List<EntityReference> followers = new ArrayList<>();
    for (String followerId : followerIds) {
      User user = EntityUtil.validate(followerId, userDAO.findById(followerId), User.class);
      followers.add(new EntityReference().withName(user.getName()).withId(user.getId()).withType("user"));
    }
    return followers;
  }

  public static class Fields {
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
}
