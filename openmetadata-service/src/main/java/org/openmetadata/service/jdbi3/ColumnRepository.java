/*
 *  Copyright 2024 Collate
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

import static org.openmetadata.service.Entity.DASHBOARD_DATA_MODEL;
import static org.openmetadata.service.Entity.DASHBOARD_DATA_MODEL_COLUMN;
import static org.openmetadata.service.Entity.TABLE;
import static org.openmetadata.service.Entity.TABLE_COLUMN;
import static org.openmetadata.service.events.ChangeEventHandler.copyChangeEvent;
import static org.openmetadata.service.formatter.util.FormatterUtil.createChangeEventForEntity;
import static org.openmetadata.service.resources.tags.TagLabelUtil.addDerivedTags;

import jakarta.json.JsonPatch;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.data.UpdateColumn;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.RestUtil;

@Slf4j
public class ColumnRepository {
  private final Authorizer authorizer;

  public ColumnRepository(Authorizer authorizer) {
    this.authorizer = authorizer;
  }

  public Column updateColumnByFQN(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String columnFQN,
      String entityType,
      UpdateColumn updateColumn) {
    Objects.requireNonNull(columnFQN, "columnFQN cannot be null");
    Objects.requireNonNull(updateColumn, "updateColumn cannot be null");

    if (columnFQN.isBlank()) {
      throw new IllegalArgumentException("columnFQN cannot be blank");
    }

    // Validate entity type first before any other processing
    validateEntityType(entityType);

    String parentFQN = extractParentFQN(columnFQN, entityType);
    EntityReference parentEntityRef = getParentEntityByFQN(parentFQN, entityType);
    String user = securityContext.getUserPrincipal().getName();

    return switch (entityType) {
      case TABLE -> updateTableColumn(
          uriInfo, securityContext, user, columnFQN, updateColumn, parentEntityRef);
      case DASHBOARD_DATA_MODEL -> updateDashboardDataModelColumn(
          uriInfo, securityContext, user, columnFQN, updateColumn, parentEntityRef);
      default -> throw new IllegalStateException("Unexpected entity type: " + entityType);
    };
  }

  private void validateEntityType(String entityType) {
    if (entityType == null) {
      throw new IllegalArgumentException(
          "Entity type is required. Supported types are: table, dashboardDataModel");
    }
    if (!TABLE.equals(entityType) && !DASHBOARD_DATA_MODEL.equals(entityType)) {
      throw new IllegalArgumentException(
          "Unsupported entity type: %s. Supported types are: %s, %s"
              .formatted(entityType, TABLE, DASHBOARD_DATA_MODEL));
    }
  }

  private String extractParentFQN(String columnFQN, String entityType) {
    try {
      return FullyQualifiedName.getParentEntityFQN(columnFQN, entityType);
    } catch (Exception e) {
      throw new IllegalArgumentException(
          "Invalid column FQN format: %s. Error: %s".formatted(columnFQN, e.getMessage()), e);
    }
  }

  private Column updateTableColumn(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String user,
      String columnFQN,
      UpdateColumn updateColumn,
      EntityReference parentEntityRef) {
    TableRepository tableRepository = (TableRepository) Entity.getEntityRepository(TABLE);
    Table originalTable =
        tableRepository.get(
            null,
            parentEntityRef.getId(),
            tableRepository.getFields("columns,tags,tableConstraints"),
            Include.NON_DELETED,
            false);

    Table updatedTable = JsonUtils.deepCopy(originalTable, Table.class);
    ColumnUtil.setColumnFQN(updatedTable.getFullyQualifiedName(), updatedTable.getColumns());

    Column column =
        findColumnInHierarchy(updatedTable.getColumns(), columnFQN)
            .orElseThrow(
                () -> new EntityNotFoundException("Column not found: %s".formatted(columnFQN)));

    applyColumnUpdates(column, updateColumn, TABLE_COLUMN, true);

    JsonPatch jsonPatch = JsonUtils.getJsonPatch(originalTable, updatedTable);
    authorizeAndPatch(securityContext, TABLE, parentEntityRef, jsonPatch);

    RestUtil.PatchResponse<Table> patchResponse =
        tableRepository.patch(uriInfo, parentEntityRef.getId(), user, jsonPatch);
    triggerParentChangeEvent(patchResponse.entity(), user);

    return column;
  }

  private Column updateDashboardDataModelColumn(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String user,
      String columnFQN,
      UpdateColumn updateColumn,
      EntityReference parentEntityRef) {
    DashboardDataModelRepository dataModelRepository =
        (DashboardDataModelRepository) Entity.getEntityRepository(DASHBOARD_DATA_MODEL);

    DashboardDataModel originalDataModel =
        dataModelRepository.get(
            null,
            parentEntityRef.getId(),
            dataModelRepository.getFields("columns,tags"),
            Include.NON_DELETED,
            false);

    DashboardDataModel updatedDataModel =
        JsonUtils.deepCopy(originalDataModel, DashboardDataModel.class);

    setDataModelColumnFQN(updatedDataModel.getFullyQualifiedName(), updatedDataModel.getColumns());

    Column column =
        findColumnInHierarchy(updatedDataModel.getColumns(), columnFQN)
            .orElseThrow(
                () -> new EntityNotFoundException("Column not found: %s".formatted(columnFQN)));

    applyColumnUpdates(column, updateColumn, DASHBOARD_DATA_MODEL_COLUMN, false);

    JsonPatch jsonPatch = JsonUtils.getJsonPatch(originalDataModel, updatedDataModel);
    authorizeAndPatch(securityContext, DASHBOARD_DATA_MODEL, parentEntityRef, jsonPatch);

    RestUtil.PatchResponse<DashboardDataModel> patchResponse =
        dataModelRepository.patch(uriInfo, parentEntityRef.getId(), user, jsonPatch);
    triggerParentChangeEvent(patchResponse.entity(), user);

    return column;
  }

  private void applyColumnUpdates(
      Column column,
      UpdateColumn updateColumn,
      String columnEntityType,
      boolean supportsConstraints) {
    Optional.ofNullable(updateColumn.getDisplayName())
        .ifPresent(name -> column.setDisplayName(name.trim().isEmpty() ? null : name));

    Optional.ofNullable(updateColumn.getDescription())
        .ifPresent(desc -> column.setDescription(desc.trim().isEmpty() ? null : desc));

    Optional.ofNullable(updateColumn.getTags())
        .ifPresent(tags -> column.setTags(addDerivedTags(tags)));

    if (supportsConstraints) {
      if (Boolean.TRUE.equals(updateColumn.getRemoveConstraint())) {
        column.setConstraint(null);
      } else {
        Optional.ofNullable(updateColumn.getConstraint()).ifPresent(column::setConstraint);
      }
    }

    Optional.ofNullable(updateColumn.getExtension())
        .ifPresent(
            ext -> {
              Object transformedExtension =
                  EntityRepository.validateAndTransformExtension(ext, columnEntityType);
              column.setExtension(transformedExtension);
            });
  }

  private void authorizeAndPatch(
      SecurityContext securityContext,
      String entityType,
      EntityReference parentEntityRef,
      JsonPatch jsonPatch) {
    OperationContext operationContext = new OperationContext(entityType, jsonPatch);
    ResourceContextInterface resourceContext =
        new ResourceContext<>(
            entityType, parentEntityRef.getId(), null, ResourceContextInterface.Operation.PATCH);
    authorizer.authorize(securityContext, operationContext, resourceContext);
  }

  private void setDataModelColumnFQN(String parentFQN, List<Column> columns) {
    if (columns == null) {
      return;
    }
    columns.forEach(
        c -> {
          String columnFqn = FullyQualifiedName.add(parentFQN, c.getName());
          c.setFullyQualifiedName(columnFqn);
          if (c.getChildren() != null) {
            setDataModelColumnFQN(columnFqn, c.getChildren());
          }
        });
  }

  private EntityReference getParentEntityByFQN(String parentFQN, String entityType) {
    return switch (entityType) {
      case TABLE -> {
        TableRepository tableRepository = (TableRepository) Entity.getEntityRepository(TABLE);
        Table table = tableRepository.findByName(parentFQN, Include.NON_DELETED);
        yield table.getEntityReference();
      }
      case DASHBOARD_DATA_MODEL -> {
        DashboardDataModelRepository dataModelRepository =
            (DashboardDataModelRepository) Entity.getEntityRepository(DASHBOARD_DATA_MODEL);
        DashboardDataModel dataModel =
            dataModelRepository.findByName(parentFQN, Include.NON_DELETED);
        yield dataModel.getEntityReference();
      }
      default -> throw new IllegalArgumentException(
          "Unsupported entity type: %s".formatted(entityType));
    };
  }

  Optional<Column> findColumnInHierarchy(List<Column> columns, String columnFQN) {
    if (columns == null) {
      return Optional.empty();
    }

    return columns.stream()
        .map(
            column -> {
              if (columnFQN.equals(column.getFullyQualifiedName())) {
                return Optional.of(column);
              }
              return findColumnInHierarchy(column.getChildren(), columnFQN);
            })
        .flatMap(Optional::stream)
        .findFirst();
  }

  private void triggerParentChangeEvent(Object parent, String user) {
    ChangeEvent changeEvent =
        createChangeEventForEntity(user, EventType.ENTITY_UPDATED, (EntityInterface) parent);
    Object entity = changeEvent.getEntity();
    changeEvent = copyChangeEvent(changeEvent);
    changeEvent.setEntity(JsonUtils.pojoToMaskedJson(entity));
    Entity.getCollectionDAO().changeEventDAO().insert(JsonUtils.pojoToJson(changeEvent));
  }
}
