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
import static org.openmetadata.schema.api.lineage.openlineage.UnresolvedReason.CREATION_DISABLED;
import static org.openmetadata.schema.api.lineage.openlineage.UnresolvedReason.NAMESPACE_NOT_MAPPED;
import static org.openmetadata.schema.api.lineage.openlineage.UnresolvedReason.NOT_FOUND;
import static org.openmetadata.schema.api.lineage.openlineage.UnresolvedReason.PIPELINE_NOT_FOUND;
import static org.openmetadata.schema.api.lineage.openlineage.UnresolvedReason.UNPARSABLE_NAME;
import static org.openmetadata.schema.type.Include.NON_DELETED;
import static org.openmetadata.service.openlineage.OpenLineageResolution.resolved;
import static org.openmetadata.service.openlineage.OpenLineageResolution.unresolved;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.lineage.openlineage.DatasetFacets;
import org.openmetadata.schema.api.lineage.openlineage.DatasourceFacet;
import org.openmetadata.schema.api.lineage.openlineage.OpenLineageInputDataset;
import org.openmetadata.schema.api.lineage.openlineage.OpenLineageOutputDataset;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.openlineage.OpenLineageDatasetNameNormalizer.DatasetCandidate;
import org.openmetadata.service.openlineage.OpenLineageEntityCreator.TableLocation;
import org.openmetadata.service.util.LikeEscape;

@Slf4j
public class OpenLineageEntityResolver {

  private static final int MAX_LOGGED_AMBIGUOUS_MATCHES = 5;

  private final Map<String, EntityReference> tableCache = new ConcurrentHashMap<>();
  private final Map<String, EntityReference> pipelineCache = new ConcurrentHashMap<>();
  private final Map<String, EntityReference> containerCache = new ConcurrentHashMap<>();
  private final boolean autoCreateEntities;
  private final String defaultPipelineService;
  private final OpenLineageNamespaceMapping namespaceMapping;
  private final OpenLineageEntityCreator entityCreator;

  public OpenLineageEntityResolver(boolean autoCreateEntities, String defaultPipelineService) {
    this(autoCreateEntities, defaultPipelineService, null);
  }

  /** Resolves only: with no caller to authorize creates against, nothing is ever created. */
  public OpenLineageEntityResolver(
      boolean autoCreateEntities,
      String defaultPipelineService,
      Map<String, String> namespaceToServiceMapping) {
    this(
        autoCreateEntities,
        defaultPipelineService,
        namespaceToServiceMapping,
        OpenLineageEntityCreator.withoutCaller());
  }

  public OpenLineageEntityResolver(
      boolean autoCreateEntities,
      String defaultPipelineService,
      Map<String, String> namespaceToServiceMapping,
      OpenLineageEntityCreator entityCreator) {
    this.autoCreateEntities = autoCreateEntities;
    this.defaultPipelineService = defaultPipelineService;
    this.namespaceMapping = new OpenLineageNamespaceMapping(namespaceToServiceMapping);
    this.entityCreator = entityCreator;
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

  public OpenLineageResolution resolveDataset(OpenLineageInputDataset dataset, String updatedBy) {
    return resolveDataset(
        dataset.getNamespace(), dataset.getName(), dataset.getFacets(), updatedBy);
  }

  public OpenLineageResolution resolveDataset(OpenLineageOutputDataset dataset, String updatedBy) {
    return resolveDataset(
        dataset.getNamespace(), dataset.getName(), dataset.getFacets(), updatedBy);
  }

  /**
   * Resolves a dataset to an existing table or container, or creates its table under the service
   * its namespace is mapped to. Anything else comes back unresolved with the reason, so the caller
   * learns about it instead of the edge silently disappearing.
   */
  private OpenLineageResolution resolveDataset(
      String namespace, String name, DatasetFacets facets, String updatedBy) {
    EntityReference existing = resolveExisting(namespace, name, facets);
    return existing != null
        ? resolved(existing)
        : createMissingTable(namespace, name, facets, updatedBy);
  }

  private EntityReference resolveExisting(String namespace, String name, DatasetFacets facets) {
    EntityReference table = resolveTableInternal(namespace, name, facets);
    return table == null && isStorageDataset(namespace) ? resolveContainer(namespace, name) : table;
  }

  private OpenLineageResolution createMissingTable(
      String namespace, String name, DatasetFacets facets, String updatedBy) {
    List<DatasetCandidate> candidates =
        OpenLineageDatasetNameNormalizer.extractCandidates(namespace, name, facets);
    OpenLineageResolution result;
    if (candidates.isEmpty()) {
      result = unresolvedWithoutTableName(namespace, name);
    } else if (!autoCreateEntities) {
      result =
          unresolved(CREATION_DISABLED, "No matching table exists and autoCreateEntities is off");
    } else {
      result = createInMappedService(namespace, candidates, facets, updatedBy);
    }
    if (result instanceof OpenLineageResolution.Resolved created) {
      tableCache.put(buildCacheKey(namespace, name), created.entity());
    }
    return result;
  }

  /**
   * A bare token is a table name without its schema (Spark emits one when a relation misses the Glue
   * symlink), so it is reported as such even under a storage namespace, where only a real path
   * means a missing container.
   */
  private OpenLineageResolution unresolvedWithoutTableName(String namespace, String name) {
    OpenLineageResolution result;
    if (bareToken(name) != null) {
      result =
          unresolved(
              UNPARSABLE_NAME,
              "A bare table name carries no schema: it only matches an existing table through "
                  + "namespaceToServiceMapping and is never created");
    } else if (isStorageDataset(namespace)) {
      result =
          unresolved(
              NOT_FOUND,
              "No container matches this storage path, and containers are never created");
    } else {
      result =
          unresolved(
              UNPARSABLE_NAME,
              "The dataset name has no schema and table to match or create a table with");
    }
    return result;
  }

  private OpenLineageResolution createInMappedService(
      String namespace, List<DatasetCandidate> candidates, DatasetFacets facets, String updatedBy) {
    return candidates.stream()
        .map(this::locateInMappedService)
        .flatMap(Optional::stream)
        .findFirst()
        .map(location -> entityCreator.createTable(location, facets, updatedBy))
        .orElseGet(
            () ->
                unresolved(
                    NAMESPACE_NOT_MAPPED,
                    String.format(
                        "No matching table exists, and namespace '%s' has no "
                            + "namespaceToServiceMapping entry to create one under",
                        namespace)));
  }

  private Optional<TableLocation> locateInMappedService(DatasetCandidate candidate) {
    return namespaceMapping
        .serviceFor(candidate.namespace())
        .map(service -> tableLocation(service, candidate));
  }

  /**
   * A two-part name carries no database. For a Glue symlink the ARN's account id stands in, since
   * that is what the Glue connector ingests as the database; otherwise the creator decides.
   */
  private static TableLocation tableLocation(String service, DatasetCandidate candidate) {
    String[] parts = candidate.tableName().split("\\.");
    String database =
        parts.length >= 3
            ? parts[parts.length - 3]
            : OpenLineageDatasetNameNormalizer.extractGlueCatalogId(candidate.namespace());
    return new TableLocation(service, database, parts[parts.length - 2], parts[parts.length - 1]);
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

  /**
   * Finds the pipeline of an OpenLineage job. Pipelines are never created: a job knows too little
   * to describe one, so an unknown job is reported and its edges are written without a pipeline.
   */
  public OpenLineageResolution resolvePipeline(String namespace, String name) {
    EntityReference pipeline = nullOrEmpty(name) ? null : findPipeline(namespace, name);
    return pipeline != null
        ? resolved(pipeline)
        : unresolved(
            PIPELINE_NOT_FOUND,
            String.format(
                "No pipeline '%s' exists, and pipelines are never created from OpenLineage events",
                nullOrEmpty(name) ? "" : buildPipelineFqn(buildPipelineName(namespace, name))));
  }

  private EntityReference findPipeline(String namespace, String name) {
    String cacheKey = namespace + "/" + name;
    EntityReference pipeline = pipelineCache.get(cacheKey);
    if (pipeline == null) {
      pipeline = findPipelineByName(namespace, name);
    }
    if (pipeline != null) {
      pipelineCache.put(cacheKey, pipeline);
    }
    return pipeline;
  }

  /** Falls back to the namespace as service name, e.g. fasfas.stackoverflow_etl_lineage. */
  private EntityReference findPipelineByName(String namespace, String name) {
    EntityReference pipeline =
        findPipelineByFqn(buildPipelineFqn(buildPipelineName(namespace, name)));
    if (pipeline == null && !nullOrEmpty(namespace)) {
      pipeline = findPipelineByFqn(namespace + "." + name);
    }
    return pipeline;
  }

  private EntityReference findPipelineByFqn(String fqn) {
    EntityReference pipeline = null;
    try {
      pipeline = Entity.getEntityReferenceByName(Entity.PIPELINE, fqn, NON_DELETED);
    } catch (EntityNotFoundException e) {
      LOG.debug("Pipeline not found: {}", fqn);
    }
    return pipeline;
  }

  private String resolveTableFqn(String namespace, String datasetName, DatasetFacets facets) {
    List<DatasetCandidate> candidates =
        OpenLineageDatasetNameNormalizer.extractCandidates(namespace, datasetName, facets);
    String datasourceName = extractDatasourceName(facets);
    String result = null;
    for (DatasetCandidate candidate : candidates) {
      result = resolveCandidateFqn(candidate.namespace(), datasourceName, candidate.tableName());
      if (result != null) {
        break;
      }
    }
    if (result == null) {
      result = resolveBareTokenViaNamespaceMapping(namespace, datasetName);
    }
    if (result == null) {
      logUnresolvedDataset(namespace, datasetName, candidates);
    }
    return result;
  }

  private void logUnresolvedDataset(
      String namespace, String datasetName, List<DatasetCandidate> candidates) {
    if (!candidates.isEmpty()) {
      LOG.debug("Could not resolve dataset {} using candidates {}", datasetName, candidates);
    } else if (bareToken(datasetName) == null) {
      LOG.warn(
          "No parsable table identifier for dataset {} (namespace {}). "
              + "Expected schema.table, catalog.schema.table, a Glue table/db/table symlink, or a Hive warehouse path",
          datasetName,
          namespace);
    }
    // A bare token is reported by resolveBareTokenViaNamespaceMapping, which knows whether the
    // namespace was mapped - logging it again here would advise a mapping the operator may have.
  }

  /**
   * Last resort for an identifier that carries no schema at all - a single bare token, which Spark
   * emits for relations that miss the Glue/Iceberg symlink path. A table-name-only search is only
   * defensible when the operator has declared which service the namespace belongs to, and only when
   * it identifies exactly one table; matching the whole catalog on a bare name would pick an
   * arbitrary same-named table from any database.
   */
  private String resolveBareTokenViaNamespaceMapping(String namespace, String datasetName) {
    String table = bareToken(datasetName);
    if (table == null) {
      return null;
    }
    String mappedService = lookupServiceFromNamespace(namespace);
    if (mappedService == null) {
      LOG.warn(
          "Dataset {} (namespace {}) carries no schema, so it can only be matched by table name. "
              + "Map this namespace to a service via namespaceToServiceMapping to enable that lookup",
          datasetName,
          namespace);
      return null;
    }
    return resolveBareTokenInService(namespace, datasetName, table, mappedService);
  }

  private String resolveBareTokenInService(
      String namespace, String datasetName, String table, String mappedService) {
    String pattern = LikeEscape.escape(mappedService) + ".%." + LikeEscape.escape(table);
    List<Table> matches = listTables(pattern, new ListFilterByFqnPattern(pattern, true));
    if (matches.size() == 1) {
      return matches.getFirst().getFullyQualifiedName();
    }
    logUnresolvedBareToken(namespace, datasetName, table, mappedService, matches);
    return null;
  }

  private void logUnresolvedBareToken(
      String namespace,
      String datasetName,
      String table,
      String mappedService,
      List<Table> matches) {
    if (matches.isEmpty()) {
      LOG.warn(
          "Dataset {} (namespace {}) carries no schema and no table named {} exists in service {}",
          datasetName,
          namespace,
          table,
          mappedService);
    } else {
      LOG.warn(
          "Bare dataset name {} (namespace {}) matched {} tables in service {}, dropping the edge "
              + "rather than guessing. Candidates: {}",
          datasetName,
          namespace,
          matches.size(),
          mappedService,
          describeCandidates(matches));
    }
  }

  /** Returns the name when it is a single undelimited token, else null. */
  private String bareToken(String datasetName) {
    String result = null;
    if (!nullOrEmpty(datasetName)) {
      String trimmed = datasetName.trim();
      if (!trimmed.isEmpty() && !trimmed.contains(".") && !trimmed.contains("/")) {
        result = trimmed;
      }
    }
    return result;
  }

  private String resolveCandidateFqn(String namespace, String datasourceName, String candidate) {
    String[] parts = candidate.split("\\.");
    String database = parts.length >= 3 ? parts[parts.length - 3] : null;
    String schema = parts[parts.length - 2];
    String table = parts[parts.length - 1];
    if (database == null) {
      database = OpenLineageDatasetNameNormalizer.extractGlueCatalogId(namespace);
    }

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
    return namespaceMapping.serviceFor(namespace).orElse(null);
  }

  private String searchTableByFqnPattern(String fqnPattern) {
    return searchTableByFilter(fqnPattern, new ListFilterByFqnPattern(fqnPattern));
  }

  private String searchTableByFqnSuffix(String fqnSuffix) {
    return searchTableByFilter(fqnSuffix, new ListFilterByFqnSuffix(fqnSuffix));
  }

  private String searchTableByFilter(String searchKey, ListFilter filter) {
    List<Table> tables = listTables(searchKey, filter);
    String result = null;
    if (!tables.isEmpty()) {
      result = tables.getFirst().getFullyQualifiedName();
      warnOnAmbiguousMatch(searchKey, result, tables);
    }
    return result;
  }

  private List<Table> listTables(String searchKey, ListFilter filter) {
    List<Table> result = List.of();
    try {
      @SuppressWarnings("unchecked")
      EntityRepository<Table> tableRepository =
          (EntityRepository<Table>) Entity.getEntityRepository(Entity.TABLE);
      result = tableRepository.listAll(tableRepository.getFields("databaseSchema"), filter);
    } catch (Exception e) {
      LOG.debug("Error searching for table matching {}: {}", searchKey, e.getMessage());
    }
    return result;
  }

  /**
   * A multi-match means the lookup was not selective enough to identify one entity - the pick is
   * whatever the database returned first. Name the competing FQNs so the resulting lineage edge can
   * be traced back to the ambiguity instead of looking like a deliberate resolution.
   */
  private void warnOnAmbiguousMatch(String searchKey, String resolved, List<Table> tables) {
    if (tables.size() > 1) {
      LOG.warn(
          "Ambiguous OpenLineage table match: {} tables match [{}], resolving to [{}]. Candidates: {}",
          tables.size(),
          searchKey,
          resolved,
          describeCandidates(tables));
    }
  }

  private String describeCandidates(List<Table> tables) {
    String listed =
        tables.stream()
            .limit(MAX_LOGGED_AMBIGUOUS_MATCHES)
            .map(Table::getFullyQualifiedName)
            .collect(Collectors.joining(", "));
    return tables.size() > MAX_LOGGED_AMBIGUOUS_MATCHES ? listed + ", …" : listed;
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

  private String buildPipelineName(String namespace, String name) {
    if (nullOrEmpty(namespace)) {
      return name;
    }
    return namespace.replaceAll("[^a-zA-Z0-9_-]", "_") + "-" + name;
  }

  private String buildPipelineFqn(String pipelineName) {
    return defaultPipelineService + "." + pipelineName;
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
    private final boolean usesEscapedLiterals;

    public ListFilterByFqnPattern(String pattern) {
      this(pattern, false);
    }

    public ListFilterByFqnPattern(String pattern, boolean usesEscapedLiterals) {
      super(Include.NON_DELETED);
      this.usesEscapedLiterals = usesEscapedLiterals;
      addQueryParam("fqnPattern", pattern);
    }

    @Override
    public String getCondition(String tableName) {
      String baseCondition = super.getCondition(tableName);
      String fqnClause = buildFqnLikeClause(tableName, "fqnPattern", usesEscapedLiterals);
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
    return buildFqnLikeClause(tableName, paramName, false);
  }

  /**
   * {@code ESCAPE} is spelled with {@code !} rather than a backslash because MySQL
   * NO_BACKSLASH_ESCAPES and Postgres standard_conforming_strings make backslash handling
   * deployment-dependent, while {@code !} is unremarkable to both parsers.
   */
  private static String buildFqnLikeClause(
      String tableName, String paramName, boolean usesEscapedLiterals) {
    String column = tableName == null ? "json" : tableName + ".json";
    String escapeClause = usesEscapedLiterals ? " ESCAPE '!'" : "";
    if (Boolean.TRUE.equals(
        org.openmetadata.service.resources.databases.DatasourceConfig.getInstance().isMySQL())) {
      return String.format(
          "JSON_UNQUOTE(JSON_EXTRACT(%s, '$.fullyQualifiedName')) LIKE :%s%s",
          column, paramName, escapeClause);
    } else {
      return String.format("%s->>'fullyQualifiedName' LIKE :%s%s", column, paramName, escapeClause);
    }
  }
}
