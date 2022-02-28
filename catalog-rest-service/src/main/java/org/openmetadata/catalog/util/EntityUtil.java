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

import static org.openmetadata.catalog.type.Include.ALL;
import static org.openmetadata.catalog.type.Include.DELETED;

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
import javax.ws.rs.WebApplicationException;
import lombok.NonNull;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.joda.time.Period;
import org.joda.time.format.ISOPeriodFormat;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.data.GlossaryTerm;
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
import org.openmetadata.catalog.resources.feeds.MessageParser.EntityLink;
import org.openmetadata.catalog.type.ChangeEvent;
import org.openmetadata.catalog.type.Column;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.EventFilter;
import org.openmetadata.catalog.type.EventType;
import org.openmetadata.catalog.type.FailureDetails;
import org.openmetadata.catalog.type.FieldChange;
import org.openmetadata.catalog.type.Include;
import org.openmetadata.catalog.type.MlFeature;
import org.openmetadata.catalog.type.MlHyperParameter;
import org.openmetadata.catalog.type.Relationship;
import org.openmetadata.catalog.type.Schedule;
import org.openmetadata.catalog.type.TableConstraint;
import org.openmetadata.catalog.type.Tag;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.type.TagLabel.LabelType;
import org.openmetadata.catalog.type.Task;
import org.openmetadata.catalog.type.UsageDetails;
import org.openmetadata.catalog.type.UsageStats;

@Slf4j
public final class EntityUtil {

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
  public static final Comparator<ChangeEvent> compareChangeEvent = Comparator.comparing(ChangeEvent::getTimestamp);

  //
  // Matchers used for matching two items in a list
  //
  public static final BiPredicate<Object, Object> objectMatch = Object::equals;

  public static final BiPredicate<EntityReference, EntityReference> entityReferenceMatch =
      (ref1, ref2) -> ref1.getId().equals(ref2.getId()) && ref1.getType().equals(ref2.getType());

  public static final BiPredicate<TagLabel, TagLabel> tagLabelMatch =
      (tag1, tag2) -> tag1.getTagFQN().equals(tag2.getTagFQN());

  public static final BiPredicate<Task, Task> taskMatch = (task1, task2) -> task1.getName().equals(task2.getName());

  public static final BiPredicate<String, String> stringMatch = String::equals;

  public static final BiPredicate<Column, Column> columnMatch =
      (column1, column2) ->
          column1.getName().equals(column2.getName())
              && column1.getDataType() == column2.getDataType()
              && column1.getArrayDataType() == column2.getArrayDataType();

  public static final BiPredicate<Column, Column> columnNameMatch =
      (column1, column2) -> column1.getName().equals(column2.getName());

  public static final BiPredicate<TableConstraint, TableConstraint> tableConstraintMatch =
      (constraint1, constraint2) ->
          constraint1.getConstraintType() == constraint2.getConstraintType()
              && constraint1.getColumns().equals(constraint2.getColumns());

  public static final BiPredicate<MlFeature, MlFeature> mlFeatureMatch = MlFeature::equals;
  public static final BiPredicate<MlHyperParameter, MlHyperParameter> mlHyperParameterMatch = MlHyperParameter::equals;
  public static final BiPredicate<FailureDetails, FailureDetails> failureDetailsMatch =
      (failureDetails1, failureDetails2) ->
          Objects.equals(failureDetails2.getLastFailedAt(), failureDetails1.getLastFailedAt())
              && Objects.equals(failureDetails2.getLastSuccessfulAt(), failureDetails1.getLastSuccessfulAt());

  public static final BiPredicate<EventFilter, EventFilter> eventFilterMatch =
      (filter1, filter2) ->
          filter1.getEventType().equals(filter2.getEventType()) && filter1.getEntities().equals(filter2.getEntities());

  public static final BiPredicate<GlossaryTerm, GlossaryTerm> glossaryTermMatch =
      (filter1, filter2) -> filter1.getFullyQualifiedName().equals(filter2.getFullyQualifiedName());

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

  public static void validateUser(UserDAO userDAO, UUID userId) {
    if (!userDAO.exists(userId)) {
      throw EntityNotFoundException.byMessage(CatalogExceptionMessage.entityNotFound(Entity.USER, userId));
    }
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
      if (Optional.ofNullable(ownerInstance.getDeleted()).orElse(false)) {
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
      dao.insert(owner.getId(), ownedEntityId, owner.getType(), ownedEntityType, Relationship.OWNS.ordinal());
    }
  }

  /** Unassign owner relationship for a given entity */
  public static void unassignOwner(
      EntityRelationshipDAO dao, EntityReference owner, String ownedEntityId, String ownedEntityType) {
    if (owner != null && owner.getId() != null) {
      LOG.info("Removing owner {}:{} for entity {}", owner.getType(), owner.getId(), ownedEntityId);
      dao.delete(
          owner.getId().toString(), owner.getType(), ownedEntityId, ownedEntityType, Relationship.OWNS.ordinal());
    }
  }

  public static void updateOwner(
      EntityRelationshipDAO dao,
      EntityReference originalOwner,
      EntityReference newOwner,
      UUID ownedEntityId,
      String ownedEntityType) {
    // TODO inefficient use replace instead of delete and add and check for orig and new owners being the same
    unassignOwner(dao, originalOwner, ownedEntityId.toString(), ownedEntityType);
    setOwner(dao, ownedEntityId, ownedEntityType, newOwner);
  }

  public static List<EntityReference> populateEntityReferences(List<EntityReference> list) throws IOException {
    if (list != null) {
      for (EntityReference ref : list) {
        populateEntityReference(ref);
      }
    }
    return list;
  }

  public static List<EntityReference> populateEntityReferences(@NonNull List<String> ids, @NonNull String entityType)
      throws IOException {
    List<EntityReference> refs = new ArrayList<>(ids.size());
    for (String id : ids) {
      refs.add(Entity.getEntityReferenceById(entityType, UUID.fromString(id)));
    }
    return refs;
  }

  public static EntityReference populateEntityReference(EntityReference ref) throws IOException {
    // Note href to entity reference is not added here
    EntityReference ref2 = Entity.getEntityReferenceById(ref.getType(), ref.getId());
    return ref.withDescription(ref2.getDescription()).withName(ref2.getName());
  }

  public static EntityReference validateEntityLink(EntityLink entityLink) throws IOException {
    String entityType = entityLink.getEntityType();
    String fqn = entityLink.getEntityFQN();

    // TODO: add more validation for field name and array fields

    return Entity.getEntityReferenceByName(entityType, fqn, ALL);
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
    if (tagLabels == null || tagLabels.isEmpty()) {
      return tagLabels;
    }

    List<TagLabel> updatedTagLabels = new ArrayList<>(tagLabels);
    for (TagLabel tagLabel : tagLabels) {
      String json = tagDAO.findTag(tagLabel.getTagFQN());
      if (json == null) {
        // Invalid TagLabel
        throw EntityNotFoundException.byMessage(
            CatalogExceptionMessage.entityNotFound(Tag.class.getSimpleName(), tagLabel.getTagFQN()));
      }
      Tag tag = JsonUtils.readValue(json, Tag.class);

      // Apply derived tags
      List<TagLabel> derivedTags = getDerivedTags(tagDAO, tagLabel, tag);
      mergeTags(updatedTagLabels, derivedTags);
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

  /** Merge derivedTags into tags, if it already does not exist in tags */
  public static void mergeTags(List<TagLabel> tags, List<TagLabel> derivedTags) {
    if (derivedTags == null || derivedTags.isEmpty()) {
      return;
    }
    for (TagLabel derivedTag : derivedTags) {
      TagLabel tag = tags.stream().filter(t -> tagLabelMatch.test(t, derivedTag)).findAny().orElse(null);
      if (tag == null) { // Derived tag does not exist in the list. Add it.
        tags.add(derivedTag);
      }
    }
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
    if (Optional.ofNullable(user.getDeleted()).orElse(false)) {
      throw new IllegalArgumentException(CatalogExceptionMessage.deactivatedUser(followerId));
    }
    return dao.insert(followerId, followedEntityId, followerEntity, followedEntityType, Relationship.FOLLOWS.ordinal())
        > 0;
  }

  public static List<EntityReference> getFollowers(
      EntityInterface<?> followedEntityInterface,
      String name,
      EntityRelationshipDAO entityRelationshipDAO,
      UserDAO userDAO)
      throws IOException {
    List<String> followerIds =
        entityRelationshipDAO.findFrom(
            followedEntityInterface.getId().toString(),
            name,
            Relationship.FOLLOWS.ordinal(),
            Entity.USER,
            toBoolean(ALL));
    List<EntityReference> followers = new ArrayList<>();
    for (String followerId : followerIds) {
      User user = userDAO.findEntityById(UUID.fromString(followerId), ALL);
      if (followedEntityInterface.isDeleted() || !user.getDeleted()) {
        followers.add(new EntityReference().withName(user.getName()).withId(user.getId()).withType("user"));
      }
    }
    return followers;
  }

  @RequiredArgsConstructor
  public static class Fields {
    public static final Fields EMPTY_FIELDS = new Fields(null, null);
    private final List<String> fieldList;

    public Fields(List<String> allowedFields, String fieldsParam) {
      if (fieldsParam == null || fieldsParam.isEmpty()) {
        fieldList = Collections.emptyList();
        return;
      }
      fieldList = Arrays.asList(fieldsParam.replace(" ", "").split(","));
      for (String field : fieldList) {
        if (!allowedFields.contains(field)) {

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

  /** Entity version extension name formed by entityType.version.versionNumber. Example - `table.version.0.1` */
  public static String getVersionExtension(String entityType, Double version) {
    return String.format("%s.%s", getVersionExtensionPrefix(entityType), version.toString());
  }

  /** Entity version extension name prefix formed by `entityType.version`. Example - `table.version` */
  public static String getVersionExtensionPrefix(String entityType) {
    return String.format("%s.%s", entityType, "version");
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

  /** Return column field name of format columnName.fieldName */
  public static String getColumnField(Column column, String columnField) {
    // Remove table FQN from column FQN to get the local name
    String localColumnName = EntityUtil.getLocalColumnName(column.getFullyQualifiedName());
    return "columns." + localColumnName + (columnField == null ? "" : "." + columnField);
  }

  public static Boolean toBoolean(Include include) {
    if (include.equals(DELETED)) {
      return Boolean.TRUE;
    } else if (include.equals(ALL)) {
      return null;
    } else { // "non-deleted"
      return Boolean.FALSE;
    }
  }

  public static Double nextVersion(Double version) {
    return Math.round((version + 0.1) * 10.0) / 10.0;
  }

  public static Double nextMajorVersion(Double version) {
    return Math.round((version + 1.0) * 10.0) / 10.0;
  }

  public static void addSoftDeleteFilter(List<EventFilter> filters) {
    // Add filter for soft delete events if delete event type is requested
    Optional<EventFilter> deleteFilter =
        filters.stream().filter(eventFilter -> eventFilter.getEventType().equals(EventType.ENTITY_DELETED)).findAny();
    deleteFilter.ifPresent(
        eventFilter ->
            filters.add(
                new EventFilter()
                    .withEventType(EventType.ENTITY_SOFT_DELETED)
                    .withEntities(eventFilter.getEntities())));
  }

  public static void escapeReservedChars(EntityInterface<?> entityInterface) {
    entityInterface.setDisplayName(
        entityInterface.getDisplayName() != null ? entityInterface.getDisplayName() : entityInterface.getName());
    entityInterface.setName(replaceDot(entityInterface.getName()));
  }

  public static void escapeReservedChars(List<?> collection) {
    if (collection == null || collection.isEmpty()) {
      return;
    }
    for (Object object : collection) {
      if (object instanceof Column) {
        Column column = (Column) object;
        column.setDisplayName(column.getDisplayName() != null ? column.getDisplayName() : column.getName());
        column.setName(replaceDot(column.getName()));
        escapeReservedChars(column.getChildren());
      } else if (object instanceof TableConstraint) {
        TableConstraint constraint = (TableConstraint) object;
        constraint.setColumns(constraint.getColumns().stream().map(s -> replaceDot(s)).collect(Collectors.toList()));
      } else if (object instanceof Task) {
        Task task = (Task) object;
        task.setDisplayName(task.getDisplayName() != null ? task.getDisplayName() : task.getName());
        task.setName(replaceDot(task.getName()));
      }
    }
  }

  public static String replaceDot(String string) {
    return string.replace(".", "_DOT_");
  }
}
