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

package org.openmetadata.service.openlineage;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.Include.NON_DELETED;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.lineage.openlineage.DatasetFacets;
import org.openmetadata.schema.api.lineage.openlineage.DatasourceFacet;
import org.openmetadata.schema.api.lineage.openlineage.DocumentationFacet;
import org.openmetadata.schema.api.lineage.openlineage.OpenLineageInputDataset;
import org.openmetadata.schema.api.lineage.openlineage.OpenLineageOutputDataset;
import org.openmetadata.schema.api.lineage.openlineage.Owner;
import org.openmetadata.schema.api.lineage.openlineage.OwnershipFacet;
import org.openmetadata.schema.api.lineage.openlineage.SchemaFacet;
import org.openmetadata.schema.api.lineage.openlineage.SchemaField;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.openlineage.OpenLineageDatasetNameNormalizer.DatasetCandidate;

@Slf4j
public class OpenLineageEntityResolver {

  private final Map<String, EntityReference> tableCache = new ConcurrentHashMap<>();
  private final Map<String, EntityReference> pipelineCache = new ConcurrentHashMap<>();
  private final Map<String, EntityReference> containerCache = new ConcurrentHashMap<>();
  private final boolean autoCreateEntities;
  private final String defaultPipelineService;
  private final Map<String, String> namespaceToServiceMapping;

  public OpenLineageEntityResolver(boolean autoCreateEntities, String defaultPipelineService) {
    this(autoCreateEntities, defaultPipelineService, null);
  }

  public OpenLineageEntityResolver(
      boolean autoCreateEntities,
      String defaultPipelineService,
      Map<String, String> namespaceToServiceMapping) {
    this.autoCreateEntities = autoCreateEntities;
    this.defaultPipelineService = defaultPipelineService;
    this.namespaceToServiceMapping =
        namespaceToServiceMapping != null ? namespaceToServiceMapping : Map.of();
  }

  public EntityReference resolveTable(OpenLineageInputDataset dataset) {
    if (dataset == null) {
      return null;
    }
    return resolveTableInternal(dataset.getNamespace(), dataset.getName(), dataset.getFacets());
  }

  public EntityReference resolveTable(OpenLineageOutputDataset dataset) {
    if (dataset == null) {
      return null;
    }
    return resolveTableInternal(dataset.getNamespace(), dataset.getName(), dataset.getFacets());
  }

  private EntityReference resolveTableInternal(
      String namespace, String name, DatasetFacets facets) {
    String cacheKey = buildCacheKey(namespace, name);
    EntityReference cached = tableCache.get(cacheKey);
    if (cached != null) {
      return cached;
    }

    String tableFqn = resolveTableFqn(namespace, name, facets);
    if (tableFqn == null) {
      return null;
    }

    try {
      EntityReference ref = Entity.getEntityReferenceByName(Entity.TABLE, tableFqn, NON_DELETED);
      if (ref != null) {
        tableCache.put(cacheKey, ref);
      }
      return ref;
    } catch (EntityNotFoundException e) {
      LOG.debug("Table not found: {}", tableFqn);
      return null;
    }
  }

  public EntityReference resolveOrCreateTable(OpenLineageInputDataset dataset, String updatedBy) {
    EntityReference ref = resolveTable(dataset);
    if (ref != null) {
      return ref;
    }

    if (!autoCreateEntities) {
      LOG.debug("Auto-create disabled, skipping table creation for: {}", dataset.getName());
      return null;
    }

    return createTableFromInput(dataset, updatedBy);
  }

  public EntityReference resolveOrCreateTable(OpenLineageOutputDataset dataset, String updatedBy) {
    EntityReference ref = resolveTable(dataset);
    if (ref != null) {
      return ref;
    }

    if (!autoCreateEntities) {
      LOG.debug("Auto-create disabled, skipping table creation for: {}", dataset.getName());
      return null;
    }

    return createTableFromOutput(dataset, updatedBy);
  }

  public boolean isStorageDataset(String namespace) {
    return OpenLineageDatasetNameNormalizer.isStorageNamespace(namespace);
  }

  public EntityReference resolveContainer(String namespace, String name) {
    if (nullOrEmpty(namespace) || nullOrEmpty(name)) {
      return null;
    }

    String fullPath = namespace.endsWith("/") ? namespace + name : namespace + "/" + name;
    String cacheKey = "container:" + fullPath;

    EntityReference cached = containerCache.get(cacheKey);
    if (cached != null) {
      return cached;
    }

    EntityReference ref = searchContainerByFullPath(fullPath);
    if (ref != null) {
      containerCache.put(cacheKey, ref);
      return ref;
    }

    // Try without wildcard suffixes (e.g., "gs://bucket/path/file_*.csv" → "gs://bucket/path")
    String parentPath = extractParentPath(fullPath);
    if (parentPath != null && !parentPath.equals(fullPath)) {
      ref = searchContainerByFullPath(parentPath);
      if (ref != null) {
        containerCache.put(cacheKey, ref);
        return ref;
      }
    }

    return null;
  }

  public EntityReference resolveOrCreatePipeline(String namespace, String name, String updatedBy) {
    if (nullOrEmpty(name)) {
      return null;
    }

    String pipelineName = buildPipelineName(namespace, name);
    String cacheKey = namespace + "/" + name;

    EntityReference cached = pipelineCache.get(cacheKey);
    if (cached != null) {
      return cached;
    }

    String pipelineFqn = buildPipelineFqn(pipelineName);
    try {
      EntityReference ref =
          Entity.getEntityReferenceByName(Entity.PIPELINE, pipelineFqn, NON_DELETED);
      if (ref != null) {
        pipelineCache.put(cacheKey, ref);
        return ref;
      }
    } catch (EntityNotFoundException e) {
      LOG.debug("Pipeline not found: {}", pipelineFqn);
    }

    // Fallback: try namespace as service name, e.g. fasfas.stackoverflow_etl_lineage
    if (!nullOrEmpty(namespace)) {
      String fallbackFqn = namespace + "." + name;
      try {
        EntityReference ref =
            Entity.getEntityReferenceByName(Entity.PIPELINE, fallbackFqn, NON_DELETED);
        if (ref != null) {
          LOG.info("Resolved pipeline via namespace fallback: {}", fallbackFqn);
          pipelineCache.put(cacheKey, ref);
          return ref;
        }
      } catch (EntityNotFoundException e) {
        LOG.debug("Pipeline not found by namespace fallback: {}", fallbackFqn);
      }
    }

    if (!autoCreateEntities) {
      LOG.debug("Auto-create disabled, skipping pipeline creation for: {}", pipelineName);
      return null;
    }

    return createPipeline(pipelineName, updatedBy);
  }

  private String resolveTableFqn(String namespace, String datasetName, DatasetFacets facets) {
    List<DatasetCandidate> candidates =
        OpenLineageDatasetNameNormalizer.extractCandidates(namespace, datasetName, facets);
    String result = null;
    if (candidates.isEmpty()) {
      LOG.warn(
          "No parsable table identifier for dataset {} (namespace {}). "
              + "Expected schema.table, catalog.schema.table, a Glue table/db/table symlink, or a Hive warehouse path",
          datasetName,
          namespace);
    }
    String datasourceName = extractDatasourceName(facets);
    for (DatasetCandidate candidate : candidates) {
      result = resolveCandidateFqn(candidate.namespace(), datasourceName, candidate.tableName());
      if (result != null) {
        break;
      }
    }
    if (result == null && !candidates.isEmpty()) {
      LOG.debug("Could not resolve dataset {} using candidates {}", datasetName, candidates);
    }
    return result;
  }

  private String resolveCandidateFqn(String namespace, String datasourceName, String candidate) {
    String[] parts = candidate.split("\\.");
    String database = parts.length >= 3 ? parts[parts.length - 3] : null;
    String schema = parts[parts.length - 2];
    String table = parts[parts.length - 1];

    String result = resolveViaNamespaceMapping(namespace, database, schema, table);
    if (result == null) {
      result = resolveViaDatasource(datasourceName, database, schema, table);
    }
    if (result == null && database != null) {
      result = searchTableByFqnSuffix(database + "." + schema + "." + table);
    }
    if (result == null && datasourceName != null) {
      result = searchTableByFqnPattern(datasourceName + ".%." + schema + "." + table);
    }
    if (result == null) {
      result = searchTableByFqnSuffix(schema + "." + table);
    }
    return result;
  }

  private String resolveViaDatasource(
      String datasourceName, String database, String schema, String table) {
    String result = null;
    if (datasourceName != null && database != null) {
      result =
          searchTableByFqnPattern(datasourceName + "." + database + "." + schema + "." + table);
    }
    return result;
  }

  private String resolveViaNamespaceMapping(
      String namespace, String database, String schema, String table) {
    String result = null;
    String mappedService = lookupServiceFromNamespace(namespace);
    if (mappedService != null) {
      if (database != null) {
        result =
            searchTableByFqnPattern(mappedService + "." + database + "." + schema + "." + table);
      }
      if (result == null) {
        result = searchTableByFqnPattern(mappedService + ".%.%" + schema + "." + table);
      }
      if (result != null) {
        LOG.debug(
            "Resolved table via namespace mapping: {} -> service {} -> {}",
            namespace,
            mappedService,
            result);
      }
    }
    return result;
  }

  private String lookupServiceFromNamespace(String namespace) {
    if (namespace == null || namespaceToServiceMapping.isEmpty()) {
      return null;
    }

    // First try exact match
    if (namespaceToServiceMapping.containsKey(namespace)) {
      return namespaceToServiceMapping.get(namespace);
    }

    // Try prefix matching for namespaces like "postgresql://host:5432/db"
    for (Map.Entry<String, String> entry : namespaceToServiceMapping.entrySet()) {
      if (namespace.startsWith(entry.getKey()) || entry.getKey().startsWith(namespace)) {
        return entry.getValue();
      }
    }

    return null;
  }

  private String searchTableByFqnPattern(String fqnPattern) {
    return searchTableByFilter(fqnPattern, new ListFilterByFqnPattern(fqnPattern));
  }

  private String searchTableByFqnSuffix(String fqnSuffix) {
    return searchTableByFilter(fqnSuffix, new ListFilterByFqnSuffix(fqnSuffix));
  }

  private String searchTableByFilter(String searchKey, ListFilter filter) {
    String result = null;
    try {
      @SuppressWarnings("unchecked")
      EntityRepository<Table> tableRepository =
          (EntityRepository<Table>) Entity.getEntityRepository(Entity.TABLE);

      List<Table> tables =
          tableRepository.listAll(tableRepository.getFields("databaseSchema"), filter);

      if (!tables.isEmpty()) {
        result = tables.getFirst().getFullyQualifiedName();
      }
    } catch (Exception e) {
      LOG.debug("Error searching for table matching {}: {}", searchKey, e.getMessage());
    }
    return result;
  }

  private String extractDatasourceName(DatasetFacets facets) {
    if (facets == null) {
      return null;
    }

    DatasourceFacet datasource = facets.getDatasource();
    if (datasource != null && datasource.getName() != null) {
      return datasource.getName();
    }

    return null;
  }

  private EntityReference searchContainerByFullPath(String fullPath) {
    try {
      @SuppressWarnings("unchecked")
      EntityRepository<Container> containerRepository =
          (EntityRepository<Container>) Entity.getEntityRepository(Entity.CONTAINER);

      List<Container> containers =
          containerRepository.listAll(
              containerRepository.getFields(""), new ListFilterByJsonField("fullPath", fullPath));

      if (!containers.isEmpty()) {
        Container container = containers.get(0);
        LOG.debug(
            "Resolved container by fullPath: {} -> {}",
            fullPath,
            container.getFullyQualifiedName());
        return container.getEntityReference();
      }
    } catch (Exception e) {
      LOG.debug("Error searching for container by fullPath {}: {}", fullPath, e.getMessage());
    }
    return null;
  }

  private String extractParentPath(String path) {
    if (path == null) {
      return null;
    }
    int lastSlash = path.lastIndexOf('/');
    if (lastSlash <= 0) {
      return null;
    }
    return path.substring(0, lastSlash);
  }

  private EntityReference createTableFromInput(OpenLineageInputDataset dataset, String updatedBy) {
    return createTableInternal(
        dataset.getNamespace(), dataset.getName(), dataset.getFacets(), updatedBy);
  }

  private EntityReference createTableFromOutput(
      OpenLineageOutputDataset dataset, String updatedBy) {
    return createTableInternal(
        dataset.getNamespace(), dataset.getName(), dataset.getFacets(), updatedBy);
  }

  private EntityReference createTableInternal(
      String namespace, String name, DatasetFacets facets, String updatedBy) {
    List<DatasetCandidate> candidates =
        OpenLineageDatasetNameNormalizer.extractCandidates(namespace, name, facets);
    if (candidates.isEmpty()) {
      LOG.warn("Cannot create table, invalid name format: {}", name);
      return null;
    }

    String table = null;
    String schemaFqn = null;
    for (DatasetCandidate candidate : candidates) {
      String[] parts = candidate.tableName().split("\\.");
      schemaFqn = findSchemaFqn(parts);
      if (schemaFqn != null) {
        table = parts[parts.length - 1];
        break;
      }
    }
    if (schemaFqn == null) {
      LOG.warn("Cannot create table, schema not found for candidates: {}", candidates);
      return null;
    }

    try {
      @SuppressWarnings("unchecked")
      EntityRepository<Table> tableRepository =
          (EntityRepository<Table>) Entity.getEntityRepository(Entity.TABLE);

      List<Column> columns = extractColumns(facets);
      String description = extractDescription(facets);
      List<EntityReference> owners = extractOwners(facets);

      Table newTable = new Table();
      newTable.setId(java.util.UUID.randomUUID());
      newTable.setName(table);
      newTable.setFullyQualifiedName(schemaFqn + "." + table);
      newTable.setDatabaseSchema(
          Entity.getEntityReferenceByName(Entity.DATABASE_SCHEMA, schemaFqn, NON_DELETED));
      newTable.setColumns(columns);

      if (description != null) {
        newTable.setDescription(description);
      }

      if (!owners.isEmpty()) {
        newTable.setOwners(owners);
      }

      newTable.setUpdatedBy(updatedBy);
      newTable.setUpdatedAt(System.currentTimeMillis());

      Table created = tableRepository.create(null, newTable);
      LOG.info("Created table from OpenLineage event: {}", created.getFullyQualifiedName());

      EntityReference ref = created.getEntityReference();
      String cacheKey = buildCacheKey(namespace, name);
      tableCache.put(cacheKey, ref);

      return ref;
    } catch (Exception e) {
      LOG.error("Failed to create table {}: {}", table, e.getMessage());
      return null;
    }
  }

  private String extractDescription(DatasetFacets facets) {
    if (facets == null) {
      return null;
    }

    DocumentationFacet documentation = facets.getDocumentation();
    if (documentation != null && documentation.getDescription() != null) {
      return documentation.getDescription();
    }

    return null;
  }

  private List<EntityReference> extractOwners(DatasetFacets facets) {
    List<EntityReference> ownerRefs = new ArrayList<>();

    if (facets == null) {
      return ownerRefs;
    }

    OwnershipFacet ownership = facets.getOwnership();
    if (ownership == null || ownership.getOwners() == null) {
      return ownerRefs;
    }

    for (Owner owner : ownership.getOwners()) {
      if (owner.getName() == null) {
        continue;
      }

      try {
        EntityReference userRef =
            Entity.getEntityReferenceByName(Entity.USER, owner.getName(), NON_DELETED);
        if (userRef != null) {
          ownerRefs.add(userRef);
        }
      } catch (EntityNotFoundException e) {
        LOG.debug("Owner user not found: {}", owner.getName());
      }
    }

    return ownerRefs;
  }

  private String findSchemaFqn(String[] candidateParts) {
    String schema = candidateParts[candidateParts.length - 2];
    String result = null;
    if (candidateParts.length >= 3) {
      String database = candidateParts[candidateParts.length - 3];
      result = searchSchemaByName(database + "." + schema);
    }
    if (result == null) {
      result = searchSchemaByName(schema);
    }
    return result;
  }

  private String searchSchemaByName(String schemaName) {
    try {
      @SuppressWarnings("unchecked")
      EntityRepository<?> schemaRepository = Entity.getEntityRepository(Entity.DATABASE_SCHEMA);

      String searchPattern = "%" + schemaName;
      List<?> schemas =
          schemaRepository.listAll(
              schemaRepository.getFields(""), new ListFilterByFqnSuffix(searchPattern));

      if (!schemas.isEmpty()) {
        Object schema = schemas.get(0);
        if (schema instanceof org.openmetadata.schema.entity.data.DatabaseSchema dbSchema) {
          return dbSchema.getFullyQualifiedName();
        }
      }
    } catch (Exception e) {
      LOG.debug("Error searching for schema {}: {}", schemaName, e.getMessage());
    }
    return null;
  }

  private List<Column> extractColumns(DatasetFacets facets) {
    List<Column> columns = new ArrayList<>();

    if (facets == null) {
      return columns;
    }

    SchemaFacet schemaFacet = facets.getSchema();
    if (schemaFacet == null || schemaFacet.getFields() == null) {
      return columns;
    }

    for (SchemaField field : schemaFacet.getFields()) {
      Column column = new Column();
      column.setName(field.getName());
      column.setDataType(mapDataType(field.getType()));
      column.setDataTypeDisplay(field.getType());
      if (field.getDescription() != null) {
        column.setDescription(field.getDescription());
      }
      columns.add(column);
    }

    return columns;
  }

  private ColumnDataType mapDataType(String olType) {
    if (olType == null) {
      return ColumnDataType.UNKNOWN;
    }

    String upperType = olType.toUpperCase();

    if (upperType.contains("STRING")
        || upperType.contains("VARCHAR")
        || upperType.contains("CHAR")) {
      return ColumnDataType.VARCHAR;
    } else if (upperType.contains("INT")) {
      return ColumnDataType.INT;
    } else if (upperType.contains("LONG") || upperType.contains("BIGINT")) {
      return ColumnDataType.BIGINT;
    } else if (upperType.contains("DOUBLE") || upperType.contains("FLOAT")) {
      return ColumnDataType.DOUBLE;
    } else if (upperType.contains("DECIMAL") || upperType.contains("NUMERIC")) {
      return ColumnDataType.DECIMAL;
    } else if (upperType.contains("BOOLEAN") || upperType.contains("BOOL")) {
      return ColumnDataType.BOOLEAN;
    } else if (upperType.contains("DATE")) {
      return ColumnDataType.DATE;
    } else if (upperType.contains("TIMESTAMP")) {
      return ColumnDataType.TIMESTAMP;
    } else if (upperType.contains("TIME")) {
      return ColumnDataType.TIME;
    } else if (upperType.contains("ARRAY")) {
      return ColumnDataType.ARRAY;
    } else if (upperType.contains("MAP")) {
      return ColumnDataType.MAP;
    } else if (upperType.contains("STRUCT")) {
      return ColumnDataType.STRUCT;
    } else if (upperType.contains("BINARY") || upperType.contains("BYTES")) {
      return ColumnDataType.BINARY;
    } else if (upperType.contains("JSON")) {
      return ColumnDataType.JSON;
    }

    return ColumnDataType.UNKNOWN;
  }

  private String buildPipelineName(String namespace, String name) {
    if (nullOrEmpty(namespace)) {
      return name;
    }
    return namespace.replaceAll("[^a-zA-Z0-9_-]", "_") + "-" + name;
  }

  private String buildPipelineFqn(String pipelineName) {
    return defaultPipelineService + "." + pipelineName;
  }

  private EntityReference createPipeline(String pipelineName, String updatedBy) {
    try {
      @SuppressWarnings("unchecked")
      EntityRepository<Pipeline> pipelineRepository =
          (EntityRepository<Pipeline>) Entity.getEntityRepository(Entity.PIPELINE);

      EntityReference serviceRef =
          Entity.getEntityReferenceByName(
              Entity.PIPELINE_SERVICE, defaultPipelineService, NON_DELETED);

      Pipeline newPipeline = new Pipeline();
      newPipeline.setId(java.util.UUID.randomUUID());
      newPipeline.setName(pipelineName);
      newPipeline.setFullyQualifiedName(buildPipelineFqn(pipelineName));
      newPipeline.setService(serviceRef);
      newPipeline.setDescription("Pipeline created from OpenLineage event");

      newPipeline.setUpdatedBy(updatedBy);
      newPipeline.setUpdatedAt(System.currentTimeMillis());

      Pipeline created = pipelineRepository.create(null, newPipeline);
      LOG.info("Created pipeline from OpenLineage event: {}", created.getFullyQualifiedName());

      return created.getEntityReference();
    } catch (EntityNotFoundException e) {
      LOG.warn(
          "Pipeline service '{}' not found. Cannot auto-create pipeline: {}",
          defaultPipelineService,
          pipelineName);
      return null;
    } catch (Exception e) {
      LOG.error("Failed to create pipeline {}: {}", pipelineName, e.getMessage());
      return null;
    }
  }

  private String buildCacheKey(String namespace, String name) {
    return namespace + "/" + name;
  }

  public void clearCache() {
    tableCache.clear();
    pipelineCache.clear();
    containerCache.clear();
  }

  private static class ListFilterByFqnSuffix extends ListFilter {
    public ListFilterByFqnSuffix(String suffix) {
      super(Include.NON_DELETED);
      addQueryParam("fqnSuffix", "%" + suffix);
    }

    @Override
    public String getCondition(String tableName) {
      String baseCondition = super.getCondition(tableName);
      String fqnClause = buildFqnLikeClause(tableName, "fqnSuffix");
      return baseCondition + " AND " + fqnClause;
    }
  }

  private static class ListFilterByFqnPattern extends ListFilter {
    public ListFilterByFqnPattern(String pattern) {
      super(Include.NON_DELETED);
      addQueryParam("fqnPattern", pattern);
    }

    @Override
    public String getCondition(String tableName) {
      String baseCondition = super.getCondition(tableName);
      String fqnClause = buildFqnLikeClause(tableName, "fqnPattern");
      return baseCondition + " AND " + fqnClause;
    }
  }

  private static class ListFilterByJsonField extends ListFilter {
    private final String fieldName;

    public ListFilterByJsonField(String fieldName, String value) {
      super(Include.NON_DELETED);
      this.fieldName = fieldName;
      addQueryParam("jsonFieldValue", value);
    }

    @Override
    public String getCondition(String tableName) {
      String baseCondition = super.getCondition(tableName);
      String column = tableName == null ? "json" : tableName + ".json";
      String fieldClause;
      if (Boolean.TRUE.equals(
          org.openmetadata.service.resources.databases.DatasourceConfig.getInstance().isMySQL())) {
        fieldClause =
            String.format(
                "JSON_UNQUOTE(JSON_EXTRACT(%s, '$.%s')) = :jsonFieldValue", column, fieldName);
      } else {
        fieldClause = String.format("%s->>'%s' = :jsonFieldValue", column, fieldName);
      }
      return baseCondition + " AND " + fieldClause;
    }
  }

  private static String buildFqnLikeClause(String tableName, String paramName) {
    String column = tableName == null ? "json" : tableName + ".json";
    if (Boolean.TRUE.equals(
        org.openmetadata.service.resources.databases.DatasourceConfig.getInstance().isMySQL())) {
      return String.format(
          "JSON_UNQUOTE(JSON_EXTRACT(%s, '$.fullyQualifiedName')) LIKE :%s", column, paramName);
    } else {
      return String.format("%s->>'fullyQualifiedName' LIKE :%s", column, paramName);
    }
  }
}
