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
import static org.openmetadata.service.Entity.TABLE;
import static org.openmetadata.service.resources.tags.TagLabelUtil.addDerivedTags;

import jakarta.json.JsonPatch;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.data.UpdateColumn;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.JsonUtils;

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
    if (entityType == null) {
      throw new IllegalArgumentException(
          "Entity type is required. Supported types are: table, dashboardDataModel");
    }

    if (!TABLE.equals(entityType) && !DASHBOARD_DATA_MODEL.equals(entityType)) {
      throw new IllegalArgumentException(
          String.format(
              "Unsupported entity type: %s. Supported types are: %s, %s",
              entityType, TABLE, DASHBOARD_DATA_MODEL));
    }

    String parentFQN;
    try {
      parentFQN = FullyQualifiedName.getParentEntityFQN(columnFQN, entityType);
    } catch (Exception e) {
      throw new IllegalArgumentException(
          String.format("Invalid column FQN format: %s. Error: %s", columnFQN, e.getMessage()), e);
    }

    EntityReference parentEntityRef = getParentEntityByFQN(parentFQN, entityType);
    String user = securityContext.getUserPrincipal().getName();

    if (TABLE.equals(entityType)) {
      return updateTableColumn(
          uriInfo, securityContext, user, columnFQN, updateColumn, parentEntityRef);
    } else {
      return updateDashboardDataModelColumn(
          uriInfo, securityContext, user, columnFQN, updateColumn, parentEntityRef);
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

    Column column = findColumnInHierarchy(updatedTable.getColumns(), columnFQN);
    if (column == null) {
      throw new EntityNotFoundException(String.format("Column not found: %s", columnFQN));
    }

    // Update fields that are explicitly provided
    // Empty strings and special values indicate deletion
    if (updateColumn.getDisplayName() != null) {
      if (updateColumn.getDisplayName().trim().isEmpty()) {
        column.setDisplayName(null); // Empty string = delete displayName
      } else {
        column.setDisplayName(updateColumn.getDisplayName());
      }
    }
    if (updateColumn.getDescription() != null) {
      if (updateColumn.getDescription().trim().isEmpty()) {
        column.setDescription(null); // Empty string = delete description
      } else {
        column.setDescription(updateColumn.getDescription());
      }
    }
    if (updateColumn.getTags() != null) {
      column.setTags(
          addDerivedTags(
              updateColumn.getTags())); // Include Derived Tags, Empty array = remove all tags
    }
    // Handle constraint updates and removal
    if (updateColumn.getRemoveConstraint() != null && updateColumn.getRemoveConstraint()) {
      column.setConstraint(null); // removeConstraint=true = delete constraint
    } else if (updateColumn.getConstraint() != null) {
      column.setConstraint(updateColumn.getConstraint()); // Set new constraint
    }

    JsonPatch jsonPatch = JsonUtils.getJsonPatch(originalTable, updatedTable);

    // Authorize the patch operation
    OperationContext operationContext = new OperationContext(TABLE, jsonPatch);
    ResourceContextInterface resourceContext =
        new ResourceContext<>(
            TABLE, parentEntityRef.getId(), null, ResourceContextInterface.Operation.PATCH);
    authorizer.authorize(securityContext, operationContext, resourceContext);

    tableRepository.patch(uriInfo, parentEntityRef.getId(), user, jsonPatch);

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

    Column column = findColumnInHierarchy(updatedDataModel.getColumns(), columnFQN);
    if (column == null) {
      throw new EntityNotFoundException(String.format("Column not found: %s", columnFQN));
    }

    // Update fields that are explicitly provided
    // Empty strings indicate deletion (constraints not supported for dashboard data model columns)
    if (updateColumn.getDisplayName() != null) {
      if (updateColumn.getDisplayName().trim().isEmpty()) {
        column.setDisplayName(null); // Empty string = delete displayName
      } else {
        column.setDisplayName(updateColumn.getDisplayName());
      }
    }
    if (updateColumn.getDescription() != null) {
      if (updateColumn.getDescription().trim().isEmpty()) {
        column.setDescription(null); // Empty string = delete description
      } else {
        column.setDescription(updateColumn.getDescription());
      }
    }
    if (updateColumn.getTags() != null) {
      column.setTags(
          addDerivedTags(
              updateColumn.getTags())); // Include Derived Tags, Empty array = remove all tags
    }

    JsonPatch jsonPatch = JsonUtils.getJsonPatch(originalDataModel, updatedDataModel);

    // Authorize the patch operation
    OperationContext operationContext = new OperationContext(DASHBOARD_DATA_MODEL, jsonPatch);
    ResourceContextInterface resourceContext =
        new ResourceContext<>(
            DASHBOARD_DATA_MODEL,
            parentEntityRef.getId(),
            null,
            ResourceContextInterface.Operation.PATCH);
    authorizer.authorize(securityContext, operationContext, resourceContext);

    dataModelRepository.patch(uriInfo, parentEntityRef.getId(), user, jsonPatch);

    return column;
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
    if (TABLE.equals(entityType)) {
      TableRepository tableRepository = (TableRepository) Entity.getEntityRepository(TABLE);
      Table table = tableRepository.findByName(parentFQN, Include.NON_DELETED);
      return table.getEntityReference();
    } else if (DASHBOARD_DATA_MODEL.equals(entityType)) {
      DashboardDataModelRepository dataModelRepository =
          (DashboardDataModelRepository) Entity.getEntityRepository(DASHBOARD_DATA_MODEL);
      DashboardDataModel dataModel = dataModelRepository.findByName(parentFQN, Include.NON_DELETED);
      return dataModel.getEntityReference();
    } else {
      throw new IllegalArgumentException(String.format("Unsupported entity type: %s", entityType));
    }
  }

  Column findColumnInHierarchy(List<Column> columns, String columnFQN) {
    if (columns == null) {
      return null;
    }

    for (Column column : columns) {
      if (columnFQN.equals(column.getFullyQualifiedName())) {
        return column;
      }
      if (column.getChildren() != null) {
        Column found = findColumnInHierarchy(column.getChildren(), columnFQN);
        if (found != null) {
          return found;
        }
      }
    }
    return null;
  }
}
