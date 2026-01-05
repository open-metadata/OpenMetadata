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

package org.openmetadata.service.services.databases;

import static org.openmetadata.common.utils.CommonUtil.listOf;

import jakarta.json.JsonPatch;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.io.IOException;
import java.util.List;
import java.util.UUID;
import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.VoteRequest;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.data.CreateTableProfile;
import org.openmetadata.schema.api.tests.CreateCustomMetric;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.CustomMetric;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnProfile;
import org.openmetadata.schema.type.DataModel;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.PipelineObservability;
import org.openmetadata.schema.type.SystemProfile;
import org.openmetadata.schema.type.TableData;
import org.openmetadata.schema.type.TableJoins;
import org.openmetadata.schema.type.TableProfile;
import org.openmetadata.schema.type.TableProfilerConfig;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.TableRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.EntityBaseService;
import org.openmetadata.service.resources.ResourceEntityInfo;
import org.openmetadata.service.resources.databases.TableMapper;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.services.Service;
import org.openmetadata.service.util.RestUtil.PutResponse;

@Slf4j
@Singleton
@Service(entityType = Entity.TABLE)
public class TableService extends EntityBaseService<Table, TableRepository> {
  public static final String FIELDS =
      "tableConstraints,tablePartition,usageSummary,owners,customMetrics,columns,sampleData,"
          + "tags,followers,joins,schemaDefinition,dataModel,extension,testSuite,domains,dataProducts,lifeCycle,sourceHash";

  @Getter private final TableMapper mapper;

  @Inject
  public TableService(
      TableRepository repository, Authorizer authorizer, TableMapper mapper, Limits limits) {
    super(new ResourceEntityInfo<>(Entity.TABLE, Table.class), repository, authorizer, limits);
    this.mapper = mapper;
  }

  @Override
  public Table addHref(UriInfo uriInfo, Table table) {
    super.addHref(uriInfo, table);
    Entity.withHref(uriInfo, table.getDatabaseSchema());
    Entity.withHref(uriInfo, table.getDatabase());
    Entity.withHref(uriInfo, table.getService());
    return table;
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    allowedFields.add("customMetrics");
    addViewOperation(
        "columns,tableConstraints,tablePartition,joins,schemaDefinition,dataModel",
        MetadataOperation.VIEW_BASIC);
    addViewOperation("usageSummary", MetadataOperation.VIEW_USAGE);
    addViewOperation("customMetrics", MetadataOperation.VIEW_TESTS);
    addViewOperation("testSuite", MetadataOperation.VIEW_TESTS);
    addViewOperation("sampleData", MetadataOperation.VIEW_SAMPLE_DATA);
    return listOf(
        MetadataOperation.VIEW_TESTS,
        MetadataOperation.VIEW_QUERIES,
        MetadataOperation.VIEW_DATA_PROFILE,
        MetadataOperation.VIEW_SAMPLE_DATA,
        MetadataOperation.VIEW_USAGE,
        MetadataOperation.VIEW_PROFILER_GLOBAL_CONFIGURATION,
        MetadataOperation.EDIT_TESTS,
        MetadataOperation.EDIT_QUERIES,
        MetadataOperation.EDIT_DATA_PROFILE,
        MetadataOperation.EDIT_SAMPLE_DATA,
        MetadataOperation.EDIT_LINEAGE,
        MetadataOperation.EDIT_ENTITY_RELATIONSHIP,
        MetadataOperation.CREATE_TESTS);
  }

  public Table addJoins(
      UriInfo uriInfo, SecurityContext securityContext, UUID id, TableJoins joins) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    Table table = repository.addJoins(id, joins);
    return addHref(uriInfo, table);
  }

  public Table addSampleData(
      UriInfo uriInfo, SecurityContext securityContext, UUID id, TableData tableData) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_SAMPLE_DATA);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    Table table = repository.addSampleData(id, tableData);
    return addHref(uriInfo, table);
  }

  public Table getSampleData(UriInfo uriInfo, SecurityContext securityContext, UUID id) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_SAMPLE_DATA);
    ResourceContext<?> resourceContext = getResourceContextById(id);
    authorizer.authorize(securityContext, operationContext, resourceContext);
    boolean authorizePII = authorizer.authorizePII(securityContext, resourceContext.getOwners());
    Table table = repository.getSampleData(id, authorizePII);
    return addHref(uriInfo, table);
  }

  public Table deleteSampleData(UriInfo uriInfo, SecurityContext securityContext, UUID id) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_SAMPLE_DATA);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    Table table = repository.deleteSampleData(id);
    return addHref(uriInfo, table);
  }

  public Table addPipelineObservability(
      UriInfo uriInfo,
      SecurityContext securityContext,
      UUID id,
      List<PipelineObservability> pipelineObservability) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    Table table = repository.addPipelineObservability(id, pipelineObservability);
    return addHref(uriInfo, table);
  }

  public List<PipelineObservability> getPipelineObservability(
      SecurityContext securityContext, UUID id) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    return repository.getPipelineObservability(id);
  }

  public List<PipelineObservability> getPipelineObservabilityByName(
      SecurityContext securityContext, String fqn) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(fqn));
    return repository.getPipelineObservabilityByName(fqn);
  }

  public Table deletePipelineObservability(
      UriInfo uriInfo, SecurityContext securityContext, UUID id) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    Table table = repository.deletePipelineObservability(id);
    return addHref(uriInfo, table);
  }

  public Table addSinglePipelineObservability(
      UriInfo uriInfo,
      SecurityContext securityContext,
      UUID id,
      PipelineObservability pipelineObservability) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    Table table = repository.addSinglePipelineObservability(id, pipelineObservability);
    return addHref(uriInfo, table);
  }

  public Table deleteSinglePipelineObservability(
      UriInfo uriInfo, SecurityContext securityContext, UUID id, String pipelineFqn) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    Table table = repository.deleteSinglePipelineObservability(id, pipelineFqn);
    return addHref(uriInfo, table);
  }

  public Table addTableProfilerConfig(
      UriInfo uriInfo,
      SecurityContext securityContext,
      UUID id,
      TableProfilerConfig tableProfilerConfig) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_DATA_PROFILE);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    Table table = repository.addTableProfilerConfig(id, tableProfilerConfig);
    return addHref(uriInfo, table);
  }

  public Table getTableProfilerConfig(UriInfo uriInfo, SecurityContext securityContext, UUID id) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_DATA_PROFILE);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    Table table = repository.find(id, Include.NON_DELETED);
    return addHref(
        uriInfo, table.withTableProfilerConfig(repository.getTableProfilerConfig(table)));
  }

  public Table deleteTableProfilerConfig(
      UriInfo uriInfo, SecurityContext securityContext, UUID id) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_DATA_PROFILE);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    Table table = repository.deleteTableProfilerConfig(id);
    return addHref(uriInfo, table);
  }

  public Table getLatestTableProfile(
      String fqn, boolean includeColumnProfile, SecurityContext securityContext) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_DATA_PROFILE);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(fqn));
    return repository.getLatestTableProfile(fqn, includeColumnProfile, authorizer, securityContext);
  }

  public ResultList<TableProfile> getTableProfiles(
      SecurityContext securityContext, String fqn, Long startTs, Long endTs) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_DATA_PROFILE);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(fqn));
    return repository.getTableProfiles(fqn, startTs, endTs);
  }

  public ResultList<ColumnProfile> getColumnProfiles(
      SecurityContext securityContext, String fqn, String tableFqn, Long startTs, Long endTs) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_DATA_PROFILE);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(tableFqn));
    return repository.getColumnProfiles(fqn, startTs, endTs, authorizer, securityContext);
  }

  public ResultList<SystemProfile> getSystemProfiles(String fqn, Long startTs, Long endTs) {
    return repository.getSystemProfiles(fqn, startTs, endTs);
  }

  public Table addTableProfileData(
      UriInfo uriInfo,
      SecurityContext securityContext,
      UUID id,
      CreateTableProfile createTableProfile) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_DATA_PROFILE);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    Table table = repository.addTableProfileData(id, createTableProfile);
    return addHref(uriInfo, table);
  }

  public void deleteTableProfile(
      SecurityContext securityContext, String fqn, String profileEntityType, Long timestamp) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_DATA_PROFILE);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(fqn));
    repository.deleteTableProfile(fqn, profileEntityType, timestamp);
  }

  public Table addDataModel(
      UriInfo uriInfo, SecurityContext securityContext, UUID id, DataModel dataModel) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    Table table = repository.addDataModel(id, dataModel);
    return addHref(uriInfo, table);
  }

  public Table addCustomMetric(
      UriInfo uriInfo, SecurityContext securityContext, UUID id, CustomMetric customMetric) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_DATA_PROFILE);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    Table table = repository.addCustomMetric(id, customMetric);
    return addHref(uriInfo, table);
  }

  public Table createCustomMetric(
      UriInfo uriInfo,
      SecurityContext securityContext,
      UUID id,
      CreateCustomMetric createCustomMetric) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_DATA_PROFILE);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    CustomMetric customMetric =
        mapper.createCustomMetricToEntity(
            createCustomMetric, securityContext.getUserPrincipal().getName());
    Table table = repository.addCustomMetric(id, customMetric);
    return addHref(uriInfo, table);
  }

  public Table deleteCustomMetric(
      UriInfo uriInfo,
      SecurityContext securityContext,
      UUID id,
      String columnName,
      String customMetricName) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_TESTS);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    Table table = repository.deleteCustomMetric(id, columnName, customMetricName);
    return addHref(uriInfo, table);
  }

  public ResultList<Column> getTableColumns(
      SecurityContext securityContext,
      UUID id,
      int limit,
      int offset,
      String fieldsParam,
      Include include) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_BASIC);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    return repository.getTableColumns(
        id, limit, offset, fieldsParam, include, authorizer, securityContext);
  }

  public ResultList<Column> getTableColumnsByFQN(
      SecurityContext securityContext,
      String fqn,
      int limit,
      int offset,
      String fieldsParam,
      Include include) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_BASIC);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(fqn));
    return repository.getTableColumnsByFQN(
        fqn, limit, offset, fieldsParam, include, authorizer, securityContext);
  }

  public ResultList<Column> searchTableColumnsById(
      SecurityContext securityContext,
      UUID id,
      String query,
      int limit,
      int offset,
      String fieldsParam,
      Include include) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_BASIC);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    return repository.searchTableColumnsById(
        id, query, limit, offset, fieldsParam, include, authorizer, securityContext);
  }

  public ResultList<Column> searchTableColumnsByFQN(
      SecurityContext securityContext,
      String fqn,
      String query,
      int limit,
      int offset,
      String fieldsParam,
      Include include) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_BASIC);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(fqn));
    return repository.searchTableColumnsByFQN(
        fqn, query, limit, offset, fieldsParam, include, authorizer, securityContext);
  }

  public ResultList<Table> list(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String fieldsParam,
      ListFilter filter,
      int limitParam,
      String before,
      String after) {
    return listInternal(uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
  }

  public Table get(
      UriInfo uriInfo,
      SecurityContext securityContext,
      UUID id,
      String fieldsParam,
      Include include) {
    return getInternal(uriInfo, securityContext, id, fieldsParam, include);
  }

  public Table getByName(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String fqn,
      String fieldsParam,
      Include include) {
    return getByNameInternal(uriInfo, securityContext, fqn, fieldsParam, include);
  }

  public EntityHistory listVersions(SecurityContext securityContext, UUID id) {
    return listVersionsInternal(securityContext, id);
  }

  public Table getVersion(SecurityContext securityContext, UUID id, String version) {
    return getVersionInternal(securityContext, id, version);
  }

  public Response create(UriInfo uriInfo, SecurityContext securityContext, CreateTable create) {
    Table table = mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    return create(uriInfo, securityContext, table);
  }

  public Response createOrUpdate(
      UriInfo uriInfo, SecurityContext securityContext, CreateTable create) {
    Table table = mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    return createOrUpdate(uriInfo, securityContext, table);
  }

  public Response bulkCreateOrUpdate(
      UriInfo uriInfo,
      SecurityContext securityContext,
      List<CreateTable> createRequests,
      boolean async) {
    return processBulkRequest(uriInfo, securityContext, createRequests, mapper, async);
  }

  public Response patchById(
      UriInfo uriInfo,
      SecurityContext securityContext,
      UUID id,
      JsonPatch patch,
      ChangeSource changeSource) {
    return patchInternal(uriInfo, securityContext, id, patch, changeSource);
  }

  public Response patchByName(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String fqn,
      JsonPatch patch,
      ChangeSource changeSource) {
    return patchInternal(uriInfo, securityContext, fqn, patch, changeSource);
  }

  public Response exportCsvAsync(SecurityContext securityContext, String name) {
    return exportCsvInternalAsync(securityContext, name, false);
  }

  public String exportCsv(SecurityContext securityContext, String name) throws IOException {
    return exportCsvInternal(securityContext, name, false);
  }

  public CsvImportResult importCsv(
      SecurityContext securityContext, String name, String csv, boolean dryRun) throws IOException {
    return importCsvInternal(securityContext, name, csv, dryRun, false);
  }

  public Response importCsvAsync(
      SecurityContext securityContext, String name, String csv, boolean dryRun) {
    return importCsvInternalAsync(securityContext, name, csv, dryRun, false);
  }

  public Response deleteById(
      UriInfo uriInfo,
      SecurityContext securityContext,
      UUID id,
      boolean recursive,
      boolean hardDelete) {
    return delete(uriInfo, securityContext, id, recursive, hardDelete);
  }

  public Response deleteByFqn(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String fqn,
      boolean recursive,
      boolean hardDelete) {
    return deleteByName(uriInfo, securityContext, fqn, recursive, hardDelete);
  }

  public Response restore(UriInfo uriInfo, SecurityContext securityContext, UUID id) {
    return restoreEntity(uriInfo, securityContext, id);
  }

  public PutResponse<Table> addFollower(SecurityContext securityContext, UUID id, UUID userId) {
    return repository.addFollower(securityContext.getUserPrincipal().getName(), id, userId);
  }

  public PutResponse<Table> updateVote(
      SecurityContext securityContext, UUID id, VoteRequest request) {
    return repository.updateVote(securityContext.getUserPrincipal().getName(), id, request);
  }

  public PutResponse<Table> deleteFollower(SecurityContext securityContext, UUID id, UUID userId) {
    return super.deleteFollower(securityContext.getUserPrincipal().getName(), id, userId);
  }

  public static class TableList extends ResultList<Table> {
    /* Required for serde */
  }

  public static class TableProfileList extends ResultList<TableProfile> {
    /* Required for serde */
  }

  public static class ColumnProfileList extends ResultList<ColumnProfile> {
    /* Required for serde */
  }

  public static class SystemProfileList extends ResultList<SystemProfile> {
    /* Required for serde */
  }

  public static class TableColumnList extends ResultList<Column> {
    /* Required for serde */
  }
}
