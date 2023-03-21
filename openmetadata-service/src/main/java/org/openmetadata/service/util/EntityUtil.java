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

package org.openmetadata.service.util;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.Include.ALL;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.Date;
import java.util.List;
import java.util.UUID;
import java.util.function.BiPredicate;
import java.util.regex.Pattern;
import javax.ws.rs.WebApplicationException;
import lombok.Getter;
import lombok.NonNull;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.data.TermReference;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.type.CustomProperty;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.MlFeature;
import org.openmetadata.schema.type.MlHyperParameter;
import org.openmetadata.schema.type.TableConstraint;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TagLabel.TagSource;
import org.openmetadata.schema.type.Task;
import org.openmetadata.schema.type.UsageDetails;
import org.openmetadata.schema.type.UsageStats;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO.EntityRelationshipRecord;
import org.openmetadata.service.jdbi3.CollectionDAO.EntityVersionPair;
import org.openmetadata.service.jdbi3.CollectionDAO.UsageDAO;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;
import org.openmetadata.service.security.policyevaluator.ResourceContext;

@Slf4j
public final class EntityUtil {

  //
  // Comparators used for sorting list based on the given type
  //

  // Note ordering is same as server side ordering by ID as string to ensure PATCH operations work
  public static final Comparator<EntityReference> compareEntityReference =
      Comparator.comparing(EntityReference::getName);
  public static final Comparator<EntityVersionPair> compareVersion =
      Comparator.comparing(EntityVersionPair::getVersion);
  public static final Comparator<TagLabel> compareTagLabel = Comparator.comparing(TagLabel::getTagFQN);
  public static final Comparator<FieldChange> compareFieldChange = Comparator.comparing(FieldChange::getName);
  public static final Comparator<TableConstraint> compareTableConstraint =
      Comparator.comparing(TableConstraint::getConstraintType);
  public static final Comparator<ChangeEvent> compareChangeEvent = Comparator.comparing(ChangeEvent::getTimestamp);
  public static final Comparator<GlossaryTerm> compareGlossaryTerm = Comparator.comparing(GlossaryTerm::getName);
  public static final Comparator<CustomProperty> compareCustomProperty = Comparator.comparing(CustomProperty::getName);

  //
  // Matchers used for matching two items in a list
  //
  public static final BiPredicate<Object, Object> objectMatch = Object::equals;

  public static final BiPredicate<EntityReference, EntityReference> entityReferenceMatch =
      (ref1, ref2) -> ref1.getId().equals(ref2.getId()) && ref1.getType().equals(ref2.getType());

  public static final BiPredicate<TagLabel, TagLabel> tagLabelMatch =
      (tag1, tag2) -> tag1.getTagFQN().equals(tag2.getTagFQN()) && tag1.getSource().equals(tag2.getSource());

  public static final BiPredicate<Task, Task> taskMatch = (task1, task2) -> task1.getName().equals(task2.getName());

  public static final BiPredicate<String, String> stringMatch = String::equals;

  public static final BiPredicate<Column, Column> columnMatch =
      (column1, column2) ->
          column1.getName().equalsIgnoreCase(column2.getName())
              && column1.getDataType() == column2.getDataType()
              && column1.getArrayDataType() == column2.getArrayDataType();

  public static final BiPredicate<Column, Column> columnNameMatch =
      (column1, column2) -> column1.getName().equalsIgnoreCase(column2.getName());

  public static final BiPredicate<TableConstraint, TableConstraint> tableConstraintMatch =
      (constraint1, constraint2) ->
          constraint1.getConstraintType() == constraint2.getConstraintType()
              && constraint1.getColumns().equals(constraint2.getColumns());

  public static final BiPredicate<MlFeature, MlFeature> mlFeatureMatch = MlFeature::equals;
  public static final BiPredicate<MlHyperParameter, MlHyperParameter> mlHyperParameterMatch = MlHyperParameter::equals;

  public static final BiPredicate<GlossaryTerm, GlossaryTerm> glossaryTermMatch =
      (filter1, filter2) -> filter1.getFullyQualifiedName().equals(filter2.getFullyQualifiedName());

  public static final BiPredicate<TermReference, TermReference> termReferenceMatch =
      (ref1, ref2) -> ref1.getName().equals(ref2.getName()) && ref1.getEndpoint().equals(ref2.getEndpoint());

  public static final BiPredicate<CustomProperty, CustomProperty> customFieldMatch =
      (ref1, ref2) ->
          ref1.getName().equals(ref2.getName())
              && entityReferenceMatch.test(ref1.getPropertyType(), ref2.getPropertyType());

  public static final BiPredicate<Rule, Rule> ruleMatch = (ref1, ref2) -> ref1.getName().equals(ref2.getName());

  public static final BiPredicate<Field, Field> schemaFieldMatch =
      (field1, field2) ->
          field1.getName().equalsIgnoreCase(field2.getName()) && field1.getDataType() == field2.getDataType();

  private EntityUtil() {}

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

  // TODO delete
  public static List<EntityReference> populateEntityReferences(List<EntityReference> list) throws IOException {
    if (list != null) {
      for (EntityReference ref : list) {
        EntityReference ref2 = Entity.getEntityReference(ref, ALL);
        EntityUtil.copy(ref2, ref);
      }
      list.sort(compareEntityReference);
    }
    return list;
  }

  // TODO delete
  public static List<EntityReference> getEntityReferences(List<EntityRelationshipRecord> list) throws IOException {
    if (list == null) {
      return Collections.emptyList();
    }
    List<EntityReference> refs = new ArrayList<>();
    for (EntityRelationshipRecord ref : list) {
      refs.add(Entity.getEntityReferenceById(ref.getType(), ref.getId(), ALL));
    }
    refs.sort(compareEntityReference);
    return refs;
  }

  public static List<EntityReference> populateEntityReferences(
      List<EntityRelationshipRecord> records, @NonNull String entityType) throws IOException {
    List<EntityReference> refs = new ArrayList<>(records.size());
    for (EntityRelationshipRecord id : records) {
      refs.add(Entity.getEntityReferenceById(entityType, id.getId(), ALL));
    }
    refs.sort(compareEntityReference);
    return refs;
  }

  public static List<EntityReference> populateEntityReferencesById(List<UUID> list, String entityType)
      throws IOException {
    List<EntityReference> refs = toEntityReferences(list, entityType);
    return populateEntityReferences(refs);
  }

  public static EntityReference validateEntityLink(EntityLink entityLink) {
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

  /** Merge two sets of tags */
  public static void mergeTags(List<TagLabel> mergeTo, List<TagLabel> mergeFrom) {
    if (nullOrEmpty(mergeFrom)) {
      return;
    }
    for (TagLabel fromTag : mergeFrom) {
      TagLabel tag = mergeTo.stream().filter(t -> tagLabelMatch.test(t, fromTag)).findAny().orElse(null);
      if (tag == null) { // The tag does not exist in the mergeTo list. Add it.
        mergeTo.add(fromTag);
      }
    }
  }

  public static List<String> getJsonDataResources(String path) throws IOException {
    return CommonUtil.getResources(Pattern.compile(path));
  }

  public static <T extends EntityInterface> List<String> toFQNs(List<T> entities) {
    if (entities == null) {
      return Collections.emptyList();
    }
    List<String> entityReferences = new ArrayList<>();
    for (T entity : entities) {
      entityReferences.add(entity.getFullyQualifiedName());
    }
    return entityReferences;
  }

  public static List<UUID> toIDs(List<String> list) {
    List<UUID> ids = new ArrayList<>(list.size());
    list.forEach(entry -> ids.add(UUID.fromString(entry)));
    return ids;
  }

  public static List<EntityReference> toEntityReferences(List<UUID> ids, String entityType) {
    if (ids == null) {
      return null;
    }
    List<EntityReference> entityReferences = new ArrayList<>();
    for (UUID id : ids) {
      entityReferences.add(new EntityReference().withId(id).withType(entityType));
    }
    return entityReferences;
  }

  public static List<UUID> toIds(List<EntityReference> refs) {
    if (refs == null) {
      return null;
    }
    List<UUID> ids = new ArrayList<>();
    for (EntityReference ref : refs) {
      ids.add(ref.getId());
    }
    return ids;
  }

  @RequiredArgsConstructor
  public static class Fields {
    public static final Fields EMPTY_FIELDS = new Fields(null, null);
    @Getter private final List<String> fieldList;

    public Fields(List<String> allowedFields, String fieldsParam) {
      if (nullOrEmpty(fieldsParam)) {
        fieldList = new ArrayList<>();
        return;
      }
      fieldList = Arrays.asList(fieldsParam.replace(" ", "").split(","));
      for (String field : fieldList) {
        if (!allowedFields.contains(field)) {
          throw new IllegalArgumentException(CatalogExceptionMessage.invalidField(field));
        }
      }
    }

    @Override
    public String toString() {
      return fieldList.toString();
    }

    public void add(Fields fields) {
      fieldList.addAll(fields.fieldList);
    }

    public boolean contains(String field) {
      return fieldList.contains(field);
    }
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

  public static String getLocalColumnName(String tableFqn, String columnFqn) {
    // Return for fqn=service:database:table:c1 -> c1
    // Return for fqn=service:database:table:c1:c2 -> c1:c2 (note different from just the local name of the column c2)
    return columnFqn.replace(tableFqn + Entity.SEPARATOR, "");
  }

  public static String getFieldName(String... strings) {
    return String.join(Entity.SEPARATOR, strings);
  }

  /** Return column field name of format "columns".columnName.columnFieldName */
  public static <T extends EntityInterface> String getColumnField(
      T entityWithColumns, Column column, String columnField) {
    // Remove table FQN from column FQN to get the local name
    String localColumnName =
        EntityUtil.getLocalColumnName(entityWithColumns.getFullyQualifiedName(), column.getFullyQualifiedName());
    return columnField == null
        ? FullyQualifiedName.build("columns", localColumnName)
        : FullyQualifiedName.build("columns", localColumnName, columnField);
  }

  /** Return schema field name of format "schemaFields".fieldName.fieldName */
  public static String getSchemaField(Topic topic, Field field, String fieldName) {
    // Remove topic FQN from schemaField FQN to get the local name
    String localFieldName = EntityUtil.getLocalColumnName(topic.getFullyQualifiedName(), field.getFullyQualifiedName());
    return fieldName == null
        ? FullyQualifiedName.build("schemaFields", localFieldName)
        : FullyQualifiedName.build("schemaFields", localFieldName, fieldName);
  }

  /** Return rule field name of format "rules".ruleName.ruleFieldName */
  public static String getRuleField(Rule rule, String ruleField) {
    return ruleField == null
        ? FullyQualifiedName.build("rules", rule.getName())
        : FullyQualifiedName.build("rules", rule.getName(), ruleField);
  }

  /** Return customer property field name of format "customProperties".propertyName */
  public static String getCustomField(CustomProperty property, String propertyFieldName) {
    return propertyFieldName == null
        ? FullyQualifiedName.build("customProperties", property.getName())
        : FullyQualifiedName.build("customProperties", property.getName(), propertyFieldName);
  }

  /** Return extension field name of format "extension".fieldName */
  public static String getExtensionField(String key) {
    return FullyQualifiedName.build("extension", key);
  }

  public static Double nextVersion(Double version) {
    return Math.round((version + 0.1) * 10.0) / 10.0;
  }

  public static Double nextMajorVersion(Double version) {
    return Math.round((version + 1.0) * 10.0) / 10.0;
  }

  public static EntityReference copy(EntityReference from, EntityReference to) {
    return to.withType(from.getType())
        .withId(from.getId())
        .withName(from.getName())
        .withDisplayName(from.getDisplayName())
        .withFullyQualifiedName(from.getFullyQualifiedName())
        .withDeleted(from.getDeleted());
  }

  public static List<TagLabel> toTagLabels(GlossaryTerm... terms) {
    List<TagLabel> list = new ArrayList<>();
    for (GlossaryTerm term : terms) {
      list.add(toTagLabel(term));
    }
    return list;
  }

  public static List<TagLabel> toTagLabels(Tag... tags) {
    List<TagLabel> list = new ArrayList<>();
    for (Tag tag : tags) {
      list.add(toTagLabel(tag));
    }
    return list;
  }

  public static TagLabel toTagLabel(GlossaryTerm term) {
    return new TagLabel()
        .withTagFQN(term.getFullyQualifiedName())
        .withDescription(term.getDescription())
        .withSource(TagSource.GLOSSARY);
  }

  public static TagLabel toTagLabel(Tag tag) {
    return new TagLabel()
        .withTagFQN(tag.getFullyQualifiedName())
        .withDescription(tag.getDescription())
        .withSource(TagSource.CLASSIFICATION);
  }

  public static String addField(String fields, String newField) {
    fields = fields == null ? "" : fields;
    return fields.isEmpty() ? newField : fields + ", " + newField;
  }

  public static void fieldAdded(ChangeDescription change, String fieldName, Object newValue) {
    change.getFieldsAdded().add(new FieldChange().withName(fieldName).withNewValue(newValue));
  }

  public static void fieldDeleted(ChangeDescription change, String fieldName, Object oldValue) {
    change.getFieldsDeleted().add(new FieldChange().withName(fieldName).withOldValue(oldValue));
  }

  public static void fieldUpdated(ChangeDescription change, String fieldName, Object oldValue, Object newValue) {
    FieldChange fieldChange = new FieldChange().withName(fieldName).withOldValue(oldValue).withNewValue(newValue);
    change.getFieldsUpdated().add(fieldChange);
  }

  public static MetadataOperation createOrUpdateOperation(ResourceContext resourceContext) throws IOException {
    return resourceContext.getEntity() == null ? MetadataOperation.CREATE : MetadataOperation.EDIT_ALL;
  }

  public static UUID getId(EntityReference ref) {
    return ref == null ? null : ref.getId();
  }

  public static String getFqn(EntityReference ref) {
    return ref == null ? null : ref.getFullyQualifiedName();
  }

  public static String getFqn(EntityInterface entity) {
    return entity == null ? null : entity.getFullyQualifiedName();
  }

  public static List<String> getFqns(List<EntityReference> refs) {
    if (nullOrEmpty(refs)) {
      return null;
    }
    List<String> fqns = new ArrayList<>();
    for (EntityReference ref : refs) {
      fqns.add(getFqn(ref));
    }
    return fqns;
  }

  public static EntityReference getEntityReference(EntityInterface entity) {
    return entity == null ? null : entity.getEntityReference();
  }

  public static EntityReference getEntityReference(String entityType, String fqn) {
    return fqn == null ? null : new EntityReference().withType(entityType).withFullyQualifiedName(fqn);
  }

  public static List<EntityReference> getEntityReferences(String entityType, List<String> fqns) {
    if (nullOrEmpty(fqns)) {
      return null;
    }
    List<EntityReference> references = new ArrayList<>();
    for (String fqn : fqns) {
      references.add(getEntityReference(entityType, fqn));
    }
    return references;
  }

  public static Column getColumn(Table table, String columnName) {
    return table.getColumns().stream().filter(c -> c.getName().equals(columnName)).findFirst().orElse(null);
  }

  public static void sortByTagHierarchy(List<Tag> tags) {
    // Note - before calling this method - fullyQualifiedName should set up for the tags
    // Sort tags by tag hierarchy. Tags with parents null come first, followed by tags with
    tags.sort(Comparator.comparing(Tag::getFullyQualifiedName));
  }
}
