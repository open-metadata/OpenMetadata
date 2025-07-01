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

import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.resources.data.DataContractResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;

@Repository
public class DataContractRepository extends EntityRepository<DataContract> {

  private static final String DATA_CONTRACT_UPDATE_FIELDS =
      "entity,owners,status,schema,qualityExpectations,contractUpdates,semantics";
  private static final String DATA_CONTRACT_PATCH_FIELDS =
      "entity,owners,status,schema,qualityExpectations,contractUpdates,semantics";

  public DataContractRepository() {
    super(
        DataContractResource.COLLECTION_PATH,
        Entity.DATA_CONTRACT,
        DataContract.class,
        Entity.getCollectionDAO().dataContractDAO(),
        DATA_CONTRACT_PATCH_FIELDS,
        DATA_CONTRACT_UPDATE_FIELDS);
  }

  @Override
  public void setFullyQualifiedName(DataContract dataContract) {
    String entityFQN = dataContract.getEntity().getFullyQualifiedName();
    String name = dataContract.getName();
    dataContract.setFullyQualifiedName(entityFQN + ".dataContract_" + name);
  }

  @Override
  public void setFields(DataContract dataContract, Fields fields) {}

  @Override
  public void clearFields(DataContract dataContract, Fields fields) {}

  @Override
  public void prepare(DataContract dataContract, boolean update) {
    EntityReference entityRef = dataContract.getEntity();

    if (!update) {
      validateEntityLink(entityRef);
    }
    validateSchemaFieldsAgainstEntity(dataContract, entityRef);
    if (dataContract.getOwners() != null) {
      dataContract.setOwners(EntityUtil.populateEntityReferences(dataContract.getOwners()));
    }
  }

  private void validateSchemaFieldsAgainstEntity(
      DataContract dataContract, EntityReference entityRef) {
    if (dataContract.getSchema() == null || dataContract.getSchema().isEmpty()) {
      return;
    }

    String entityType = entityRef.getType();

    switch (entityType) {
      case Entity.TABLE:
        validateFieldsAgainstTable(dataContract, entityRef);
        break;
      case Entity.TOPIC:
        validateFieldsAgainstTopic(dataContract, entityRef);
        break;
      default:
        break;
    }
  }

  private void validateFieldsAgainstTable(DataContract dataContract, EntityReference tableRef) {
    org.openmetadata.schema.entity.data.Table table =
        Entity.getEntity(Entity.TABLE, tableRef.getId(), "columns", Include.NON_DELETED);

    if (table.getColumns() == null || table.getColumns().isEmpty()) {
      return;
    }

    Set<String> tableColumnNames =
        table.getColumns().stream().map(Column::getName).collect(Collectors.toSet());

    for (org.openmetadata.schema.type.Field field : dataContract.getSchema()) {
      if (!tableColumnNames.contains(field.getName())) {
        throw BadRequestException.of(
            String.format(
                "Field '%s' specified in the data contract does not exist in table '%s'",
                field.getName(), table.getName()));
      }
    }
  }

  private void validateFieldsAgainstTopic(DataContract dataContract, EntityReference topicRef) {
    Topic topic =
        Entity.getEntity(Entity.TOPIC, topicRef.getId(), "messageSchema", Include.NON_DELETED);

    if (topic.getMessageSchema() == null
        || topic.getMessageSchema().getSchemaFields() == null
        || topic.getMessageSchema().getSchemaFields().isEmpty()) {
      return;
    }

    Set<String> topicFieldNames = extractFieldNames(topic.getMessageSchema().getSchemaFields());

    for (org.openmetadata.schema.type.Field field : dataContract.getSchema()) {
      if (!topicFieldNames.contains(field.getName())) {
        throw BadRequestException.of(
            String.format(
                "Field '%s' specified in the data contract does not exist in topic '%s'",
                field.getName(), topic.getName()));
      }
    }
  }

  private Set<String> extractFieldNames(List<org.openmetadata.schema.type.Field> fields) {
    if (fields == null || fields.isEmpty()) {
      return Collections.emptySet();
    }

    Set<String> fieldNames = new HashSet<>();
    for (org.openmetadata.schema.type.Field field : fields) {
      fieldNames.add(field.getName());
      if (field.getChildren() != null && !field.getChildren().isEmpty()) {
        fieldNames.addAll(extractFieldNames(field.getChildren()));
      }
    }
    return fieldNames;
  }

  public DataContract loadEntityDataContract(EntityReference entity) {
    return JsonUtils.readValue(
        getDaoCollection()
            .dataContractDAO()
            .getContractByEntityId(entity.getId().toString(), entity.getType()),
        DataContract.class);
  }

  @Override
  public void storeEntity(DataContract dataContract, boolean update) {
    store(dataContract, update);
  }

  @Override
  public void storeRelationships(DataContract dataContract) {
    addRelationship(
        dataContract.getEntity().getId(),
        dataContract.getId(),
        dataContract.getEntity().getType(),
        Entity.DATA_CONTRACT,
        Relationship.HAS);

    storeOwners(dataContract, dataContract.getOwners());
  }

  @Override
  public void restorePatchAttributes(DataContract original, DataContract updated) {
    updated
        .withId(original.getId())
        .withName(original.getName())
        .withFullyQualifiedName(original.getFullyQualifiedName())
        .withUpdatedAt(original.getUpdatedAt())
        .withUpdatedBy(original.getUpdatedBy());
  }

  private void validateEntityLink(EntityReference entity) {
    if (entity == null) {
      throw BadRequestException.of("Entity reference is required for data contract");
    }

    Entity.getEntityReferenceById(entity.getType(), entity.getId(), Include.NON_DELETED);

    ListFilter filter =
        new ListFilter(Include.NON_DELETED).addQueryParam("entity", entity.getId().toString());
    List<DataContract> existingContracts = listAll(new Fields(Set.of("id")), filter);

    if (!existingContracts.isEmpty()) {
      throw BadRequestException.of(
          String.format(
              "A data contract already exists for entity '%s' with ID %s",
              entity.getType(), entity.getId()));
    }
  }
}
