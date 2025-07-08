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
import static org.openmetadata.service.Entity.API_COLLCECTION;
import static org.openmetadata.service.Entity.FIELD_DESCRIPTION;
import static org.openmetadata.service.Entity.FIELD_DISPLAY_NAME;
import static org.openmetadata.service.Entity.FIELD_TAGS;
import static org.openmetadata.service.Entity.populateEntityFieldTags;
import static org.openmetadata.service.resources.tags.TagLabelUtil.addDerivedTags;
import static org.openmetadata.service.resources.tags.TagLabelUtil.checkMutuallyExclusive;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.BiPredicate;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.feed.ResolveTask;
import org.openmetadata.schema.entity.data.APICollection;
import org.openmetadata.schema.entity.data.APIEndpoint;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TaskType;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.jdbi3.FeedRepository.TaskWorkflow;
import org.openmetadata.service.jdbi3.FeedRepository.ThreadContext;
import org.openmetadata.service.resources.apis.APIEndpointResource;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FullyQualifiedName;

public class APIEndpointRepository extends EntityRepository<APIEndpoint> {

  public APIEndpointRepository() {
    super(
        APIEndpointResource.COLLECTION_PATH,
        Entity.API_ENDPOINT,
        APIEndpoint.class,
        Entity.getCollectionDAO().apiEndpointDAO(),
        "",
        "");
    supportsSearch = true;
  }

  @Override
  public void setFullyQualifiedName(APIEndpoint apiEndpoint) {
    apiEndpoint.setFullyQualifiedName(
        FullyQualifiedName.add(
            apiEndpoint.getApiCollection().getFullyQualifiedName(), apiEndpoint.getName()));
    if (apiEndpoint.getRequestSchema() != null) {
      setFieldFQN(
          apiEndpoint.getFullyQualifiedName() + ".requestSchema",
          apiEndpoint.getRequestSchema().getSchemaFields());
    }
    if (apiEndpoint.getResponseSchema() != null) {
      setFieldFQN(
          apiEndpoint.getFullyQualifiedName() + ".responseSchema",
          apiEndpoint.getResponseSchema().getSchemaFields());
    }
  }

  @Override
  public void setInheritedFields(APIEndpoint endpoint, Fields fields) {
    APICollection apiCollection =
        Entity.getEntity(
            API_COLLCECTION, endpoint.getApiCollection().getId(), "owners,domain", ALL);
    inheritOwners(endpoint, fields, apiCollection);
    inheritDomains(endpoint, fields, apiCollection);
  }

  @Override
  public void prepare(APIEndpoint apiEndpoint, boolean update) {
    populateAPICollection(apiEndpoint);
  }

  @Override
  public void storeEntity(APIEndpoint apiEndpoint, boolean update) {
    // Relationships and fields such as service are derived and not stored as part of json
    EntityReference apiCollection = apiEndpoint.getApiCollection();
    apiEndpoint.withApiCollection(null);

    // Don't store fields tags as JSON but build it on the fly based on relationships
    List<Field> requestFieldsWithTags = null;
    if (apiEndpoint.getRequestSchema() != null) {
      requestFieldsWithTags = apiEndpoint.getRequestSchema().getSchemaFields();
      apiEndpoint.getRequestSchema().setSchemaFields(cloneWithoutTags(requestFieldsWithTags));
      apiEndpoint.getRequestSchema().getSchemaFields().forEach(field -> field.setTags(null));
    }

    List<Field> responseFieldsWithTags = null;
    if (apiEndpoint.getResponseSchema() != null) {
      responseFieldsWithTags = apiEndpoint.getResponseSchema().getSchemaFields();
      apiEndpoint.getResponseSchema().setSchemaFields(cloneWithoutTags(responseFieldsWithTags));
      apiEndpoint.getResponseSchema().getSchemaFields().forEach(field -> field.setTags(null));
    }

    store(apiEndpoint, update);

    // Restore the relationships
    if (requestFieldsWithTags != null) {
      apiEndpoint.getRequestSchema().withSchemaFields(requestFieldsWithTags);
    }
    if (responseFieldsWithTags != null) {
      apiEndpoint.getResponseSchema().withSchemaFields(responseFieldsWithTags);
    }
    apiEndpoint.withApiCollection(apiCollection);
  }

  @Override
  public void storeRelationships(APIEndpoint apiEndpoint) {
    EntityReference apiCollection = apiEndpoint.getApiCollection();
    addRelationship(
        apiCollection.getId(),
        apiEndpoint.getId(),
        apiCollection.getType(),
        Entity.API_ENDPOINT,
        Relationship.CONTAINS);
  }

  @Override
  public void setFields(APIEndpoint apiEndpoint, Fields fields) {
    setDefaultFields(apiEndpoint);
    if (apiEndpoint.getRequestSchema() != null) {
      populateEntityFieldTags(
          entityType,
          apiEndpoint.getRequestSchema().getSchemaFields(),
          apiEndpoint.getFullyQualifiedName() + ".requestSchema",
          fields.contains(FIELD_TAGS));
    }
    if (apiEndpoint.getResponseSchema() != null) {
      populateEntityFieldTags(
          entityType,
          apiEndpoint.getResponseSchema().getSchemaFields(),
          apiEndpoint.getFullyQualifiedName() + ".responseSchema",
          fields.contains(FIELD_TAGS));
    }
  }

  @Override
  public void clearFields(APIEndpoint apiEndpoint, Fields fields) {
    /* Nothing to do */
  }

  @Override
  public EntityRepository<APIEndpoint>.EntityUpdater getUpdater(
      APIEndpoint original, APIEndpoint updated, Operation operation, ChangeSource changeSource) {
    return new APIEndpointUpdater(original, updated, operation);
  }

  private void setDefaultFields(APIEndpoint apiEndpoint) {
    EntityReference apiCollectionRef = getContainer(apiEndpoint.getId());
    APICollection apiCollection = Entity.getEntity(apiCollectionRef, "", Include.ALL);
    apiEndpoint.withApiCollection(apiCollectionRef).withService(apiCollection.getService());
  }

  private void populateAPICollection(APIEndpoint apiEndpoint) {
    APICollection apiCollection = Entity.getEntity(apiEndpoint.getApiCollection(), "", ALL);
    apiEndpoint.setApiCollection(apiCollection.getEntityReference());
    apiEndpoint.setService(apiCollection.getService());
    apiEndpoint.setServiceType(apiCollection.getServiceType());
  }

  private void setFieldFQN(String parentFQN, List<Field> fields) {
    fields.forEach(
        c -> {
          String fieldFqn = FullyQualifiedName.add(parentFQN, c.getName());
          c.setFullyQualifiedName(fieldFqn);
          if (c.getChildren() != null) {
            setFieldFQN(fieldFqn, c.getChildren());
          }
        });
  }

  List<Field> cloneWithoutTags(List<Field> fields) {
    if (nullOrEmpty(fields)) {
      return fields;
    }
    List<Field> copy = new ArrayList<>();
    fields.forEach(f -> copy.add(cloneWithoutTags(f)));
    return copy;
  }

  private Field cloneWithoutTags(Field field) {
    List<Field> children = cloneWithoutTags(field.getChildren());
    return new Field()
        .withDescription(field.getDescription())
        .withName(field.getName())
        .withDisplayName(field.getDisplayName())
        .withFullyQualifiedName(field.getFullyQualifiedName())
        .withDataType(field.getDataType())
        .withDataTypeDisplay(field.getDataTypeDisplay())
        .withChildren(children);
  }

  private void validateSchemaFieldTags(List<Field> fields) {
    // Add field level tags by adding tag to field relationship
    for (Field field : fields) {
      validateTags(field.getTags());
      field.setTags(addDerivedTags(field.getTags()));
      checkMutuallyExclusive(field.getTags());
      if (field.getChildren() != null) {
        validateSchemaFieldTags(field.getChildren());
      }
    }
  }

  private void applyTags(List<Field> fields) {
    // Add field level tags by adding tag to field relationship
    for (Field field : fields) {
      applyTags(field.getTags(), field.getFullyQualifiedName());
      if (field.getChildren() != null) {
        applyTags(field.getChildren());
      }
    }
  }

  @Override
  public void applyTags(APIEndpoint apiEndpoint) {
    // Add table level tags by adding tag to table relationship
    super.applyTags(apiEndpoint);
    if (apiEndpoint.getRequestSchema() != null) {
      applyTags(apiEndpoint.getRequestSchema().getSchemaFields());
    }
    if (apiEndpoint.getResponseSchema() != null) {
      applyTags(apiEndpoint.getResponseSchema().getSchemaFields());
    }
  }

  @Override
  public EntityInterface getParentEntity(APIEndpoint entity, String fields) {
    return Entity.getEntity(entity.getApiCollection(), fields, Include.ALL);
  }

  @Override
  public void validateTags(APIEndpoint entity) {
    super.validateTags(entity);
    if (entity.getRequestSchema() != null) {
      validateSchemaFieldTags(entity.getRequestSchema().getSchemaFields());
    }
    if (entity.getResponseSchema() != null) {
      validateSchemaFieldTags(entity.getResponseSchema().getSchemaFields());
    }
  }

  @Override
  public List<TagLabel> getAllTags(EntityInterface entity) {
    List<TagLabel> allTags = new ArrayList<>();
    APIEndpoint apiEndpoint = (APIEndpoint) entity;
    EntityUtil.mergeTags(allTags, apiEndpoint.getTags());
    List<Field> requestSchemaFields =
        apiEndpoint.getRequestSchema() != null
            ? apiEndpoint.getRequestSchema().getSchemaFields()
            : null;
    List<Field> responseSchemaFields =
        apiEndpoint.getResponseSchema() != null
            ? apiEndpoint.getResponseSchema().getSchemaFields()
            : null;
    for (Field schemaField : listOrEmpty(responseSchemaFields)) {
      EntityUtil.mergeTags(allTags, schemaField.getTags());
    }
    for (Field schemaField : listOrEmpty(requestSchemaFields)) {
      EntityUtil.mergeTags(allTags, schemaField.getTags());
    }
    return allTags;
  }

  @Override
  public TaskWorkflow getTaskWorkflow(ThreadContext threadContext) {
    validateTaskThread(threadContext);
    EntityLink entityLink = threadContext.getAbout();
    if (entityLink.getFieldName().equals("responseSchema")) {
      TaskType taskType = threadContext.getThread().getTask().getType();
      if (EntityUtil.isDescriptionTask(taskType)) {
        return new ResponseSchemaDescriptionWorkflow(threadContext);
      } else if (EntityUtil.isTagTask(taskType)) {
        return new ResponseSchemaTagWorkflow(threadContext);
      } else {
        throw new IllegalArgumentException(String.format("Invalid task type %s", taskType));
      }
    }
    return super.getTaskWorkflow(threadContext);
  }

  static class ResponseSchemaDescriptionWorkflow extends DescriptionTaskWorkflow {
    private final Field schemaField;

    ResponseSchemaDescriptionWorkflow(ThreadContext threadContext) {
      super(threadContext);
      schemaField =
          getResponseSchemaField(
              (APIEndpoint) threadContext.getAboutEntity(),
              threadContext.getAbout().getArrayFieldName());
    }

    @Override
    public EntityInterface performTask(String user, ResolveTask resolveTask) {
      schemaField.setDescription(resolveTask.getNewValue());
      return threadContext.getAboutEntity();
    }
  }

  static class ResponseSchemaTagWorkflow extends TagTaskWorkflow {
    private final Field schemaField;

    ResponseSchemaTagWorkflow(ThreadContext threadContext) {
      super(threadContext);
      schemaField =
          getResponseSchemaField(
              (APIEndpoint) threadContext.getAboutEntity(),
              threadContext.getAbout().getArrayFieldName());
    }

    @Override
    public EntityInterface performTask(String user, ResolveTask resolveTask) {
      List<TagLabel> tags = JsonUtils.readObjects(resolveTask.getNewValue(), TagLabel.class);
      schemaField.setTags(tags);
      return threadContext.getAboutEntity();
    }
  }

  private static Field getResponseSchemaField(APIEndpoint apiEndpoint, String schemaName) {
    String childrenSchemaName = "";
    if (schemaName.contains(".")) {
      String fieldNameWithoutQuotes = schemaName.substring(1, schemaName.length() - 1);
      schemaName = fieldNameWithoutQuotes.substring(0, fieldNameWithoutQuotes.indexOf("."));
      childrenSchemaName =
          fieldNameWithoutQuotes.substring(fieldNameWithoutQuotes.lastIndexOf(".") + 1);
    }
    Field schemaField = null;
    for (Field field : apiEndpoint.getResponseSchema().getSchemaFields()) {
      if (field.getName().equals(schemaName)) {
        schemaField = field;
        break;
      }
    }
    if (childrenSchemaName.isEmpty() && schemaField != null) {
      schemaField = getChildSchemaField(schemaField.getChildren(), childrenSchemaName);
    }
    if (schemaField == null) {
      throw new IllegalArgumentException(
          CatalogExceptionMessage.invalidFieldName("responseSchema", schemaName));
    }
    return schemaField;
  }

  private static Field getChildSchemaField(List<Field> fields, String childrenSchemaName) {
    Field childrenSchemaField = null;
    for (Field field : fields) {
      if (field.getName().equals(childrenSchemaName)) {
        childrenSchemaField = field;
        break;
      }
    }
    if (childrenSchemaField == null) {
      for (Field field : fields) {
        if (field.getChildren() != null) {
          childrenSchemaField = getChildSchemaField(field.getChildren(), childrenSchemaName);
          if (childrenSchemaField != null) {
            break;
          }
        }
      }
    }
    return childrenSchemaField;
  }

  public class APIEndpointUpdater extends EntityUpdater {
    public static final String FIELD_DATA_TYPE_DISPLAY = "dataTypeDisplay";

    public APIEndpointUpdater(APIEndpoint original, APIEndpoint updated, Operation operation) {
      super(original, updated, operation);
    }

    @Transaction
    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      recordChange("endpointURL", original.getEndpointURL(), updated.getEndpointURL());
      recordChange("requestMethod", original.getRequestMethod(), updated.getRequestMethod());

      if (updated.getRequestSchema() != null
          && updated.getRequestSchema().getSchemaFields() != null) {
        updateSchemaFields(
            "requestSchema.schemaFields",
            original.getResponseSchema() == null
                ? new ArrayList<>()
                : listOrEmpty(
                    original.getRequestSchema() != null
                        ? original.getRequestSchema().getSchemaFields()
                        : null),
            listOrEmpty(updated.getRequestSchema().getSchemaFields()),
            EntityUtil.schemaFieldMatch);
      }

      if (updated.getResponseSchema() != null
          && updated.getResponseSchema().getSchemaFields() != null) {
        updateSchemaFields(
            "responseSchema.schemaFields",
            original.getResponseSchema() == null
                ? new ArrayList<>()
                : listOrEmpty(
                    original.getResponseSchema().getSchemaFields() != null
                        ? original.getResponseSchema().getSchemaFields()
                        : null),
            listOrEmpty(updated.getResponseSchema().getSchemaFields()),
            EntityUtil.schemaFieldMatch);
      }
      recordChange("sourceHash", original.getSourceHash(), updated.getSourceHash());
    }

    private void updateSchemaFields(
        String fieldName,
        List<Field> origFields,
        List<Field> updatedFields,
        BiPredicate<Field, Field> fieldMatch) {
      List<Field> deletedFields = new ArrayList<>();
      List<Field> addedFields = new ArrayList<>();
      recordListChange(
          fieldName, origFields, updatedFields, addedFields, deletedFields, fieldMatch);
      // carry forward tags and description if deletedFields matches added field
      Map<String, Field> addedFieldMap =
          addedFields.stream().collect(Collectors.toMap(Field::getName, Function.identity()));

      for (Field deleted : deletedFields) {
        if (addedFieldMap.containsKey(deleted.getName())) {
          Field addedField = addedFieldMap.get(deleted.getName());
          if (nullOrEmpty(addedField.getDescription()) && nullOrEmpty(deleted.getDescription())) {
            addedField.setDescription(deleted.getDescription());
          }
          if (nullOrEmpty(addedField.getTags()) && nullOrEmpty(deleted.getTags())) {
            addedField.setTags(deleted.getTags());
          }
        }
      }

      // Delete tags related to deleted fields
      deletedFields.forEach(
          deleted ->
              daoCollection.tagUsageDAO().deleteTagsByTarget(deleted.getFullyQualifiedName()));

      // Add tags related to newly added fields
      for (Field added : addedFields) {
        applyTags(added.getTags(), added.getFullyQualifiedName());
      }

      // Carry forward the user generated metadata from existing fields to new fields
      for (Field updated : updatedFields) {
        // Find stored field matching name, data type and ordinal position
        Field stored =
            origFields.stream().filter(c -> fieldMatch.test(c, updated)).findAny().orElse(null);
        if (stored == null) { // New field added
          continue;
        }

        updateFieldDescription(stored, updated);
        updateFieldDataTypeDisplay(stored, updated);
        updateFieldDisplayName(stored, updated);
        updateTags(
            stored.getFullyQualifiedName(),
            EntityUtil.getFieldName(fieldName, updated.getName(), FIELD_TAGS),
            stored.getTags(),
            updated.getTags());

        if (updated.getChildren() != null && stored.getChildren() != null) {
          String childrenFieldName = EntityUtil.getFieldName(fieldName, updated.getName());
          updateSchemaFields(
              childrenFieldName,
              listOrEmpty(stored.getChildren()),
              listOrEmpty(updated.getChildren()),
              fieldMatch);
        }
      }

      majorVersionChange = majorVersionChange || !deletedFields.isEmpty();
    }

    private void updateFieldDescription(Field origField, Field updatedField) {
      if (operation.isPut() && !nullOrEmpty(origField.getDescription()) && updatedByBot()) {
        // Revert the non-empty field description if being updated by a bot
        updatedField.setDescription(origField.getDescription());
        return;
      }
      String field = EntityUtil.getSchemaField(original, origField, FIELD_DESCRIPTION);
      recordChange(field, origField.getDescription(), updatedField.getDescription());
    }

    private void updateFieldDisplayName(Field origField, Field updatedField) {
      if (operation.isPut() && !nullOrEmpty(origField.getDescription()) && updatedByBot()) {
        // Revert the non-empty field description if being updated by a bot
        updatedField.setDisplayName(origField.getDisplayName());
        return;
      }
      String field = EntityUtil.getSchemaField(original, origField, FIELD_DISPLAY_NAME);
      recordChange(field, origField.getDisplayName(), updatedField.getDisplayName());
    }

    private void updateFieldDataTypeDisplay(Field origField, Field updatedField) {
      if (operation.isPut() && !nullOrEmpty(origField.getDataTypeDisplay()) && updatedByBot()) {
        // Revert the non-empty field dataTypeDisplay if being updated by a bot
        updatedField.setDataTypeDisplay(origField.getDataTypeDisplay());
        return;
      }
      String field = EntityUtil.getSchemaField(original, origField, FIELD_DATA_TYPE_DISPLAY);
      recordChange(field, origField.getDataTypeDisplay(), updatedField.getDataTypeDisplay());
    }
  }
}
