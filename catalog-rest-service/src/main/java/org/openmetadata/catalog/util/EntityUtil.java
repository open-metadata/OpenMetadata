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

package org.openmetadata.catalog.util;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.Date;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.function.BiPredicate;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import javax.ws.rs.WebApplicationException;
import org.joda.time.Period;
import org.joda.time.format.ISOPeriodFormat;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.teams.Team;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.exception.EntityNotFoundException;
import org.openmetadata.catalog.jdbi3.CollectionDAO.EntityRelationshipDAO;
import org.openmetadata.catalog.jdbi3.CollectionDAO.EntityVersionPair;
import org.openmetadata.catalog.jdbi3.CollectionDAO.TagDAO;
import org.openmetadata.catalog.jdbi3.CollectionDAO.TeamDAO;
import org.openmetadata.catalog.jdbi3.CollectionDAO.UsageDAO;
import org.openmetadata.catalog.jdbi3.CollectionDAO.UserDAO;
import org.openmetadata.catalog.jdbi3.Relationship;
import org.openmetadata.catalog.resources.feeds.MessageParser.EntityLink;
import org.openmetadata.catalog.type.Column;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.FieldChange;
import org.openmetadata.catalog.type.MlFeature;
import org.openmetadata.catalog.type.MlHyperParameter;
import org.openmetadata.catalog.type.Schedule;
import org.openmetadata.catalog.type.TableConstraint;
import org.openmetadata.catalog.type.Tag;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.type.TagLabel.LabelType;
import org.openmetadata.catalog.type.Task;
import org.openmetadata.catalog.type.UsageDetails;
import org.openmetadata.catalog.type.UsageStats;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public final class EntityUtil {
  private static final Logger LOG = LoggerFactory.getLogger(EntityUtil.class);

  //
  // Comparators used for sorting list based on the given type
  //

  // Note ordering is same as server side ordering by ID as string to ensure PATCH operations work
  public static final Comparator<EntityReference> compareEntityReference =
      Comparator.comparing(entityReference -> entityReference.getId().toString());
  public static final Comparator<EntityVersionPair> compareVersion =
      Comparator.comparing(EntityVersionPair::getVersion);
  public static final Comparator<TagLabel> compareTagLabel = Comparator.comparing(TagLabel::getTagFQN);
  public static final Comparator<FieldChange> compareFieldChange = Comparator.comparing(FieldChange::getName);
  public static final Comparator<TableConstraint> compareTableConstraint =
      Comparator.comparing(TableConstraint::getConstraintType);

  //
  // Matchers used for matching two items in a list
  //
  public static final BiPredicate<Object, Object> objectMatch = Object::equals;

  public static final BiPredicate<EntityReference, EntityReference> entityReferenceMatch =
      (ref1, ref2) -> ref1.getId().equals(ref2.getId());

  public static final BiPredicate<TagLabel, TagLabel> tagLabelMatch =
      (tag1, tag2) -> tag1.getTagFQN().equals(tag2.getTagFQN());

  public static final BiPredicate<Task, Task> taskMatch = (task1, task2) -> task1.getName().equals(task2.getName());

  public static final BiPredicate<String, String> stringMatch = String::equals;

  public static final BiPredicate<Column, Column> columnMatch =
      (column1, column2) ->
          column1.getName().equals(column2.getName())
              && column1.getDataType() == column2.getDataType()
              && column1.getArrayDataType() == column2.getArrayDataType()
              && Objects.equals(column1.getOrdinalPosition(), column2.getOrdinalPosition());

  public static final BiPredicate<Column, Column> columnNameMatch =
      (column1, column2) -> column1.getName().equals(column2.getName());

  public static final BiPredicate<TableConstraint, TableConstraint> tableConstraintMatch =
      (constraint1, constraint2) ->
          constraint1.getConstraintType() == constraint2.getConstraintType()
              && constraint1.getColumns().equals(constraint2.getColumns());

  public static final BiPredicate<MlFeature, MlFeature> mlFeatureMatch = MlFeature::equals;
  public static final BiPredicate<MlHyperParameter, MlHyperParameter> mlHyperParameterMatch = MlHyperParameter::equals;

  private EntityUtil() {}

  /** Validate Ingestion Schedule */
  public static void validateIngestionSchedule(Schedule ingestion) {
    if (ingestion == null) {
      return;
    }
    String duration = ingestion.getRepeatFrequency();

    // ISO8601 duration format is P{y}Y{m}M{d}DT{h}H{m}M{s}S.
    String[] splits = duration.split("T");
    if (splits[0].contains("Y") || splits[0].contains("M") || (splits.length == 2 && splits[1].contains("S"))) {
      throw new IllegalArgumentException(
          "Ingestion repeatFrequency can only contain Days, Hours, and Minutes - " + "example P{d}DT{h}H{m}M");
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

  /** Validate that JSON payload can be turned into POJO object */
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

  public static void validateUser(UserDAO userDAO, UUID userId) {
    if (!userDAO.exists(userId)) {
      throw EntityNotFoundException.byMessage(CatalogExceptionMessage.entityNotFound(Entity.USER, userId));
    }
  }

  // Get owner for a given entity
  public static EntityReference populateOwner(
      UUID id, EntityRelationshipDAO entityRelationshipDAO, UserDAO userDAO, TeamDAO teamDAO) throws IOException {
    List<EntityReference> ids = entityRelationshipDAO.findFrom(id.toString(), Relationship.OWNS.ordinal());
    if (ids.size() > 1) {
      LOG.warn("Possible database issues - multiple owners {} found for entity {}", ids, id);
    }
    return ids.isEmpty() ? null : populateOwner(userDAO, teamDAO, ids.get(0));
  }

  public static EntityReference populateOwner(UserDAO userDAO, TeamDAO teamDAO, EntityReference owner)
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

  public static void setOwner(
      EntityRelationshipDAO dao, UUID ownedEntityId, String ownedEntityType, EntityReference owner) {
    // Add relationship owner --- owns ---> ownedEntity
    if (owner != null) {
      LOG.info("Adding owner {}:{} for entity {}:{}", owner.getType(), owner.getId(), ownedEntityType, ownedEntityId);
      dao.insert(
          owner.getId().toString(),
          ownedEntityId.toString(),
          owner.getType(),
          ownedEntityType,
          Relationship.OWNS.ordinal());
    }
  }

  /** Unassign owner relationship for a given entity */
  public static void unassignOwner(EntityRelationshipDAO dao, EntityReference owner, String ownedEntityId) {
    if (owner != null && owner.getId() != null) {
      LOG.info("Removing owner {}:{} for entity {}", owner.getType(), owner.getId(), ownedEntityId);
      dao.delete(owner.getId().toString(), ownedEntityId, Relationship.OWNS.ordinal());
    }
  }

  public static void updateOwner(
      EntityRelationshipDAO dao,
      EntityReference originalOwner,
      EntityReference newOwner,
      UUID ownedEntityId,
      String ownedEntityType) {
    // TODO inefficient use replace instead of delete and add?
    // TODO check for orig and new owners being the same
    unassignOwner(dao, originalOwner, ownedEntityId.toString());
    setOwner(dao, ownedEntityId, ownedEntityType, newOwner);
  }

  public static List<EntityReference> populateEntityReferences(List<EntityReference> list) throws IOException {
    for (EntityReference ref : list) {
      populateEntityReference(ref);
    }
    return list;
  }

  public static EntityReference populateEntityReference(EntityReference ref) throws IOException {
    // Note href to entity reference is not added here
    EntityReference ref2 = Entity.getEntityReference(ref.getType(), ref.getId());
    return ref.withDescription(ref2.getDescription()).withName(ref2.getName());
  }

  public static EntityReference validateEntityLink(EntityLink entityLink) throws IOException {
    String entityType = entityLink.getEntityType();
    String fqn = entityLink.getEntityId();
    return Entity.getEntityReferenceByName(entityType, fqn);
  }

  public static UsageDetails getLatestUsage(UsageDAO usageDAO, UUID entityId) {
    LOG.debug("Getting latest usage for {}", entityId);
    UsageDetails details = usageDAO.getLatestUsage(entityId.toString());
    if (details == null) {
      LOG.debug("Usage details not found. Sending default usage");
      UsageStats stats = new UsageStats().withCount(0).withPercentileRank(0.0);
      details =
          new UsageDetails()
              .withDailyStats(stats)
              .withWeeklyStats(stats)
              .withMonthlyStats(stats)
              .withDate(RestUtil.DATE_FORMAT.format(new Date()));
    }
    return details;
  }

  /** Apply tags {@code tagLabels} to the entity or field identified by {@code targetFQN} */
  public static void applyTags(TagDAO tagDAO, List<TagLabel> tagLabels, String targetFQN) {
    for (TagLabel tagLabel : Optional.ofNullable(tagLabels).orElse(Collections.emptyList())) {
      String json = tagDAO.findTag(tagLabel.getTagFQN());
      if (json == null) {
        // Invalid TagLabel
        throw EntityNotFoundException.byMessage(
            CatalogExceptionMessage.entityNotFound(Tag.class.getSimpleName(), tagLabel.getTagFQN()));
      }

      // Apply tagLabel to targetFQN that identifies an entity or field
      tagDAO.applyTag(
          tagLabel.getTagFQN(), targetFQN, tagLabel.getLabelType().ordinal(), tagLabel.getState().ordinal());
    }
  }

  public static List<TagLabel> getDerivedTags(TagDAO tagDAO, TagLabel tagLabel, Tag tag) throws IOException {
    List<TagLabel> derivedTags = new ArrayList<>();
    for (String fqn : Optional.ofNullable(tag.getAssociatedTags()).orElse(Collections.emptyList())) {
      String json = tagDAO.findTag(fqn);
      if (json == null) {
        // Invalid TagLabel
        throw EntityNotFoundException.byMessage(CatalogExceptionMessage.entityNotFound(Tag.class.getSimpleName(), fqn));
      }
      Tag tempTag = JsonUtils.readValue(json, Tag.class);
      derivedTags.add(
          new TagLabel()
              .withTagFQN(fqn)
              .withState(tagLabel.getState())
              .withDescription(tempTag.getDescription())
              .withLabelType(LabelType.DERIVED));
    }
    return derivedTags;
  }

  /** Validate given list of tags and add derived tags to it */
  public static List<TagLabel> addDerivedTags(TagDAO tagDAO, List<TagLabel> tagLabels) throws IOException {
    List<TagLabel> updatedTagLabels = new ArrayList<>();
    for (TagLabel tagLabel : Optional.ofNullable(tagLabels).orElse(Collections.emptyList())) {
      String json = tagDAO.findTag(tagLabel.getTagFQN());
      if (json == null) {
        // Invalid TagLabel
        throw EntityNotFoundException.byMessage(
            CatalogExceptionMessage.entityNotFound(Tag.class.getSimpleName(), tagLabel.getTagFQN()));
      }
      Tag tag = JsonUtils.readValue(json, Tag.class);
      updatedTagLabels.add(tagLabel);

      // Apply derived tags
      List<TagLabel> derivedTags = getDerivedTags(tagDAO, tagLabel, tag);
      updatedTagLabels = mergeTags(updatedTagLabels, derivedTags);
    }
    updatedTagLabels.sort(compareTagLabel);
    return updatedTagLabels;
  }

  public static void removeTags(TagDAO tagDAO, String fullyQualifiedName) {
    tagDAO.deleteTags(fullyQualifiedName);
  }

  public static void removeTagsByPrefix(TagDAO tagDAO, String fullyQualifiedName) {
    tagDAO.deleteTagsByPrefix(fullyQualifiedName);
  }

  public static List<TagLabel> mergeTags(List<TagLabel> list1, List<TagLabel> list2) {
    List<TagLabel> mergedTags =
        Stream.concat(
                Optional.ofNullable(list1).orElse(Collections.emptyList()).stream(),
                Optional.ofNullable(list2).orElse(Collections.emptyList()).stream())
            .distinct()
            .collect(Collectors.toList());
    return mergedTags.isEmpty() ? null : mergedTags;
  }

  public static boolean addFollower(
      EntityRelationshipDAO dao,
      UserDAO userDAO,
      UUID followedEntityId,
      String followedEntityType,
      UUID followerId,
      String followerEntity)
      throws IOException {
    User user = userDAO.findEntityById(followerId);
    if (Optional.ofNullable(user.getDeactivated()).orElse(false)) {
      throw new IllegalArgumentException(CatalogExceptionMessage.deactivatedUser(followerId));
    }
    return dao.insert(
            followerId.toString(),
            followedEntityId.toString(),
            followerEntity,
            followedEntityType,
            Relationship.FOLLOWS.ordinal())
        > 0;
  }

  public static void removeFollower(EntityRelationshipDAO dao, UUID followedEntityId, UUID followerId) {
    dao.delete(followerId.toString(), followedEntityId.toString(), Relationship.FOLLOWS.ordinal());
  }

  public static List<EntityReference> getFollowers(
      UUID followedEntityId, EntityRelationshipDAO entityRelationshipDAO, UserDAO userDAO) throws IOException {
    List<String> followerIds =
        entityRelationshipDAO.findFrom(followedEntityId.toString(), Relationship.FOLLOWS.ordinal(), Entity.USER);
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
    return refList.stream().sorted(compareEntityReference).map(EntityReference::getId).collect(Collectors.toList());
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
    for (int i = 3; i < s.length - 1; i++) {
      localColumnName.append(s[i]).append(".");
    }
    localColumnName.append(s[s.length - 1]);
    return localColumnName.toString();
  }
}
