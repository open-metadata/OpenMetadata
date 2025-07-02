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

import static jakarta.ws.rs.core.Response.Status.OK;
import static org.openmetadata.common.utils.CommonUtil.collectionOrDefault;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrDefault;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.csv.CsvUtil.addField;
import static org.openmetadata.csv.EntityCsv.getCsvDocumentation;
import static org.openmetadata.service.Entity.API_ENDPOINT;
import static org.openmetadata.service.Entity.CONTAINER;
import static org.openmetadata.service.Entity.DASHBOARD;
import static org.openmetadata.service.Entity.DASHBOARD_DATA_MODEL;
import static org.openmetadata.service.Entity.FIELD_DATA_PRODUCTS;
import static org.openmetadata.service.Entity.FIELD_DESCRIPTION;
import static org.openmetadata.service.Entity.FIELD_DISPLAY_NAME;
import static org.openmetadata.service.Entity.FIELD_DOMAIN;
import static org.openmetadata.service.Entity.FIELD_FULLY_QUALIFIED_NAME;
import static org.openmetadata.service.Entity.FIELD_NAME;
import static org.openmetadata.service.Entity.FIELD_OWNERS;
import static org.openmetadata.service.Entity.FIELD_SERVICE;
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
import jakarta.json.JsonPatch;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.io.StringWriter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.ListIterator;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.tuple.ImmutablePair;
import org.apache.commons.lang3.tuple.Pair;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.common.utils.CommonUtil;
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
import org.openmetadata.schema.type.MlFeature;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.csv.CsvDocumentation;
import org.openmetadata.schema.type.csv.CsvFile;
import org.openmetadata.schema.type.csv.CsvHeader;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.exception.CSVExportException;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO.EntityRelationshipRecord;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.util.FullyQualifiedName;
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
    addLineageToSearch(from, to, lineageDetails);

    // build Extended Lineage
    buildExtendedLineage(from, to, lineageDetails, relationAlreadyExists);
  }

  private void buildExtendedLineage(
      EntityReference from,
      EntityReference to,
      LineageDetails lineageDetails,
      boolean childRelationExists) {
    boolean addService =
        Entity.entityHasField(from.getType(), FIELD_SERVICE)
            && Entity.entityHasField(to.getType(), FIELD_SERVICE);
    boolean addDomain =
        Entity.entityHasField(from.getType(), FIELD_DOMAIN)
            && Entity.entityHasField(to.getType(), FIELD_DOMAIN);
    boolean addDataProduct =
        Entity.entityHasField(from.getType(), FIELD_DATA_PRODUCTS)
            && Entity.entityHasField(to.getType(), FIELD_DATA_PRODUCTS);

    String fields = getExtendedLineageFields(addService, addDomain, addDataProduct);
    EntityInterface fromEntity =
        Entity.getEntity(from.getType(), from.getId(), fields, Include.ALL);
    EntityInterface toEntity = Entity.getEntity(to.getType(), to.getId(), fields, Include.ALL);

    addServiceLineage(fromEntity, toEntity, lineageDetails, childRelationExists);
    addDomainLineage(fromEntity, toEntity, lineageDetails, childRelationExists);
    addDataProductsLineage(fromEntity, toEntity, lineageDetails, childRelationExists);
  }

  private void addServiceLineage(
      EntityInterface fromEntity,
      EntityInterface toEntity,
      LineageDetails entityLineageDetails,
      boolean childRelationExists) {
    if (!shouldAddServiceLineage(fromEntity, toEntity)) {
      return;
    }
    // Add Service Level Lineage
    EntityReference fromService = fromEntity.getService();
    EntityReference toService = toEntity.getService();
    if (!fromService.getId().equals(toService.getId())) {
      LineageDetails serviceLineageDetails =
          getOrCreateLineageDetails(
              fromService.getId(), toService.getId(), entityLineageDetails, childRelationExists);
      insertLineage(fromService, toService, serviceLineageDetails);
    }
  }

  private void addDomainLineage(
      EntityInterface fromEntity,
      EntityInterface toEntity,
      LineageDetails entityLineageDetails,
      boolean childRelationExists) {

    if (!shouldAddDomainsLineage(fromEntity, toEntity)) {
      return;
    }

    EntityReference fromDomain = fromEntity.getDomain();
    EntityReference toDomain = toEntity.getDomain();
    if (Boolean.FALSE.equals(fromDomain.getId().equals(toDomain.getId()))) {
      LineageDetails domainLineageDetails =
          getOrCreateLineageDetails(
              fromDomain.getId(), toDomain.getId(), entityLineageDetails, childRelationExists);
      insertLineage(fromDomain, toDomain, domainLineageDetails);
    }
  }

  private void addDataProductsLineage(
      EntityInterface fromEntity,
      EntityInterface toEntity,
      LineageDetails entityLineageDetails,
      boolean childRelationExists) {

    if (!shouldAddDataProductLineage(fromEntity, toEntity)) {
      return;
    }

    for (EntityReference fromEntityRef : fromEntity.getDataProducts()) {
      for (EntityReference toEntityRef : toEntity.getDataProducts()) {
        if (!fromEntityRef.getId().equals(toEntityRef.getId())) {
          LineageDetails dataProductsLineageDetails =
              getOrCreateLineageDetails(
                  fromEntityRef.getId(),
                  toEntityRef.getId(),
                  entityLineageDetails,
                  childRelationExists);

          insertLineage(fromEntityRef, toEntityRef, dataProductsLineageDetails);
        }
      }
    }
  }

  private boolean shouldAddDataProductLineage(
      EntityInterface fromEntity, EntityInterface toEntity) {
    return Entity.entityHasField(fromEntity.getEntityReference().getType(), FIELD_DATA_PRODUCTS)
        && Entity.entityHasField(toEntity.getEntityReference().getType(), FIELD_DATA_PRODUCTS)
        && !nullOrEmpty(fromEntity.getDataProducts())
        && !nullOrEmpty(toEntity.getDataProducts());
  }

  private boolean shouldAddDomainsLineage(EntityInterface fromEntity, EntityInterface toEntity) {
    return Entity.entityHasField(fromEntity.getEntityReference().getType(), FIELD_DOMAIN)
        && Entity.entityHasField(toEntity.getEntityReference().getType(), FIELD_DOMAIN)
        && fromEntity.getDomain() != null
        && toEntity.getDomain() != null;
  }

  private boolean shouldAddServiceLineage(EntityInterface fromEntity, EntityInterface toEntity) {
    return Entity.entityHasField(fromEntity.getEntityReference().getType(), FIELD_SERVICE)
        && Entity.entityHasField(toEntity.getEntityReference().getType(), FIELD_SERVICE)
        && fromEntity.getService() != null
        && toEntity.getService() != null;
  }

  private LineageDetails getOrCreateLineageDetails(
      UUID fromId, UUID toId, LineageDetails entityLineageDetails, boolean childRelationExists) {

    CollectionDAO.EntityRelationshipObject existingRelation =
        dao.relationshipDAO().getRecord(fromId, toId, Relationship.UPSTREAM.ordinal());

    if (existingRelation != null) {
      LineageDetails lineageDetails =
          JsonUtils.readValue(existingRelation.getJson(), LineageDetails.class)
              .withPipeline(entityLineageDetails.getPipeline());
      if (!childRelationExists) {
        lineageDetails.withAssetEdges(lineageDetails.getAssetEdges() + 1);
      }
      return lineageDetails;
    }

    return new LineageDetails()
        .withCreatedAt(entityLineageDetails.getCreatedAt())
        .withCreatedBy(entityLineageDetails.getCreatedBy())
        .withUpdatedAt(entityLineageDetails.getUpdatedAt())
        .withUpdatedBy(entityLineageDetails.getUpdatedBy())
        .withSource(LineageDetails.Source.CHILD_ASSETS)
        .withPipeline(entityLineageDetails.getPipeline())
        .withAssetEdges(1);
  }

  private void insertLineage(
      EntityReference from, EntityReference to, LineageDetails lineageDetails) {
    dao.relationshipDAO()
        .insert(
            from.getId(),
            to.getId(),
            from.getType(),
            to.getType(),
            Relationship.UPSTREAM.ordinal(),
            JsonUtils.pojoToJson(lineageDetails));
    addLineageToSearch(from, to, lineageDetails);
  }

  private String getExtendedLineageFields(boolean service, boolean domain, boolean dataProducts) {
    StringBuilder fieldsBuilder = new StringBuilder();

    if (service) {
      fieldsBuilder.append(FIELD_SERVICE);
      fieldsBuilder.append(",");
    }
    if (domain) {
      fieldsBuilder.append(FIELD_DOMAIN);
      fieldsBuilder.append(",");
    }
    if (dataProducts) {
      fieldsBuilder.append(FIELD_DATA_PRODUCTS);
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
            .withDocId(getDocumentIdWithFqn(fromEntity, toEntity, lineageDetails))
            .withDocUniqueId(getDocumentUniqueId(fromEntity, toEntity))
            .withFromEntity(buildEntityRefLineage(fromEntity));
    if (lineageDetails != null) {
      // Add Pipeline Details
      addPipelineDetails(lineageData, lineageDetails.getPipeline());
      lineageData.setDescription(nullOrDefault(lineageDetails.getDescription(), null));
      lineageData.setColumns(collectionOrDefault(lineageDetails.getColumnsLineage(), null));
      lineageData.setSqlQuery(nullOrDefault(lineageDetails.getSqlQuery(), null));
      lineageData.setSource(nullOrDefault(lineageDetails.getSource().value(), null));
      lineageData.setCreatedAt(nullOrDefault(lineageDetails.getCreatedAt(), null));
      lineageData.setCreatedBy(nullOrDefault(lineageDetails.getCreatedBy(), null));
      lineageData.setUpdatedAt(nullOrDefault(lineageDetails.getUpdatedAt(), null));
      lineageData.setUpdatedBy(nullOrDefault(lineageDetails.getUpdatedBy(), null));
      lineageData.setAssetEdges(nullOrDefault(lineageDetails.getAssetEdges(), null));
    }
    return lineageData;
  }

  private static String getDocumentIdWithFqn(
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

  public static String getDocumentUniqueId(EntityReference fromEntity, EntityReference toEntity) {
    return String.format("%s--->%s", fromEntity.getId().toString(), toEntity.getId().toString());
  }

  public static void addPipelineDetails(EsLineageData lineageData, EntityReference pipelineRef) {
    if (nullOrEmpty(pipelineRef)) {
      lineageData.setPipeline(null);
    } else {
      Pair<String, Map<String, Object>> pipelineOrStoredProcedure =
          getPipelineOrStoredProcedure(
              pipelineRef, List.of("changeDescription", "incrementalChangeDescription"));
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
    Set<String> fromColumns = getChildrenNames(from);
    Set<String> toColumns = getChildrenNames(to);

    if (columnsLineage != null && !columnsLineage.isEmpty()) {
      for (ColumnLineage columnLineage : columnsLineage) {
        for (String fromColumn : columnLineage.getFromColumns()) {
          if (!fromColumns.contains(fromColumn.replace(from.getFullyQualifiedName() + ".", ""))) {
            throw new IllegalArgumentException(
                CatalogExceptionMessage.invalidFieldName("column", fromColumn));
          }
        }
        if (!toColumns.contains(
            columnLineage.getToColumn().replace(to.getFullyQualifiedName() + ".", ""))) {
          throw new IllegalArgumentException(
              CatalogExceptionMessage.invalidFieldName("column", columnLineage.getToColumn()));
        }
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
    CsvDocumentation documentation = getCsvDocumentation("lineage", false);
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

      if (fromEntity == null || toEntity == null) {
        LOG.error(
            "Entity not found for IDs: fromEntityId={}, toEntityId={}", fromEntityId, toEntityId);
        return;
      }

      Map<String, String> baseRow = new HashMap<>();
      baseRow.put("fromEntityFQN", getText(fromEntity, FIELD_FULLY_QUALIFIED_NAME));
      baseRow.put("fromServiceName", getText(fromEntity.path(FIELD_SERVICE), FIELD_NAME));
      baseRow.put("fromServiceType", getText(fromEntity, "serviceType"));
      baseRow.put("fromOwners", getOwners(fromEntity.path(FIELD_OWNERS)));
      baseRow.put("fromDomain", getDomainFQN(fromEntity.path(FIELD_DOMAIN)));

      baseRow.put("toEntityFQN", getText(toEntity, FIELD_FULLY_QUALIFIED_NAME));
      baseRow.put("toServiceName", getText(toEntity.path(FIELD_SERVICE), FIELD_NAME));
      baseRow.put("toServiceType", getText(toEntity, "serviceType"));
      baseRow.put("toOwners", getOwners(toEntity.path(FIELD_OWNERS)));
      baseRow.put("toDomain", getDomainFQN(toEntity.path(FIELD_DOMAIN)));

      JsonNode columns = edge.path("columns");
      JsonNode pipeline = edge.path("pipeline");

      if (columns.isArray() && !columns.isEmpty()) {
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
    String pipelineName = getText(pipeline, FIELD_NAME);
    String pipelineDisplayName = getText(pipeline, FIELD_DISPLAY_NAME);
    String pipelineType = getText(pipeline, "serviceType");
    String pipelineDescription = getText(pipeline, FIELD_DESCRIPTION);
    String pipelineOwners = getOwners(pipeline.path(FIELD_OWNERS));
    String pipelineServiceName = getText(pipeline.path(FIELD_SERVICE), FIELD_NAME);
    String pipelineServiceType = getText(pipeline, "serviceType");
    String pipelineDomain = getDomainFQN(pipeline.path(FIELD_DOMAIN));

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

  private Set<String> getChildrenNames(EntityReference entityReference) {
    switch (entityReference.getType()) {
      case TABLE -> {
        Table table =
            Entity.getEntity(TABLE, entityReference.getId(), "columns", Include.NON_DELETED);
        return CommonUtil.getChildrenNames(
            table.getColumns(), "getChildren", table.getFullyQualifiedName());
      }
      case SEARCH_INDEX -> {
        SearchIndex searchIndex =
            Entity.getEntity(SEARCH_INDEX, entityReference.getId(), "fields", Include.NON_DELETED);
        return CommonUtil.getChildrenNames(
            searchIndex.getFields(), "getChildren", searchIndex.getFullyQualifiedName());
      }
      case TOPIC -> {
        Topic topic =
            Entity.getEntity(TOPIC, entityReference.getId(), "messageSchema", Include.NON_DELETED);
        if (topic.getMessageSchema() == null
            || topic.getMessageSchema().getSchemaFields() == null) {
          return new HashSet<>();
        }
        return CommonUtil.getChildrenNames(
            topic.getMessageSchema().getSchemaFields(),
            "getChildren",
            topic.getFullyQualifiedName());
      }
      case CONTAINER -> {
        Container container =
            Entity.getEntity(CONTAINER, entityReference.getId(), "dataModel", Include.NON_DELETED);
        if (container.getDataModel() == null || container.getDataModel().getColumns() == null) {
          return new HashSet<>();
        }
        return CommonUtil.getChildrenNames(
            container.getDataModel().getColumns(),
            "getChildren",
            container.getFullyQualifiedName());
      }
      case DASHBOARD_DATA_MODEL -> {
        DashboardDataModel dashboardDataModel =
            Entity.getEntity(
                DASHBOARD_DATA_MODEL, entityReference.getId(), "columns", Include.NON_DELETED);
        return CommonUtil.getChildrenNames(
            dashboardDataModel.getColumns(),
            "getChildren",
            dashboardDataModel.getFullyQualifiedName());
      }
      case DASHBOARD -> {
        Dashboard dashboard =
            Entity.getEntity(DASHBOARD, entityReference.getId(), "charts", Include.NON_DELETED);
        Set<String> result = new HashSet<>();
        for (EntityReference chart : listOrEmpty(dashboard.getCharts())) {
          result.add(
              chart.getFullyQualifiedName().replace(dashboard.getFullyQualifiedName() + ".", ""));
        }
        return result;
      }
      case MLMODEL -> {
        MlModel mlModel =
            Entity.getEntity(MLMODEL, entityReference.getId(), "", Include.NON_DELETED);
        Set<String> result = new HashSet<>();
        for (MlFeature feature : listOrEmpty(mlModel.getMlFeatures())) {
          result.add(
              feature.getFullyQualifiedName().replace(mlModel.getFullyQualifiedName() + ".", ""));
        }
        return result;
      }
      case API_ENDPOINT -> {
        APIEndpoint apiEndpoint =
            Entity.getEntity(
                API_ENDPOINT,
                entityReference.getId(),
                "responseSchema,requestSchema",
                Include.NON_DELETED);
        if (apiEndpoint.getResponseSchema() != null) {
          return CommonUtil.getChildrenNames(
              apiEndpoint.getResponseSchema().getSchemaFields(),
              "getChildren",
              apiEndpoint.getFullyQualifiedName());
        }
        return CommonUtil.getChildrenNames(
            apiEndpoint.getRequestSchema().getSchemaFields(),
            "getChildren",
            apiEndpoint.getFullyQualifiedName());
      }
      case METRIC -> {
        LOG.info("Metric column level lineage is not supported");
        return new HashSet<>();
      }
      case PIPELINE -> {
        LOG.info("Pipeline column level lineage is not supported");
        return new HashSet<>();
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
      if (result) {
        cleanUpExtendedLineage(from, to);
      }
      return result;
    }
    return false;
  }

  private void cleanUpExtendedLineage(EntityReference from, EntityReference to) {
    boolean addService = hasField(from, FIELD_SERVICE) && hasField(to, FIELD_SERVICE);
    boolean addDomain = hasField(from, FIELD_DOMAIN) && hasField(to, FIELD_DOMAIN);
    boolean addDataProduct =
        hasField(from, FIELD_DATA_PRODUCTS) && hasField(to, FIELD_DATA_PRODUCTS);

    String fields = getExtendedLineageFields(addService, addDomain, addDataProduct);
    EntityInterface fromEntity =
        Entity.getEntity(from.getType(), from.getId(), fields, Include.ALL);
    EntityInterface toEntity = Entity.getEntity(to.getType(), to.getId(), fields, Include.ALL);

    cleanUpLineage(fromEntity, toEntity, FIELD_SERVICE, EntityInterface::getService);
    cleanUpLineage(fromEntity, toEntity, FIELD_DOMAIN, EntityInterface::getDomain);
    cleanUpLineageForDataProducts(
        fromEntity, toEntity, FIELD_DATA_PRODUCTS, EntityInterface::getDataProducts);
  }

  private boolean hasField(EntityReference entity, String field) {
    return Entity.entityHasField(entity.getType(), field);
  }

  private void cleanUpLineage(
      EntityInterface fromEntity,
      EntityInterface toEntity,
      String field,
      Function<EntityInterface, EntityReference> getter) {
    boolean hasField =
        hasField(fromEntity.getEntityReference(), field)
            && hasField(toEntity.getEntityReference(), field);
    if (!hasField) return;

    EntityReference fromRef = getter.apply(fromEntity);
    EntityReference toRef = getter.apply(toEntity);
    processExtendedLineageCleanup(fromRef, toRef);
  }

  private void cleanUpLineageForDataProducts(
      EntityInterface fromEntity,
      EntityInterface toEntity,
      String field,
      Function<EntityInterface, List<EntityReference>> getter) {
    boolean hasField =
        hasField(fromEntity.getEntityReference(), field)
            && hasField(toEntity.getEntityReference(), field);
    if (!hasField) return;

    for (EntityReference fromRef : getter.apply(fromEntity)) {
      for (EntityReference toRef : getter.apply(toEntity)) {
        processExtendedLineageCleanup(fromRef, toRef);
      }
    }
  }

  private void processExtendedLineageCleanup(EntityReference fromRef, EntityReference toRef) {
    if (fromRef == null || toRef == null) return;

    CollectionDAO.EntityRelationshipObject relation =
        dao.relationshipDAO()
            .getRecord(fromRef.getId(), toRef.getId(), Relationship.UPSTREAM.ordinal());

    if (relation == null) return;

    LineageDetails lineageDetails = JsonUtils.readValue(relation.getJson(), LineageDetails.class);
    if (lineageDetails.getAssetEdges() - 1 < 1) {
      dao.relationshipDAO()
          .delete(
              fromRef.getId(),
              fromRef.getType(),
              toRef.getId(),
              toRef.getType(),
              Relationship.UPSTREAM.ordinal());
      deleteLineageFromSearch(fromRef, toRef, lineageDetails);
    } else {
      lineageDetails.withAssetEdges(lineageDetails.getAssetEdges() - 1);
      dao.relationshipDAO()
          .insert(
              fromRef.getId(),
              toRef.getId(),
              fromRef.getType(),
              toRef.getType(),
              Relationship.UPSTREAM.ordinal(),
              JsonUtils.pojoToJson(lineageDetails));
      addLineageToSearch(fromRef, toRef, lineageDetails);
    }
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
    String uniqueValue = getDocumentUniqueId(fromEntity, toEntity);
    searchClient.updateChildren(
        GLOBAL_SEARCH_ALIAS,
        new ImmutablePair<>("upstreamLineage.docUniqueId.keyword", uniqueValue),
        new ImmutablePair<>(String.format(REMOVE_LINEAGE_SCRIPT, uniqueValue), null));
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

  /**
   * Propagate column renames and deletions to every UPSTREAM lineage record that involves the
   * supplied table (either as upstream or downstream entity).
   *
   * @param tableId the UUID of the table whose columns changed
   * @param renamed map of original&nbsp;FQN ➜ new&nbsp;FQN
   * @param deleted list of column FQNs that were removed entirely
   */
  @Transaction
  public void updateColumnLineage(UUID tableId, Map<String, String> renamed, List<String> deleted) {

    // Short-circuit when there is no work to perform
    if ((renamed == null || renamed.isEmpty()) && (deleted == null || deleted.isEmpty())) {
      return;
    }

    /*
     * Prepare fast-lookup structures
     */
    final Map<String, String> fqnRenameMap = Optional.ofNullable(renamed).orElse(Map.of());
    final Set<String> deletedFqns = new HashSet<>(Optional.ofNullable(deleted).orElse(List.of()));

    /*
     * Collect every UPSTREAM lineage row where this table appears on EITHER side of the edge.
     */
    List<CollectionDAO.EntityRelationshipObject> lineageRows = new ArrayList<>();
    List<String> tableIdList = List.of(tableId.toString());

    // Table is the *upstream* side (fromId)
    lineageRows.addAll(
        dao.relationshipDAO().findFromBatch(tableIdList, Relationship.UPSTREAM.ordinal()));

    // Table is the *downstream* side (toId)
    lineageRows.addAll(
        dao.relationshipDAO()
            .findToBatch(tableIdList, Relationship.UPSTREAM.ordinal(), Entity.TABLE, Entity.TABLE));

    /*
     * Iterate and rewrite JSON payloads in-place
     */
    for (CollectionDAO.EntityRelationshipObject row : lineageRows) {
      try {
        LineageDetails details = JsonUtils.readValue(row.getJson(), LineageDetails.class);

        boolean rowModified = rewriteColumnMappings(details, fqnRenameMap, deletedFqns);

        if (rowModified) {
          // UPSERT the updated lineage JSON back into the relationship table
          dao.relationshipDAO()
              .insert(
                  UUID.fromString(row.getFromId()),
                  UUID.fromString(row.getToId()),
                  row.getFromEntity(),
                  row.getToEntity(),
                  row.getRelation(),
                  JsonUtils.pojoToJson(details));
        }
      } catch (Exception ex) {
        LOG.warn(
            "Failed to update column lineage for relationship {} -> {}. Skipping this row.",
            row.getFromId(),
            row.getToId(),
            ex);
      }
    }
  }

  /**
   * Apply rename / delete rules to the <code>columnsLineage</code> section of the supplied
   * {@link LineageDetails} object.
   *
   * @return true if the object was actually changed.
   */
  private boolean rewriteColumnMappings(
      LineageDetails details, Map<String, String> renameMap, Set<String> deletedFqns) {
    if (details.getColumnsLineage() == null) {
      return false;
    }

    boolean modified = false;

    for (Iterator<ColumnLineage> mappingIter = details.getColumnsLineage().iterator();
        mappingIter.hasNext(); ) {
      ColumnLineage mapping = mappingIter.next();

      /* --- Downstream column (toColumn) ----------------------------------- */
      if (mapping.getToColumn() != null) {
        String renamed = renameMap.get(mapping.getToColumn());
        if (renamed != null) {
          mapping.setToColumn(renamed);
          modified = true;
        } else if (deletedFqns.contains(mapping.getToColumn())) {
          // Entire mapping is invalid – downstream target vanished
          mappingIter.remove();
          modified = true;
          continue; // No need to touch upstream side now
        }
      }

      /* --- Upstream columns (fromColumns[]) -------------------------------- */
      if (mapping.getFromColumns() != null) {
        ListIterator<String> fromIter = mapping.getFromColumns().listIterator();
        while (fromIter.hasNext()) {
          String upstream = fromIter.next();

          if (deletedFqns.contains(upstream)) {
            fromIter.remove();
            modified = true;
          } else {
            String renamed = renameMap.get(upstream);
            if (renamed != null) {
              fromIter.set(renamed);
              modified = true;
            }
          }
        }
        // If nothing left on upstream side, drop the whole mapping
        if (mapping.getFromColumns().isEmpty()) {
          mappingIter.remove();
        }
      }
    }

    return modified;
  }
}
