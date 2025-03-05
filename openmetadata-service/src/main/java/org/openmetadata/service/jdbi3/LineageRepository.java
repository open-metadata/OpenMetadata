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
import static org.openmetadata.common.utils.CommonUtil.collectionOrDefault;
import static org.openmetadata.common.utils.CommonUtil.nullOrDefault;
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
import static org.openmetadata.service.search.SearchUtils.isConnectedVia;

import com.fasterxml.jackson.databind.JsonNode;
import com.opencsv.CSVWriter;
import java.io.IOException;
import java.io.StringWriter;
import java.util.ArrayList;
import java.util.HashMap;
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
import org.openmetadata.csv.CsvUtil;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.lineage.AddLineage;
import org.openmetadata.schema.api.lineage.EsLineageData;
import org.openmetadata.schema.api.lineage.LineageDirection;
import org.openmetadata.schema.api.lineage.RelationshipRef;
import org.openmetadata.schema.api.lineage.SearchLineageRequest;
import org.openmetadata.schema.api.lineage.SearchLineageResult;
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
  public void addLineage(AddLineage addLineage, String updatedBy) {
    // Validate from entity
    LineageDetails lineageDetails =
        addLineage.getEdge().getLineageDetails() != null
            ? addLineage.getEdge().getLineageDetails()
            : new LineageDetails();
    EntityReference from = addLineage.getEdge().getFromEntity();
    from = Entity.getEntityReferenceById(from.getType(), from.getId(), Include.NON_DELETED);

    // Validate to entity
    EntityReference to = addLineage.getEdge().getToEntity();
    to = Entity.getEntityReferenceById(to.getType(), to.getId(), Include.NON_DELETED);

    boolean relationAlreadyExists =
        Boolean.FALSE.equals(
            nullOrEmpty(
                dao.relationshipDAO()
                    .getRecord(from.getId(), to.getId(), Relationship.UPSTREAM.ordinal())));

    if (lineageDetails.getPipeline() != null) {
      // Validate pipeline entity
      EntityReference pipeline = lineageDetails.getPipeline();
      pipeline =
          Entity.getEntityReferenceById(pipeline.getType(), pipeline.getId(), Include.NON_DELETED);

      // Add pipeline entity details to lineage details
      lineageDetails.withPipeline(pipeline);
    }

    // Update the lineage details with user and time
    long currentTime = System.currentTimeMillis();
    lineageDetails.setCreatedAt(currentTime);
    lineageDetails.setCreatedBy(updatedBy);
    lineageDetails.setUpdatedAt(System.currentTimeMillis());
    lineageDetails.setUpdatedBy(updatedBy);

    // Validate lineage details
    String detailsJson = validateLineageDetails(from, to, lineageDetails);

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

    // build Extended Lineage
    buildExtendedLineage(from, to, lineageDetails, relationAlreadyExists);
  }

  private void buildExtendedLineage(
      EntityReference from,
      EntityReference to,
      LineageDetails lineageDetails,
      boolean childRelationExists) {
    boolean addService =
        Entity.entityHasField(from, "service") && Entity.entityHasField(to, "service");
    boolean addDomain =
        Entity.entityHasField(from, "domain") && Entity.entityHasField(to, "domain");
    boolean addDataProduct =
        Entity.entityHasField(from, "dataProducts") && Entity.entityHasField(to, "dataProducts");

    String fields = getExtendedLineageFields(addService, addDomain, addDataProduct);
    EntityInterface fromEntity =
        Entity.getEntity(from.getType(), from.getId(), fields, Include.ALL);
    EntityInterface toEntity = Entity.getEntity(to.getType(), to.getId(), fields, Include.ALL);
    LineageDetails updatedLineageTimestamps =
        new LineageDetails()
            .withCreatedAt(lineageDetails.getCreatedAt())
            .withCreatedBy(lineageDetails.getCreatedBy())
            .withUpdatedAt(lineageDetails.getUpdatedAt())
            .withUpdatedBy(lineageDetails.getUpdatedBy());

    // Add Service Level Lineage
    if (addService && fromEntity.getService() != null && toEntity.getService() != null) {
      EntityReference fromService = fromEntity.getService();
      EntityReference toService = toEntity.getService();
      if (Boolean.FALSE.equals(fromService.getId().equals(toService.getId()))) {
        dao.relationshipDAO()
            .insert(
                fromService.getId(),
                toService.getId(),
                fromService.getType(),
                toService.getType(),
                Relationship.UPSTREAM.ordinal(),
                JsonUtils.pojoToJson(updatedLineageTimestamps));
        addLineageToSearch(from, to, updatedLineageTimestamps);
      }
    }

    // Add Domain Level Lineage
    if (addDomain && fromEntity.getDomain() != null && toEntity.getDomain() != null) {
      EntityReference fromDomain = fromEntity.getDomain();
      EntityReference toDomain = toEntity.getDomain();
      if (Boolean.FALSE.equals(fromDomain.getId().equals(toDomain.getId()))) {
        dao.relationshipDAO()
            .insert(
                fromDomain.getId(),
                toDomain.getId(),
                fromDomain.getType(),
                toDomain.getType(),
                Relationship.UPSTREAM.ordinal(),
                JsonUtils.pojoToJson(updatedLineageTimestamps));
        addLineageToSearch(from, to, updatedLineageTimestamps);
      }
    }
  }

  private String getExtendedLineageFields(boolean service, boolean domain, boolean dataProducts) {
    StringBuilder fieldsBuilder = new StringBuilder();

    if (service) {
      fieldsBuilder.append("service");
      fieldsBuilder.append(",");
    }
    if (domain) {
      fieldsBuilder.append("domain");
      fieldsBuilder.append(",");
    }
    if (dataProducts) {
      fieldsBuilder.append("dataProducts");
    }
    return fieldsBuilder.toString();
  }

  private void addLineageToSearch(
      EntityReference fromEntity, EntityReference toEntity, LineageDetails lineageDetails) {
    IndexMapping destinationIndexMapping =
        Entity.getSearchRepository().getIndexMapping(toEntity.getType());
    String destinationIndexName =
        destinationIndexMapping.getIndexName(Entity.getSearchRepository().getClusterAlias());
    // For lineage from -> to (not stored) since the doc itself is the toEntity
    EsLineageData lineageData =
        buildEntityLineageData(fromEntity, toEntity, lineageDetails).withToEntity(null);
    Pair<String, String> to = new ImmutablePair<>("_id", toEntity.getId().toString());
    searchClient.updateLineage(destinationIndexName, to, lineageData);
  }

  public static RelationshipRef buildEntityRefLineage(EntityReference entityRef) {
    return new RelationshipRef()
        .withId(entityRef.getId())
        .withType(entityRef.getType())
        .withFullyQualifiedName(entityRef.getFullyQualifiedName())
        .withFqnHash(FullyQualifiedName.buildHash(entityRef.getFullyQualifiedName()));
  }

  public static EsLineageData buildEntityLineageData(
      EntityReference fromEntity, EntityReference toEntity, LineageDetails lineageDetails) {
    EsLineageData lineageData =
        new EsLineageData()
            .withDocId(getDocumentId(fromEntity, toEntity, lineageDetails))
            .withFromEntity(buildEntityRefLineage(fromEntity));
    if (lineageDetails != null) {
      // Add Pipeline Details
      addPipelineDetails(lineageData, lineageDetails.getPipeline());
      lineageData.setDescription(nullOrDefault(lineageDetails.getDescription(), null));
      lineageData.setColumns(collectionOrDefault(lineageDetails.getColumnsLineage(), null));
      lineageData.setSqlQuery(nullOrDefault(lineageDetails.getSqlQuery(), null));
      lineageData.setSource(nullOrDefault(lineageDetails.getSource().value(), null));
    }
    return lineageData;
  }

  private static String getDocumentId(
      EntityReference fromEntity, EntityReference toEntity, LineageDetails lineageDetails) {
    if (lineageDetails != null && !nullOrEmpty(lineageDetails.getPipeline())) {
      EntityReference ref = lineageDetails.getPipeline();
      return String.format(
          "%s--->%s:%s--->%s",
          fromEntity.getFullyQualifiedName(),
          ref.getType(),
          ref.getId(),
          toEntity.getFullyQualifiedName());
    } else {
      return String.format(
          "%s--->%s", fromEntity.getFullyQualifiedName(), toEntity.getFullyQualifiedName());
    }
  }

  public static void addPipelineDetails(EsLineageData lineageData, EntityReference pipelineRef) {
    if (nullOrEmpty(pipelineRef)) {
      lineageData.setPipeline(null);
    } else {
      Pair<String, Map<String, Object>> pipelineOrStoredProcedure =
          getPipelineOrStoredProcedure(pipelineRef, List.of("changeDescription"));
      lineageData.setPipelineEntityType(pipelineOrStoredProcedure.getLeft());
      lineageData.setPipeline(pipelineOrStoredProcedure.getRight());
    }
  }

  public static Pair<String, Map<String, Object>> getPipelineOrStoredProcedure(
      EntityReference pipelineRef, List<String> fieldsToRemove) {
    Map<String, Object> pipelineMap;
    if (pipelineRef.getType().equals(PIPELINE)) {
      pipelineMap =
          JsonUtils.getMap(
              Entity.getEntity(pipelineRef, "pipelineStatus,tags,owners", Include.ALL));
    } else {
      pipelineMap = JsonUtils.getMap(Entity.getEntity(pipelineRef, "tags,owners", Include.ALL));
    }

    // Remove fields
    fieldsToRemove.forEach(pipelineMap::remove);

    // Add fqnHash
    pipelineMap.put(
        "fqnHash",
        FullyQualifiedName.buildHash((String) pipelineMap.get(Entity.FIELD_FULLY_QUALIFIED_NAME)));
    return Pair.of(pipelineRef.getType(), pipelineMap);
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
    SearchLineageResult result =
        Entity.getSearchRepository()
            .searchLineageForExport(
                fqn, upstreamDepth, downstreamDepth, queryFilter, deleted, entityType);
    CsvFile csvFile = new CsvFile().withHeaders(headers);

    addRecords(csvFile, result.getUpstreamEdges().values().stream().toList());
    addRecords(csvFile, result.getDownstreamEdges().values().stream().toList());
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
      SearchLineageResult response =
          Entity.getSearchRepository()
              .searchLineage(
                  new SearchLineageRequest()
                      .withFqn(fqn)
                      .withUpstreamDepth(upstreamDepth)
                      .withDownstreamDepth(downstreamDepth)
                      .withQueryFilter(queryFilter)
                      .withIncludeDeleted(deleted)
                      .withIsConnectedVia(isConnectedVia(entityType))
                      .withDirection(LineageDirection.UPSTREAM));
      String jsonResponse = JsonUtils.pojoToJson(response);
      JsonNode rootNode = JsonUtils.readTree(jsonResponse);

      Map<String, JsonNode> entityMap = new HashMap<>();
      JsonNode nodes = rootNode.path("nodes");
      for (JsonNode node : nodes) {
        JsonNode entityNode = node.path("entity");
        String id = entityNode.path("id").asText();
        entityMap.put(id, entityNode);
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

      JsonNode upstreamEdges = rootNode.path("upstreamEdges");
      writeEdge(csvWriter, entityMap, upstreamEdges);
      JsonNode downstreamEdges = rootNode.path("downstreamEdges");
      writeEdge(csvWriter, entityMap, downstreamEdges);
      csvWriter.close();
      return csvContent.toString();
    } catch (IOException e) {
      throw CSVExportException.byMessage("Failed to export lineage data to CSV", e.getMessage());
    }
  }

  private void writeEdge(CSVWriter csvWriter, Map<String, JsonNode> entityMap, JsonNode edges) {
    for (JsonNode edge : edges) {
      String fromEntityId = edge.path("fromEntity").path("id").asText();
      String toEntityId = edge.path("toEntity").path("id").asText();

      JsonNode fromEntity = entityMap.getOrDefault(fromEntityId, null);
      JsonNode toEntity = entityMap.getOrDefault(toEntityId, null);

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

  private String getStringOrNull(Map<String, Object> map, String key) {
    return nullOrEmpty(map.get(key)) ? "" : map.get(key).toString();
  }

  private String getStringOrNull(Map<String, Object> map, String key, String nestedKey) {
    return nullOrEmpty(map.get(key))
        ? ""
        : getStringOrNull((Map<String, Object>) map.get(key), nestedKey);
  }

  private String getStringOrNull(String value) {
    return nullOrEmpty(value) ? "" : value;
  }

  private String processColumnLineage(List<ColumnLineage> columns) {
    if (nullOrEmpty(columns)) {
      return "";
    }

    StringBuilder str = new StringBuilder();
    for (ColumnLineage colLineage : columns) {
      for (String fromColumn : colLineage.getFromColumns()) {
        str.append(fromColumn);
        str.append(":");
        str.append(colLineage.getToColumn());
        str.append(";");
      }
    }
    return str.substring(0, str.toString().length() - 1);
  }

  protected void addRecords(CsvFile csvFile, List<EsLineageData> edges) {
    List<List<String>> finalRecordList = csvFile.getRecords();
    for (EsLineageData data : edges) {
      List<String> recordList = new ArrayList<>();
      Map<String, Object> pipeline =
          nullOrEmpty(data.getPipeline()) ? new HashMap<>() : JsonUtils.getMap(data.getPipeline());
      addField(recordList, getStringOrNull(data.getFromEntity().getId().toString()));
      addField(recordList, getStringOrNull(data.getFromEntity().getType()));
      addField(recordList, getStringOrNull(data.getFromEntity().getFullyQualifiedName()));
      addField(recordList, getStringOrNull(data.getToEntity().getId().toString()));
      addField(recordList, getStringOrNull(data.getToEntity().getType()));
      addField(recordList, getStringOrNull(data.getToEntity().getFullyQualifiedName()));
      addField(recordList, getStringOrNull(data.getDescription()));
      addField(recordList, getStringOrNull(pipeline, "pipeline", "id"));
      addField(recordList, getStringOrNull(pipeline, "pipeline", "fullyQualifiedName"));
      addField(recordList, getStringOrNull(pipeline, "pipeline", "displayName"));
      addField(recordList, processColumnLineage(data.getColumns()));
      addField(recordList, getStringOrNull(data.getSqlQuery()));
      addField(recordList, getStringOrNull(data.getSource()));
      finalRecordList.add(recordList);
    }
    csvFile.withRecords(finalRecordList);
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
                API_ENDPOINT, entityReference.getId(), "responseSchema", Include.NON_DELETED);
        ColumnUtil.validateFieldFQN(apiEndpoint.getResponseSchema().getSchemaFields(), columnFQN);
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
    EntityReference from = Entity.getEntityReferenceByName(fromEntity, fromFQN, Include.ALL);
    EntityReference to = Entity.getEntityReferenceByName(toEntity, toFQN, Include.ALL);
    CollectionDAO.EntityRelationshipObject relationshipObject =
        dao.relationshipDAO().getRecord(from.getId(), to.getId(), Relationship.UPSTREAM.ordinal());
    // Finally, delete lineage relationship
    if (!nullOrEmpty(relationshipObject)) {
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
      LineageDetails lineageDetails =
          JsonUtils.readValue(relationshipObject.getJson(), LineageDetails.class);
      deleteLineageFromSearch(from, to, lineageDetails);
      return result;
    }
    return false;
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
        Entity.getEntityReferenceById(fromEntity, UUID.fromString(fromId), Include.ALL);

    // Validate to entity
    EntityReference to =
        Entity.getEntityReferenceById(toEntity, UUID.fromString(toId), Include.ALL);

    CollectionDAO.EntityRelationshipObject relationshipObject =
        dao.relationshipDAO().getRecord(from.getId(), to.getId(), Relationship.UPSTREAM.ordinal());

    if (!nullOrEmpty(relationshipObject)) {
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
      LineageDetails lineageDetails =
          JsonUtils.readValue(relationshipObject.getJson(), LineageDetails.class);
      deleteLineageFromSearch(from, to, lineageDetails);
      return result;
    }
    return false;
  }

  private void deleteLineageFromSearch(List<CollectionDAO.EntityRelationshipObject> relations) {
    for (CollectionDAO.EntityRelationshipObject obj : relations) {
      LineageDetails lineageDetails = JsonUtils.readValue(obj.getJson(), LineageDetails.class);
      deleteLineageFromSearch(
          new EntityReference().withId(UUID.fromString(obj.getFromId())),
          new EntityReference().withId(UUID.fromString(obj.getToId())),
          lineageDetails);
    }
  }

  private void deleteLineageFromSearch(
      EntityReference fromEntity, EntityReference toEntity, LineageDetails lineageDetails) {
    searchClient.updateChildren(
        GLOBAL_SEARCH_ALIAS,
        new ImmutablePair<>(
            "upstreamLineage.doc_id.keyword", getDocumentId(fromEntity, toEntity, lineageDetails)),
        new ImmutablePair<>(
            String.format(
                REMOVE_LINEAGE_SCRIPT, getDocumentId(fromEntity, toEntity, lineageDetails)),
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
      String fromEntity,
      UUID fromId,
      String toEntity,
      UUID toId,
      JsonPatch patch,
      String updatedBy) {
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

      // Update the lineage details with user and time
      updated.setUpdatedAt(System.currentTimeMillis());
      updated.setUpdatedBy(updatedBy);

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
