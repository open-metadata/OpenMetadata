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

import static javax.ws.rs.core.Response.Status.OK;
import static org.openmetadata.service.Entity.CONTAINER;
import static org.openmetadata.service.Entity.DASHBOARD;
import static org.openmetadata.service.Entity.DASHBOARD_DATA_MODEL;
import static org.openmetadata.service.Entity.MLMODEL;
import static org.openmetadata.service.Entity.SEARCH_INDEX;
import static org.openmetadata.service.Entity.TABLE;
import static org.openmetadata.service.Entity.TOPIC;
import static org.openmetadata.service.search.SearchClient.GLOBAL_SEARCH_ALIAS;
import static org.openmetadata.service.search.SearchClient.REMOVE_LINEAGE_SCRIPT;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.json.JsonPatch;
import javax.ws.rs.core.Response;
import org.apache.commons.lang3.tuple.ImmutablePair;
import org.apache.commons.lang3.tuple.Pair;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.api.lineage.AddLineage;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.schema.entity.data.MlModel;
import org.openmetadata.schema.entity.data.SearchIndex;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.type.ColumnLineage;
import org.openmetadata.schema.type.Edge;
import org.openmetadata.schema.type.EntityLineage;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO.EntityRelationshipRecord;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.models.IndexMapping;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.RestUtil;

@Repository
public class LineageRepository {
  private final CollectionDAO dao;

  private static final SearchClient searchClient = Entity.getSearchRepository().getSearchClient();

  public LineageRepository() {
    this.dao = Entity.getCollectionDAO();
    Entity.setLineageRepository(this);
  }

  public EntityLineage get(String entityType, String id, int upstreamDepth, int downstreamDepth) {
    EntityReference ref =
        Entity.getEntityReferenceById(entityType, UUID.fromString(id), Include.NON_DELETED);
    return getLineage(ref, upstreamDepth, downstreamDepth);
  }

  public EntityLineage getByName(
      String entityType, String fqn, int upstreamDepth, int downstreamDepth) {
    EntityReference ref = Entity.getEntityReferenceByName(entityType, fqn, Include.NON_DELETED);
    return getLineage(ref, upstreamDepth, downstreamDepth);
  }

  @Transaction
  public void addLineage(AddLineage addLineage) {
    // Validate from entity
    EntityReference from = addLineage.getEdge().getFromEntity();
    from = Entity.getEntityReferenceById(from.getType(), from.getId(), Include.NON_DELETED);

    // Validate to entity
    EntityReference to = addLineage.getEdge().getToEntity();
    to = Entity.getEntityReferenceById(to.getType(), to.getId(), Include.NON_DELETED);

    if (addLineage.getEdge().getLineageDetails() != null
        && addLineage.getEdge().getLineageDetails().getPipeline() != null) {

      // Validate pipeline entity
      EntityReference pipeline = addLineage.getEdge().getLineageDetails().getPipeline();
      pipeline =
          Entity.getEntityReferenceById(pipeline.getType(), pipeline.getId(), Include.NON_DELETED);

      // Add pipeline entity details to lineage details
      addLineage.getEdge().getLineageDetails().withPipeline(pipeline);
    }

    // Validate lineage details
    String detailsJson = validateLineageDetails(from, to, addLineage.getEdge().getLineageDetails());

    // Finally, add lineage relationship
    dao.relationshipDAO()
        .insert(
            from.getId(),
            to.getId(),
            from.getType(),
            to.getType(),
            Relationship.UPSTREAM.ordinal(),
            detailsJson);
    addLineageToSearch(from, to, addLineage.getEdge().getLineageDetails());
  }

  private void addLineageToSearch(
      EntityReference fromEntity, EntityReference toEntity, LineageDetails lineageDetails) {
    IndexMapping sourceIndexMapping =
        Entity.getSearchRepository().getIndexMapping(fromEntity.getType());
    String sourceIndexName =
        sourceIndexMapping.getIndexName(Entity.getSearchRepository().getClusterAlias());
    IndexMapping destinationIndexMapping =
        Entity.getSearchRepository().getIndexMapping(toEntity.getType());
    String destinationIndexName =
        destinationIndexMapping.getIndexName(Entity.getSearchRepository().getClusterAlias());
    Map<String, Object> relationshipDetails = new HashMap<>();
    Pair<String, String> from = new ImmutablePair<>("_id", fromEntity.getId().toString());
    Pair<String, String> to = new ImmutablePair<>("_id", toEntity.getId().toString());
    processLineageData(fromEntity, toEntity, lineageDetails, relationshipDetails);
    searchClient.updateLineage(sourceIndexName, from, relationshipDetails);
    searchClient.updateLineage(destinationIndexName, to, relationshipDetails);
  }

  private void processLineageData(
      EntityReference fromEntity,
      EntityReference toEntity,
      LineageDetails lineageDetails,
      Map<String, Object> relationshipDetails) {
    Map<String, Object> fromDetails = new HashMap<>();
    Map<String, Object> toDetails = new HashMap<>();
    fromDetails.put("id", fromEntity.getId().toString());
    fromDetails.put("type", fromEntity.getType());
    fromDetails.put("fqn", fromEntity.getFullyQualifiedName());
    toDetails.put("id", toEntity.getId().toString());
    toDetails.put("type", toEntity.getType());
    toDetails.put("fqn", toEntity.getFullyQualifiedName());
    relationshipDetails.put(
        "doc_id", fromEntity.getId().toString() + "-" + toEntity.getId().toString());
    relationshipDetails.put("fromEntity", fromDetails);
    relationshipDetails.put("toEntity", toDetails);
    if (lineageDetails != null) {
      relationshipDetails.put(
          "pipeline",
          JsonUtils.getMap(
              CommonUtil.nullOrEmpty(lineageDetails.getPipeline())
                  ? null
                  : lineageDetails.getPipeline()));
      relationshipDetails.put(
          "description",
          CommonUtil.nullOrEmpty(lineageDetails.getDescription())
              ? null
              : lineageDetails.getDescription());
      if (!CommonUtil.nullOrEmpty(lineageDetails.getColumnsLineage())) {
        List<Map<String, Object>> colummnLineageList = new ArrayList<>();
        for (ColumnLineage columnLineage : lineageDetails.getColumnsLineage()) {
          colummnLineageList.add(JsonUtils.getMap(columnLineage));
        }
        relationshipDetails.put("columns", colummnLineageList);
      }
      relationshipDetails.put(
          "sqlQuery",
          CommonUtil.nullOrEmpty(lineageDetails.getSqlQuery())
              ? null
              : lineageDetails.getSqlQuery());
      relationshipDetails.put(
          "source",
          CommonUtil.nullOrEmpty(lineageDetails.getSource()) ? null : lineageDetails.getSource());
    }
  }

  private String validateLineageDetails(
      EntityReference from, EntityReference to, LineageDetails details) {
    if (details == null) {
      return null;
    }
    List<ColumnLineage> columnsLineage = details.getColumnsLineage();
    if (columnsLineage != null && !columnsLineage.isEmpty()) {
      for (ColumnLineage columnLineage : columnsLineage) {
        for (String fromColumn : columnLineage.getFromColumns()) {
          validateChildren(fromColumn, from);
        }
        validateChildren(columnLineage.getToColumn(), to);
      }
    }
    return JsonUtils.pojoToJson(details);
  }

  private void validateChildren(String columnFQN, EntityReference entityReference) {
    switch (entityReference.getType()) {
      case TABLE -> {
        Table table =
            Entity.getEntity(TABLE, entityReference.getId(), "columns", Include.NON_DELETED);
        ColumnUtil.validateColumnFQN(table.getColumns(), columnFQN);
      }
      case SEARCH_INDEX -> {
        SearchIndex searchIndex =
            Entity.getEntity(SEARCH_INDEX, entityReference.getId(), "fields", Include.NON_DELETED);
        ColumnUtil.validateSearchIndexFieldFQN(searchIndex.getFields(), columnFQN);
      }
      case TOPIC -> {
        Topic topic =
            Entity.getEntity(TOPIC, entityReference.getId(), "messageSchema", Include.NON_DELETED);
        ColumnUtil.validateFieldFQN(topic.getMessageSchema().getSchemaFields(), columnFQN);
      }
      case CONTAINER -> {
        Container container =
            Entity.getEntity(CONTAINER, entityReference.getId(), "dataModel", Include.NON_DELETED);
        ColumnUtil.validateColumnFQN(container.getDataModel().getColumns(), columnFQN);
      }
      case DASHBOARD_DATA_MODEL -> {
        DashboardDataModel dashboardDataModel =
            Entity.getEntity(
                DASHBOARD_DATA_MODEL, entityReference.getId(), "columns", Include.NON_DELETED);
        ColumnUtil.validateColumnFQN(dashboardDataModel.getColumns(), columnFQN);
      }
      case DASHBOARD -> {
        Dashboard dashboard =
            Entity.getEntity(DASHBOARD, entityReference.getId(), "charts", Include.NON_DELETED);
        dashboard.getCharts().stream()
            .filter(c -> c.getFullyQualifiedName().equals(columnFQN))
            .findAny()
            .orElseThrow(
                () ->
                    new IllegalArgumentException(
                        CatalogExceptionMessage.invalidFieldName("chart", columnFQN)));
      }
      case MLMODEL -> {
        MlModel mlModel =
            Entity.getEntity(MLMODEL, entityReference.getId(), "", Include.NON_DELETED);
        mlModel.getMlFeatures().stream()
            .filter(f -> f.getFullyQualifiedName().equals(columnFQN))
            .findAny()
            .orElseThrow(
                () ->
                    new IllegalArgumentException(
                        CatalogExceptionMessage.invalidFieldName("feature", columnFQN)));
      }
      default -> throw new IllegalArgumentException(
          String.format("Unsupported Entity Type %s for lineage", entityReference.getType()));
    }
  }

  @Transaction
  public boolean deleteLineageByFQN(
      String fromEntity, String fromFQN, String toEntity, String toFQN) {
    EntityReference from =
        Entity.getEntityReferenceByName(fromEntity, fromFQN, Include.NON_DELETED);
    EntityReference to = Entity.getEntityReferenceByName(toEntity, toFQN, Include.NON_DELETED);
    // Finally, delete lineage relationship
    boolean result =
        dao.relationshipDAO()
                .delete(
                    from.getId(),
                    from.getType(),
                    to.getId(),
                    to.getType(),
                    Relationship.UPSTREAM.ordinal())
            > 0;
    deleteLineageFromSearch(from, to);
    return result;
  }

  @Transaction
  public boolean deleteLineage(String fromEntity, String fromId, String toEntity, String toId) {
    // Validate from entity
    EntityReference from =
        Entity.getEntityReferenceById(fromEntity, UUID.fromString(fromId), Include.NON_DELETED);

    // Validate to entity
    EntityReference to =
        Entity.getEntityReferenceById(toEntity, UUID.fromString(toId), Include.NON_DELETED);

    // Finally, delete lineage relationship
    boolean result =
        dao.relationshipDAO()
                .delete(
                    from.getId(),
                    from.getType(),
                    to.getId(),
                    to.getType(),
                    Relationship.UPSTREAM.ordinal())
            > 0;
    deleteLineageFromSearch(from, to);
    return result;
  }

  private void deleteLineageFromSearch(EntityReference fromEntity, EntityReference toEntity) {
    searchClient.updateChildren(
        GLOBAL_SEARCH_ALIAS,
        new ImmutablePair<>(
            "lineage.doc_id.keyword",
            fromEntity.getId().toString() + "-" + toEntity.getId().toString()),
        new ImmutablePair<>(
            String.format(
                REMOVE_LINEAGE_SCRIPT,
                fromEntity.getId().toString() + "-" + toEntity.getId().toString()),
            null));
  }

  private EntityLineage getLineage(
      EntityReference primary, int upstreamDepth, int downstreamDepth) {
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
    lineage.withNodes(lineage.getNodes().stream().distinct().toList());
    return lineage;
  }

  private void getUpstreamLineage(
      UUID id, String entityType, EntityLineage lineage, int upstreamDepth) {
    if (upstreamDepth == 0) {
      return;
    }
    List<EntityRelationshipRecord> records;
    // pipeline information is not maintained
    if (entityType.equals(Entity.PIPELINE) || entityType.equals(Entity.STORED_PROCEDURE)) {
      records = dao.relationshipDAO().findFromPipeline(id, Relationship.UPSTREAM.ordinal());
    } else {
      records = dao.relationshipDAO().findFrom(id, entityType, Relationship.UPSTREAM.ordinal());
    }
    final List<EntityReference> upstreamEntityReferences = new ArrayList<>();
    for (EntityRelationshipRecord entityRelationshipRecord : records) {
      EntityReference ref =
          Entity.getEntityReferenceById(
              entityRelationshipRecord.getType(), entityRelationshipRecord.getId(), Include.ALL);
      LineageDetails lineageDetails =
          JsonUtils.readValue(entityRelationshipRecord.getJson(), LineageDetails.class);
      upstreamEntityReferences.add(ref);
      lineage
          .getUpstreamEdges()
          .add(
              new Edge()
                  .withFromEntity(ref.getId())
                  .withToEntity(id)
                  .withLineageDetails(lineageDetails));
    }
    lineage.getNodes().addAll(upstreamEntityReferences);
    // from this id ---> find other ids

    upstreamDepth--;
    // Recursively add upstream nodes and edges
    for (EntityReference entity : upstreamEntityReferences) {
      getUpstreamLineage(entity.getId(), entity.getType(), lineage, upstreamDepth);
    }
  }

  public Response getLineageEdge(UUID fromId, UUID toId) {
    String json = dao.relationshipDAO().getRelation(fromId, toId, Relationship.UPSTREAM.ordinal());
    if (json != null) {
      Map<String, Object> responseMap = new HashMap<>();
      LineageDetails lineageDetails = JsonUtils.readValue(json, LineageDetails.class);
      responseMap.put("edge", lineageDetails);
      return Response.status(OK).entity(responseMap).build();
    } else {
      throw new EntityNotFoundException(
          "Lineage edge not found between " + fromId + " and " + " " + toId);
    }
  }

  public Response patchLineageEdge(
      String fromEntity, UUID fromId, String toEntity, UUID toId, JsonPatch patch) {
    EntityReference from = Entity.getEntityReferenceById(fromEntity, fromId, Include.NON_DELETED);
    EntityReference to = Entity.getEntityReferenceById(toEntity, toId, Include.NON_DELETED);
    String json = dao.relationshipDAO().getRelation(fromId, toId, Relationship.UPSTREAM.ordinal());

    if (json != null) {

      LineageDetails original = JsonUtils.readValue(json, LineageDetails.class);
      LineageDetails updated = JsonUtils.applyPatch(original, patch, LineageDetails.class);
      if (updated.getPipeline() != null) {
        // Validate pipeline entity
        EntityReference pipeline = updated.getPipeline();
        pipeline =
            Entity.getEntityReferenceById(
                pipeline.getType(), pipeline.getId(), Include.NON_DELETED);
        updated.withPipeline(pipeline);
      }
      String detailsJson = JsonUtils.pojoToJson(updated);
      dao.relationshipDAO()
          .insert(fromId, toId, fromEntity, toEntity, Relationship.UPSTREAM.ordinal(), detailsJson);
      addLineageToSearch(from, to, updated);
      return new RestUtil.PatchResponse<>(Response.Status.OK, updated, EventType.ENTITY_UPDATED)
          .toResponse();
    } else {
      throw new EntityNotFoundException(
          "Lineage edge not found between "
              + fromEntity
              + " "
              + fromId
              + " and "
              + toEntity
              + " "
              + toId);
    }
  }

  private void getDownstreamLineage(
      UUID id, String entityType, EntityLineage lineage, int downstreamDepth) {
    if (downstreamDepth == 0) {
      return;
    }
    List<EntityRelationshipRecord> records;
    if (entityType.equals(Entity.PIPELINE) || entityType.equals(Entity.STORED_PROCEDURE)) {
      records = dao.relationshipDAO().findToPipeline(id, Relationship.UPSTREAM.ordinal());
    } else {
      records = dao.relationshipDAO().findTo(id, entityType, Relationship.UPSTREAM.ordinal());
    }
    final List<EntityReference> downstreamEntityReferences = new ArrayList<>();
    for (EntityRelationshipRecord entityRelationshipRecord : records) {
      EntityReference ref =
          Entity.getEntityReferenceById(
              entityRelationshipRecord.getType(), entityRelationshipRecord.getId(), Include.ALL);
      LineageDetails lineageDetails =
          JsonUtils.readValue(entityRelationshipRecord.getJson(), LineageDetails.class);
      downstreamEntityReferences.add(ref);
      lineage
          .getDownstreamEdges()
          .add(
              new Edge()
                  .withToEntity(ref.getId())
                  .withFromEntity(id)
                  .withLineageDetails(lineageDetails));
    }
    lineage.getNodes().addAll(downstreamEntityReferences);

    downstreamDepth--;
    // Recursively add upstream nodes and edges
    for (EntityReference entity : downstreamEntityReferences) {
      getDownstreamLineage(entity.getId(), entity.getType(), lineage, downstreamDepth);
    }
  }
}
