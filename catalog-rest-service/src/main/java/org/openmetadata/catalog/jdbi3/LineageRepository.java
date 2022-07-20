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

package org.openmetadata.catalog.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.lineage.AddLineage;
import org.openmetadata.catalog.entity.data.Table;
import org.openmetadata.catalog.jdbi3.CollectionDAO.EntityRelationshipRecord;
import org.openmetadata.catalog.type.ColumnLineage;
import org.openmetadata.catalog.type.Edge;
import org.openmetadata.catalog.type.EntityLineage;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.Include;
import org.openmetadata.catalog.type.LineageDetails;
import org.openmetadata.catalog.type.Relationship;
import org.openmetadata.catalog.util.FullyQualifiedName;
import org.openmetadata.catalog.util.JsonUtils;

public class LineageRepository {
  private final CollectionDAO dao;

  public LineageRepository(CollectionDAO dao) {
    this.dao = dao;
  }

  @Transaction
  public EntityLineage get(String entityType, String id, int upstreamDepth, int downstreamDepth) throws IOException {
    EntityReference ref = Entity.getEntityReferenceById(entityType, UUID.fromString(id), Include.NON_DELETED);
    return getLineage(ref, upstreamDepth, downstreamDepth);
  }

  @Transaction
  public EntityLineage getByName(String entityType, String fqn, int upstreamDepth, int downstreamDepth)
      throws IOException {
    EntityReference ref = Entity.getEntityReferenceByName(entityType, fqn, Include.NON_DELETED);
    return getLineage(ref, upstreamDepth, downstreamDepth);
  }

  @Transaction
  public void addLineage(AddLineage addLineage) throws IOException {
    // Validate from entity
    EntityReference from = addLineage.getEdge().getFromEntity();
    from = Entity.getEntityReferenceById(from.getType(), from.getId(), Include.NON_DELETED);

    // Validate to entity
    EntityReference to = addLineage.getEdge().getToEntity();
    to = Entity.getEntityReferenceById(to.getType(), to.getId(), Include.NON_DELETED);

    // Validate lineage details
    String detailsJson = validateLineageDetails(from, to, addLineage.getEdge().getLineageDetails());

    // Finally, add lineage relationship
    dao.relationshipDAO()
        .insert(from.getId(), to.getId(), from.getType(), to.getType(), Relationship.UPSTREAM.ordinal(), detailsJson);
  }

  private String validateLineageDetails(EntityReference from, EntityReference to, LineageDetails details)
      throws IOException {
    if (details == null || listOrEmpty(details.getColumnsLineage()).isEmpty()) {
      return null;
    }

    List<ColumnLineage> columnsLineage = details.getColumnsLineage();
    if (!from.getType().equals(Entity.TABLE) || !to.getType().equals(Entity.TABLE)) {
      throw new IllegalArgumentException("Column level lineage is only allowed between two tables.");
    }

    Table fromTable = dao.tableDAO().findEntityById(from.getId());
    Table toTable = dao.tableDAO().findEntityById(to.getId());
    for (ColumnLineage columnLineage : columnsLineage) {
      for (String fromColumn : columnLineage.getFromColumns()) {
        // From column belongs to the fromNode
        if (fromColumn.startsWith(fromTable.getFullyQualifiedName())) {
          TableRepository.validateColumnFQN(fromTable, fromColumn);
        } else {
          Table otherTable = dao.tableDAO().findEntityByName(FullyQualifiedName.getTableFQN(fromColumn));
          TableRepository.validateColumnFQN(otherTable, fromColumn);
        }
      }
      TableRepository.validateColumnFQN(toTable, columnLineage.getToColumn());
    }
    return JsonUtils.pojoToJson(details);
  }

  @Transaction
  public boolean deleteLineage(String fromEntity, String fromId, String toEntity, String toId) throws IOException {
    // Validate from entity
    EntityReference from = Entity.getEntityReferenceById(fromEntity, UUID.fromString(fromId), Include.NON_DELETED);

    // Validate to entity
    EntityReference to = Entity.getEntityReferenceById(toEntity, UUID.fromString(toId), Include.NON_DELETED);

    // Finally, delete lineage relationship
    return dao.relationshipDAO()
            .delete(
                from.getId().toString(),
                from.getType(),
                to.getId().toString(),
                to.getType(),
                Relationship.UPSTREAM.ordinal())
        > 0;
  }

  private EntityLineage getLineage(EntityReference primary, int upstreamDepth, int downstreamDepth) throws IOException {
    List<EntityReference> entities = new ArrayList<>();
    EntityLineage lineage =
        new EntityLineage()
            .withEntity(primary)
            .withNodes(entities)
            .withUpstreamEdges(new ArrayList<>())
            .withDownstreamEdges(new ArrayList<>());
    getUpstreamLineage(primary.getId(), primary.getType(), lineage, upstreamDepth);
    getDownstreamLineage(primary.getId(), primary.getType(), lineage, downstreamDepth);

    // Remove duplicate nodes
    lineage.withNodes(lineage.getNodes().stream().distinct().collect(Collectors.toList()));
    return lineage;
  }

  private void getUpstreamLineage(UUID id, String entityType, EntityLineage lineage, int upstreamDepth)
      throws IOException {
    if (upstreamDepth == 0) {
      return;
    }
    // from this id ---> find other ids
    List<EntityRelationshipRecord> records =
        dao.relationshipDAO().findFrom(id.toString(), entityType, Relationship.UPSTREAM.ordinal());

    final List<EntityReference> upstreamEntityReferences = new ArrayList<>();
    for (EntityRelationshipRecord record : records) {
      EntityReference ref = Entity.getEntityReferenceById(record.getType(), record.getId(), Include.ALL);
      LineageDetails lineageDetails = JsonUtils.readValue(record.getJson(), LineageDetails.class);
      upstreamEntityReferences.add(ref);
      lineage
          .getUpstreamEdges()
          .add(new Edge().withFromEntity(ref.getId()).withToEntity(id).withLineageDetails(lineageDetails));
    }

    lineage.getNodes().addAll(upstreamEntityReferences);

    upstreamDepth--;
    // Recursively add upstream nodes and edges
    for (EntityReference entity : upstreamEntityReferences) {
      getUpstreamLineage(entity.getId(), entity.getType(), lineage, upstreamDepth);
    }
  }

  private void getDownstreamLineage(UUID id, String entityType, EntityLineage lineage, int downstreamDepth)
      throws IOException {
    if (downstreamDepth == 0) {
      return;
    }
    // from other ids ---> to this id
    List<EntityRelationshipRecord> records =
        dao.relationshipDAO().findTo(id.toString(), entityType, Relationship.UPSTREAM.ordinal());

    final List<EntityReference> downstreamEntityReferences = new ArrayList<>();
    for (EntityRelationshipRecord record : records) {
      EntityReference ref = Entity.getEntityReferenceById(record.getType(), record.getId(), Include.ALL);
      LineageDetails lineageDetails = JsonUtils.readValue(record.getJson(), LineageDetails.class);
      downstreamEntityReferences.add(ref);
      lineage
          .getDownstreamEdges()
          .add(new Edge().withToEntity(ref.getId()).withFromEntity(id).withLineageDetails(lineageDetails));
    }
    lineage.getNodes().addAll(downstreamEntityReferences);

    downstreamDepth--;
    // Recursively add upstream nodes and edges
    for (EntityReference entity : downstreamEntityReferences) {
      getDownstreamLineage(entity.getId(), entity.getType(), lineage, downstreamDepth);
    }
  }
}
