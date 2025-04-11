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
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.csv.CsvUtil.addField;
import static org.openmetadata.csv.EntityCsv.getCsvDocumentation;
import static org.openmetadata.service.Entity.API_ENDPOINT;
import static org.openmetadata.service.Entity.CONTAINER;
import static org.openmetadata.service.Entity.DASHBOARD;
import static org.openmetadata.service.Entity.DASHBOARD_DATA_MODEL;
import static org.openmetadata.service.Entity.METRIC;
import static org.openmetadata.service.Entity.MLMODEL;
import static org.openmetadata.service.Entity.PIPELINE;
import static org.openmetadata.service.Entity.SEARCH_INDEX;
import static org.openmetadata.service.Entity.TABLE;
import static org.openmetadata.service.Entity.TOPIC;
import static org.openmetadata.service.search.SearchClient.GLOBAL_SEARCH_ALIAS;
import static org.openmetadata.service.search.SearchClient.REMOVE_LINEAGE_SCRIPT;

import com.fasterxml.jackson.databind.JsonNode;
import com.opencsv.CSVWriter;
import java.io.IOException;
import java.io.StringWriter;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.json.JsonPatch;
import javax.ws.rs.core.Response;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.tuple.ImmutablePair;
import org.apache.commons.lang3.tuple.Pair;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.csv.CsvUtil;
import org.openmetadata.schema.api.lineage.AddLineage;
import org.openmetadata.schema.entity.data.APIEndpoint;
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
import org.openmetadata.schema.type.csv.CsvDocumentation;
import org.openmetadata.schema.type.csv.CsvFile;
import org.openmetadata.schema.type.csv.CsvHeader;
import org.openmetadata.sdk.exception.CSVExportException;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO.EntityRelationshipRecord;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.models.IndexMapping;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.RestUtil;

@Slf4j
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
    Map<String, Object> relationshipDetails =
        buildRelationshipDetailsMap(fromEntity, toEntity, lineageDetails);
    Pair<String, String> from = new ImmutablePair<>("_id", fromEntity.getId().toString());
    Pair<String, String> to = new ImmutablePair<>("_id", toEntity.getId().toString());
    searchClient.updateLineage(sourceIndexName, from, relationshipDetails);
    searchClient.updateLineage(destinationIndexName, to, relationshipDetails);
  }

  public static Map<String, Object> buildEntityRefMap(EntityReference entityRef) {
    Map<String, Object> details = new HashMap<>();
    details.put("id", entityRef.getId().toString());
    details.put("type", entityRef.getType());
    details.put("fqn", entityRef.getFullyQualifiedName());
    details.put("fqnHash", FullyQualifiedName.buildHash(entityRef.getFullyQualifiedName()));
    return details;
  }

  public static Map<String, Object> buildRelationshipDetailsMap(
      EntityReference fromEntity, EntityReference toEntity, LineageDetails lineageDetails) {
    Map<String, Object> relationshipDetails = new HashMap<>();
    relationshipDetails.put(
        "doc_id", fromEntity.getId().toString() + "-" + toEntity.getId().toString());
    relationshipDetails.put("fromEntity", buildEntityRefMap(fromEntity));
    relationshipDetails.put("toEntity", buildEntityRefMap(toEntity));
    if (lineageDetails != null) {
      // Add Pipeline Details
      addPipelineDetails(relationshipDetails, lineageDetails.getPipeline());
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
    return relationshipDetails;
  }

  public static void addPipelineDetails(
      Map<String, Object> relationshipDetails, EntityReference pipelineRef) {
    if (CommonUtil.nullOrEmpty(pipelineRef)) {
      relationshipDetails.put(PIPELINE, JsonUtils.getMap(null));
    } else {
      Map<String, Object> pipelineMap;
      if (pipelineRef.getType().equals(PIPELINE)) {
        pipelineMap =
            JsonUtils.getMap(
                Entity.getEntity(pipelineRef, "pipelineStatus,tags,owners", Include.ALL));
      } else {
        pipelineMap = JsonUtils.getMap(Entity.getEntity(pipelineRef, "tags,owners", Include.ALL));
      }
      pipelineMap.remove("changeDescription");
      relationshipDetails.put("pipelineEntityType", pipelineRef.getType());
      relationshipDetails.put(PIPELINE, pipelineMap);
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

  public final String exportCsv(
      String fqn,
      int upstreamDepth,
      int downstreamDepth,
      String queryFilter,
      boolean deleted,
      String entityType)
      throws IOException {
    CsvDocumentation documentation = getCsvDocumentation("lineage");
    List<CsvHeader> headers = documentation.getHeaders();
    Map<String, Object> lineageMap =
        Entity.getSearchRepository()
            .searchLineageForExport(
                fqn, upstreamDepth, downstreamDepth, queryFilter, deleted, entityType);
    CsvFile csvFile = new CsvFile().withHeaders(headers);

    addRecords(csvFile, lineageMap);
    return CsvUtil.formatCsv(csvFile);
  }

  @Getter
  private static class ColumnMapping {
    String fromChildFQN;
    String toChildFQN;

    ColumnMapping(String from, String to) {
      this.fromChildFQN = from;
      this.toChildFQN = to;
    }
  }

  public final String exportCsvAsync(
      String fqn,
      int upstreamDepth,
      int downstreamDepth,
      String queryFilter,
      String entityType,
      boolean deleted) {
    try {
      Response response =
          Entity.getSearchRepository()
              .searchLineage(fqn, upstreamDepth, downstreamDepth, queryFilter, deleted, entityType);
      String jsonResponse = JsonUtils.pojoToJson(response.getEntity());
      JsonNode rootNode = JsonUtils.readTree(jsonResponse);

      Map<String, JsonNode> entityMap = new HashMap<>();
      JsonNode nodes = rootNode.path("nodes");
      for (JsonNode node : nodes) {
        String id = node.path("id").asText();
        entityMap.put(id, node);
      }

      StringWriter csvContent = new StringWriter();
      CSVWriter csvWriter = new CSVWriter(csvContent);
      String[] headers = {
        "fromEntityFQN",
        "fromServiceName",
        "fromServiceType",
        "fromOwners",
        "fromDomain",
        "toEntityFQN",
        "toServiceName",
        "toServiceType",
        "toOwners",
        "toDomain",
        "fromChildEntityFQN",
        "toChildEntityFQN",
        "pipelineName",
        "pipelineDisplayName",
        "pipelineType",
        "pipelineDescription",
        "pipelineOwners",
        "pipelineDomain",
        "pipelineServiceName",
        "pipelineServiceType"
      };
      csvWriter.writeNext(headers);

      JsonNode edges = rootNode.path("edges");
      for (JsonNode edge : edges) {
        String fromEntityId = edge.path("fromEntity").path("id").asText();
        String toEntityId = edge.path("toEntity").path("id").asText();

        JsonNode fromEntity = entityMap.getOrDefault(fromEntityId, null);
        JsonNode toEntity = entityMap.getOrDefault(toEntityId, null);

        if (fromEntity == null || toEntity == null) {
          LOG.error(
              "Entity not found for IDs: fromEntityId={}, toEntityId={}", fromEntityId, toEntityId);
          continue;
        }

        Map<String, String> baseRow = new HashMap<>();
        baseRow.put("fromEntityFQN", getText(fromEntity, "fullyQualifiedName"));
        baseRow.put("fromServiceName", getText(fromEntity.path("service"), "name"));
        baseRow.put("fromServiceType", getText(fromEntity, "serviceType"));
        baseRow.put("fromOwners", getOwners(fromEntity.path("owners")));
        baseRow.put("fromDomain", getDomainFQN(fromEntity.path("domain")));

        baseRow.put("toEntityFQN", getText(toEntity, "fullyQualifiedName"));
        baseRow.put("toServiceName", getText(toEntity.path("service"), "name"));
        baseRow.put("toServiceType", getText(toEntity, "serviceType"));
        baseRow.put("toOwners", getOwners(toEntity.path("owners")));
        baseRow.put("toDomain", getDomainFQN(toEntity.path("domain")));

        JsonNode columns = edge.path("columns");
        JsonNode pipeline = edge.path("pipeline");

        if (columns.isArray() && columns.size() > 0) {
          // Process column mappings
          List<ColumnMapping> columnMappings = extractColumnMappingsFromEdge(columns);
          for (ColumnMapping mapping : columnMappings) {
            writeCsvRow(
                csvWriter,
                baseRow,
                mapping.getFromChildFQN(),
                mapping.getToChildFQN(),
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                "");
            LOG.debug(
                "Exported ColumnMapping: from='{}', to='{}'",
                mapping.getFromChildFQN(),
                mapping.getToChildFQN());
          }
        } else if (!pipeline.isMissingNode() && !pipeline.isNull()) {
          writePipelineRow(csvWriter, baseRow, pipeline);
        } else {
          writeCsvRow(csvWriter, baseRow, "", "", "", "", "", "", "", "", "", "");
        }
      }
      csvWriter.close();
      return csvContent.toString();
    } catch (IOException e) {
      throw CSVExportException.byMessage("Failed to export lineage data to CSV", e.getMessage());
    }
  }

  private void writePipelineRow(
      CSVWriter csvWriter, Map<String, String> baseRow, JsonNode pipeline) {
    String pipelineName = getText(pipeline, "name");
    String pipelineDisplayName = getText(pipeline, "displayName");
    String pipelineType = getText(pipeline, "serviceType");
    String pipelineDescription = getText(pipeline, "description");
    String pipelineOwners = getOwners(pipeline.path("owners"));
    String pipelineServiceName = getText(pipeline.path("service"), "name");
    String pipelineServiceType = getText(pipeline, "serviceType");
    String pipelineDomain = getDomainFQN(pipeline.path("domain"));

    writeCsvRow(
        csvWriter,
        baseRow,
        "",
        "",
        pipelineName,
        pipelineDisplayName,
        pipelineType,
        pipelineDescription,
        pipelineOwners,
        pipelineDomain,
        pipelineServiceName,
        pipelineServiceType);
    LOG.debug("Exported Pipeline Information: {}", pipelineName);
  }

  private static void writeCsvRow(
      CSVWriter csvWriter,
      Map<String, String> baseRow,
      String fromChildFQN,
      String toChildFQN,
      String pipelineName,
      String pipelineDisplayName,
      String pipelineType,
      String pipelineDescription,
      String pipelineOwners,
      String pipelineDomain,
      String pipelineServiceName,
      String pipelineServiceType) {
    String[] row = {
      baseRow.getOrDefault("fromEntityFQN", ""),
      baseRow.getOrDefault("fromServiceName", ""),
      baseRow.getOrDefault("fromServiceType", ""),
      baseRow.getOrDefault("fromOwners", ""),
      baseRow.getOrDefault("fromDomain", ""),
      baseRow.getOrDefault("toEntityFQN", ""),
      baseRow.getOrDefault("toServiceName", ""),
      baseRow.getOrDefault("toServiceType", ""),
      baseRow.getOrDefault("toOwners", ""),
      baseRow.getOrDefault("toDomain", ""),
      fromChildFQN,
      toChildFQN,
      pipelineName,
      pipelineDisplayName,
      pipelineType,
      pipelineDescription,
      pipelineOwners,
      pipelineDomain,
      pipelineServiceName,
      pipelineServiceType
    };
    csvWriter.writeNext(row);
  }

  private static String getText(JsonNode node, String fieldName) {
    if (node != null && node.has(fieldName)) {
      JsonNode fieldNode = node.get(fieldName);
      return fieldNode.isNull() ? "" : fieldNode.asText();
    }
    return "";
  }

  private static String getOwners(JsonNode ownersNode) {
    if (ownersNode != null && ownersNode.isArray()) {
      List<String> ownersList = new ArrayList<>();
      for (JsonNode owner : ownersNode) {
        String ownerName = getText(owner, "displayName");
        if (!ownerName.isEmpty()) {
          ownersList.add(ownerName);
        }
      }
      return String.join(";", ownersList);
    }
    return "";
  }

  private static String getDomainFQN(JsonNode domainNode) {
    if (domainNode != null && domainNode.has("fullyQualifiedName")) {
      JsonNode fqnNode = domainNode.get("fullyQualifiedName");
      return fqnNode.isNull() ? "" : fqnNode.asText();
    }
    return "";
  }

  private static List<ColumnMapping> extractColumnMappingsFromEdge(JsonNode columnsNode) {
    List<ColumnMapping> mappings = new ArrayList<>();
    if (columnsNode != null && columnsNode.isArray()) {
      for (JsonNode columnMapping : columnsNode) {
        JsonNode fromColumns = columnMapping.path("fromColumns");
        String toColumn = columnMapping.path("toColumn").asText().trim();

        if (fromColumns.isArray() && !toColumn.isEmpty()) {
          for (JsonNode fromColumn : fromColumns) {
            String fromChildFQN = fromColumn.asText().trim();
            if (!fromChildFQN.isEmpty()) {
              mappings.add(new ColumnMapping(fromChildFQN, toColumn));
            }
          }
        }
      }
    }
    return mappings;
  }

  private String getStringOrNull(HashMap map, String key) {
    return nullOrEmpty(map.get(key)) ? "" : map.get(key).toString();
  }

  private String getStringOrNull(HashMap map, String key, String nestedKey) {
    return nullOrEmpty(map.get(key))
        ? ""
        : getStringOrNull((HashMap<String, Object>) map.get(key), nestedKey);
  }

  private String processColumnLineage(HashMap lineageMap) {

    if (lineageMap.get("columns") != null) {
      StringBuilder str = new StringBuilder();
      Collection collection = (Collection<ColumnLineage>) lineageMap.get("columns");
      HashSet<HashMap> hashSet = new HashSet<HashMap>(collection);
      for (HashMap colLineage : hashSet) {
        for (String fromColumn : (List<String>) colLineage.get("fromColumns")) {
          str.append(fromColumn);
          str.append(":");
          str.append(colLineage.get("toColumn"));
          str.append(";");
        }
      }
      // remove the last ;
      return str.substring(0, str.toString().length() - 1);
    }
    return "";
  }

  protected void addRecords(CsvFile csvFile, Map<String, Object> lineageMap) {
    if (lineageMap.get("edges") != null && lineageMap.get("edges") instanceof Collection<?>) {
      Collection collection = (Collection<HashMap>) lineageMap.get("edges");
      HashSet<HashMap> edges = new HashSet<HashMap>(collection);
      List<List<String>> finalRecordList = csvFile.getRecords();
      for (HashMap edge : edges) {
        List<String> recordList = new ArrayList<>();
        addField(recordList, getStringOrNull(edge, "fromEntity", "id"));
        addField(recordList, getStringOrNull(edge, "fromEntity", "type"));
        addField(recordList, getStringOrNull(edge, "fromEntity", "fqn"));
        addField(recordList, getStringOrNull(edge, "toEntity", "id"));
        addField(recordList, getStringOrNull(edge, "toEntity", "type"));
        addField(recordList, getStringOrNull(edge, "toEntity", "fqn"));
        addField(recordList, getStringOrNull(edge, "description"));
        addField(recordList, getStringOrNull(edge, "pipeline", "id"));
        addField(recordList, getStringOrNull(edge, "pipeline", "fullyQualifiedName"));
        addField(recordList, getStringOrNull(edge, "pipeline", "displayName"));
        addField(recordList, processColumnLineage(edge));
        addField(recordList, getStringOrNull(edge, "sqlQuery"));
        addField(recordList, getStringOrNull(edge, "source"));
        finalRecordList.add(recordList);
      }
      csvFile.withRecords(finalRecordList);
    }
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
      case API_ENDPOINT -> {
        APIEndpoint apiEndpoint =
            Entity.getEntity(
                API_ENDPOINT,
                entityReference.getId(),
                "responseSchema,requestSchema",
                Include.NON_DELETED);
        if (apiEndpoint.getResponseSchema() != null) {
          ColumnUtil.validateFieldFQN(apiEndpoint.getResponseSchema().getSchemaFields(), columnFQN);
        } else {
          ColumnUtil.validateFieldFQN(apiEndpoint.getRequestSchema().getSchemaFields(), columnFQN);
        }
      }
      case METRIC -> {
        LOG.info("Metric column level lineage is not supported");
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
  public void deleteLineageBySource(UUID toId, String toEntity, String source) {
    List<CollectionDAO.EntityRelationshipObject> relations;
    if (source.equals(LineageDetails.Source.PIPELINE_LINEAGE.value())) {
      relations =
          dao.relationshipDAO()
              .findLineageBySourcePipeline(toId, toEntity, source, Relationship.UPSTREAM.ordinal());
      // Finally, delete lineage relationship
      dao.relationshipDAO()
          .deleteLineageBySourcePipeline(toId, toEntity, Relationship.UPSTREAM.ordinal());
    } else {
      relations =
          dao.relationshipDAO()
              .findLineageBySource(toId, toEntity, source, Relationship.UPSTREAM.ordinal());
      // Finally, delete lineage relationship
      dao.relationshipDAO()
          .deleteLineageBySource(toId, toEntity, source, Relationship.UPSTREAM.ordinal());
    }
    deleteLineageFromSearch(relations);
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

  private void deleteLineageFromSearch(List<CollectionDAO.EntityRelationshipObject> relations) {
    for (CollectionDAO.EntityRelationshipObject obj : relations) {
      deleteLineageFromSearch(
          new EntityReference().withId(UUID.fromString(obj.getFromId())),
          new EntityReference().withId(UUID.fromString(obj.getToId())));
    }
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

      // Validate Lineage Details
      String detailsJson = validateLineageDetails(from, to, updated);
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
