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

import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.util.List;
import java.util.UUID;
import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.data.CreateTableProfile;
import org.openmetadata.schema.api.tests.CreateCustomMetric;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.CustomMetric;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnProfile;
import org.openmetadata.schema.type.DataModel;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.PipelineObservability;
import org.openmetadata.schema.type.SystemProfile;
import org.openmetadata.schema.type.TableData;
import org.openmetadata.schema.type.TableJoins;
import org.openmetadata.schema.type.TableProfile;
import org.openmetadata.schema.type.TableProfilerConfig;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.TableRepository;
import org.openmetadata.service.resources.databases.TableMapper;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.services.AbstractEntityService;
import org.openmetadata.service.services.Service;
import org.openmetadata.service.util.RestUtil;

@Slf4j
@Singleton
@Service(entityType = Entity.TABLE)
public class TableService extends AbstractEntityService<Table> {

  @Getter private final TableMapper mapper;
  private final TableRepository tableRepository;

  @Inject
  public TableService(
      TableRepository repository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      TableMapper mapper) {
    super(repository, searchRepository, authorizer, Entity.TABLE);
    this.tableRepository = repository;
    this.mapper = mapper;
  }

  public Table addJoins(
      UriInfo uriInfo, SecurityContext securityContext, UUID id, TableJoins joins) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    Table table = tableRepository.addJoins(id, joins);
    return addHref(uriInfo, table);
  }

  public Table addSampleData(
      UriInfo uriInfo, SecurityContext securityContext, UUID id, TableData tableData) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_SAMPLE_DATA);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    Table table = tableRepository.addSampleData(id, tableData);
    return addHref(uriInfo, table);
  }

  public Table getSampleData(UriInfo uriInfo, SecurityContext securityContext, UUID id) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_SAMPLE_DATA);
    ResourceContext<?> resourceContext = getResourceContextById(id);
    authorizer.authorize(securityContext, operationContext, resourceContext);
    boolean authorizePII = authorizer.authorizePII(securityContext, resourceContext.getOwners());
    Table table = tableRepository.getSampleData(id, authorizePII);
    return addHref(uriInfo, table);
  }

  public Table deleteSampleData(UriInfo uriInfo, SecurityContext securityContext, UUID id) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_SAMPLE_DATA);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    Table table = tableRepository.deleteSampleData(id);
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
    Table table = tableRepository.addPipelineObservability(id, pipelineObservability);
    return addHref(uriInfo, table);
  }

  public List<PipelineObservability> getPipelineObservability(
      SecurityContext securityContext, UUID id) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    return tableRepository.getPipelineObservability(id);
  }

  public List<PipelineObservability> getPipelineObservabilityByName(
      SecurityContext securityContext, String fqn) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(fqn));
    return tableRepository.getPipelineObservabilityByName(fqn);
  }

  public Table deletePipelineObservability(
      UriInfo uriInfo, SecurityContext securityContext, UUID id) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    Table table = tableRepository.deletePipelineObservability(id);
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
    Table table = tableRepository.addSinglePipelineObservability(id, pipelineObservability);
    return addHref(uriInfo, table);
  }

  public Table deleteSinglePipelineObservability(
      UriInfo uriInfo, SecurityContext securityContext, UUID id, String pipelineFqn) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    Table table = tableRepository.deleteSinglePipelineObservability(id, pipelineFqn);
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
    Table table = tableRepository.addTableProfilerConfig(id, tableProfilerConfig);
    return addHref(uriInfo, table);
  }

  public Table getTableProfilerConfig(UriInfo uriInfo, SecurityContext securityContext, UUID id) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_DATA_PROFILE);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    Table table = tableRepository.find(id, Include.NON_DELETED);
    return addHref(
        uriInfo, table.withTableProfilerConfig(tableRepository.getTableProfilerConfig(table)));
  }

  public Table deleteTableProfilerConfig(
      UriInfo uriInfo, SecurityContext securityContext, UUID id) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_DATA_PROFILE);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    Table table = tableRepository.deleteTableProfilerConfig(id);
    return addHref(uriInfo, table);
  }

  public Table getLatestTableProfile(
      String fqn, boolean includeColumnProfile, SecurityContext securityContext) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_DATA_PROFILE);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(fqn));
    return tableRepository.getLatestTableProfile(
        fqn, includeColumnProfile, authorizer, securityContext);
  }

  public ResultList<TableProfile> getTableProfiles(
      SecurityContext securityContext, String fqn, Long startTs, Long endTs) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_DATA_PROFILE);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(fqn));
    return tableRepository.getTableProfiles(fqn, startTs, endTs);
  }

  public ResultList<ColumnProfile> getColumnProfiles(
      SecurityContext securityContext, String fqn, String tableFqn, Long startTs, Long endTs) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_DATA_PROFILE);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(tableFqn));
    return tableRepository.getColumnProfiles(fqn, startTs, endTs, authorizer, securityContext);
  }

  public ResultList<SystemProfile> getSystemProfiles(String fqn, Long startTs, Long endTs) {
    return tableRepository.getSystemProfiles(fqn, startTs, endTs);
  }

  public Table addTableProfileData(
      UriInfo uriInfo,
      SecurityContext securityContext,
      UUID id,
      CreateTableProfile createTableProfile) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_DATA_PROFILE);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    Table table = tableRepository.addTableProfileData(id, createTableProfile);
    return addHref(uriInfo, table);
  }

  public void deleteTableProfile(
      SecurityContext securityContext, String fqn, String profileEntityType, Long timestamp) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_DATA_PROFILE);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(fqn));
    tableRepository.deleteTableProfile(fqn, profileEntityType, timestamp);
  }

  public Table addDataModel(
      UriInfo uriInfo, SecurityContext securityContext, UUID id, DataModel dataModel) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    Table table = tableRepository.addDataModel(id, dataModel);
    return addHref(uriInfo, table);
  }

  public Table addCustomMetric(
      UriInfo uriInfo, SecurityContext securityContext, UUID id, CustomMetric customMetric) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_DATA_PROFILE);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    Table table = tableRepository.addCustomMetric(id, customMetric);
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
    Table table = tableRepository.addCustomMetric(id, customMetric);
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
    Table table = tableRepository.deleteCustomMetric(id, columnName, customMetricName);
    return addHref(uriInfo, table);
  }

  public RestUtil.PutResponse<Table> addFollower(
      SecurityContext securityContext, UUID id, UUID userId) {
    return tableRepository.addFollower(securityContext.getUserPrincipal().getName(), id, userId);
  }

  public RestUtil.PutResponse<Table> deleteFollower(
      SecurityContext securityContext, UUID id, UUID userId) {
    return tableRepository.deleteFollower(securityContext.getUserPrincipal().getName(), id, userId);
  }

  public RestUtil.PutResponse<Table> updateVote(
      SecurityContext securityContext, UUID id, org.openmetadata.schema.api.VoteRequest request) {
    return tableRepository.updateVote(securityContext.getUserPrincipal().getName(), id, request);
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
    return tableRepository.getTableColumns(
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
    return tableRepository.getTableColumnsByFQN(
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
    return tableRepository.searchTableColumnsById(
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
    return tableRepository.searchTableColumnsByFQN(
        fqn, query, limit, offset, fieldsParam, include, authorizer, securityContext);
  }

  private Table addHref(UriInfo uriInfo, Table table) {
    Entity.withHref(uriInfo, table.getOwners());
    Entity.withHref(uriInfo, table.getFollowers());
    Entity.withHref(uriInfo, table.getDatabaseSchema());
    Entity.withHref(uriInfo, table.getDatabase());
    Entity.withHref(uriInfo, table.getService());
    return table;
  }
}
