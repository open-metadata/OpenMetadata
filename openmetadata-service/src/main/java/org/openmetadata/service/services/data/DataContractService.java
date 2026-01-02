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

package org.openmetadata.service.services.data;

import static org.openmetadata.service.jdbi3.DataContractRepository.RESULT_EXTENSION;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.util.List;
import java.util.UUID;
import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.datacontract.DataContractResult;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSDataContract;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.clients.pipeline.PipelineServiceClientFactory;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.DataContractRepository;
import org.openmetadata.service.jdbi3.EntityTimeSeriesDAO;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.EntityBaseService;
import org.openmetadata.service.resources.ResourceEntityInfo;
import org.openmetadata.service.resources.data.DataContractMapper;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.services.Service;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.ODCSConverter;
import org.openmetadata.service.util.RestUtil;

@Slf4j
@Singleton
@Service(entityType = Entity.DATA_CONTRACT)
public class DataContractService extends EntityBaseService<DataContract, DataContractRepository> {

  @Getter private final DataContractMapper mapper;
  public static final String FIELDS = "owners,reviewers,extension";

  @Override
  public void initialize(OpenMetadataApplicationConfig config) {
    PipelineServiceClientInterface pipelineServiceClient =
        PipelineServiceClientFactory.createPipelineServiceClient(
            config.getPipelineServiceClientConfiguration());
    repository.setPipelineServiceClient(pipelineServiceClient);
  }

  @Override
  public DataContract addHref(UriInfo uriInfo, DataContract dataContract) {
    super.addHref(uriInfo, dataContract);
    Entity.withHref(uriInfo, dataContract.getOwners());
    Entity.withHref(uriInfo, dataContract.getReviewers());
    Entity.withHref(uriInfo, dataContract.getEntity());
    return dataContract;
  }

  @Inject
  public DataContractService(
      DataContractRepository repository,
      Authorizer authorizer,
      DataContractMapper mapper,
      Limits limits) {
    super(
        new ResourceEntityInfo<>(Entity.DATA_CONTRACT, DataContract.class),
        repository,
        authorizer,
        limits);
    this.mapper = mapper;
  }

  public DataContract getByEntityId(
      UriInfo uriInfo,
      SecurityContext securityContext,
      UUID entityId,
      String entityType,
      String fieldsParam) {
    authorizer.authorize(
        securityContext,
        new OperationContext(entityType, MetadataOperation.VIEW_ALL),
        getResourceContextById(entityId));
    DataContract dataContract =
        repository.loadEntityDataContract(
            new EntityReference().withId(entityId).withType(entityType));
    if (dataContract == null) {
      throw EntityNotFoundException.byMessage(
          String.format("Data contract for entity %s is not found", entityId));
    }
    return addHref(uriInfo, repository.setFieldsInternal(dataContract, getFields(fieldsParam)));
  }

  public ResultList<DataContractResult> listResults(
      UriInfo uriInfo,
      SecurityContext securityContext,
      UUID id,
      int limitParam,
      Long startTs,
      Long endTs) {
    DataContract dataContract = repository.get(uriInfo, id, Fields.EMPTY_FIELDS);
    authorizeViewBasic(securityContext, id);

    EntityTimeSeriesDAO timeSeriesDAO = Entity.getCollectionDAO().entityExtensionTimeSeriesDao();
    List<String> jsonResults =
        timeSeriesDAO.listBetweenTimestampsByOrder(
            dataContract.getFullyQualifiedName(),
            "dataContract.dataContractResult",
            startTs != null ? startTs : 0L,
            endTs != null ? endTs : System.currentTimeMillis(),
            EntityTimeSeriesDAO.OrderBy.DESC);

    List<DataContractResult> results = JsonUtils.readObjects(jsonResults, DataContractResult.class);

    if (limitParam > 0 && results.size() > limitParam) {
      results = results.subList(0, limitParam);
    }

    return new ResultList<>(
        results, String.valueOf(startTs), String.valueOf(endTs), results.size());
  }

  public DataContractResult getLatestResult(
      UriInfo uriInfo, SecurityContext securityContext, UUID id) {
    DataContract dataContract = repository.get(uriInfo, id, Fields.EMPTY_FIELDS);
    authorizeViewBasic(securityContext, id);

    EntityTimeSeriesDAO timeSeriesDAO = Entity.getCollectionDAO().entityExtensionTimeSeriesDao();
    String jsonRecord =
        timeSeriesDAO.getLatestExtension(dataContract.getFullyQualifiedName(), RESULT_EXTENSION);

    return jsonRecord != null ? JsonUtils.readValue(jsonRecord, DataContractResult.class) : null;
  }

  public DataContractResult getResult(
      UriInfo uriInfo, SecurityContext securityContext, UUID id, UUID resultId) {
    DataContract dataContract = repository.get(uriInfo, id, Fields.EMPTY_FIELDS);
    authorizeViewBasic(securityContext, id);
    return repository.getLatestResult(dataContract);
  }

  public Response createResult(
      UriInfo uriInfo, SecurityContext securityContext, UUID id, DataContractResult newResult) {
    DataContract dataContract = repository.get(uriInfo, id, Fields.EMPTY_FIELDS);
    authorizeEditAll(securityContext, id);

    DataContractResult result = prepareContractResult(dataContract, newResult);
    return repository.addContractResult(dataContract, result).toResponse();
  }

  public Response deleteResult(
      UriInfo uriInfo, SecurityContext securityContext, UUID id, Long timestamp) {
    DataContract dataContract = repository.get(uriInfo, id, Fields.EMPTY_FIELDS);
    authorizeDelete(securityContext, id);

    EntityTimeSeriesDAO timeSeriesDAO = Entity.getCollectionDAO().entityExtensionTimeSeriesDao();
    timeSeriesDAO.deleteAtTimestamp(
        dataContract.getFullyQualifiedName(), "dataContract.dataContractResult", timestamp);
    return Response.ok().build();
  }

  public Response deleteResultsBefore(
      UriInfo uriInfo, SecurityContext securityContext, UUID id, Long timestamp) {
    DataContract dataContract = repository.get(uriInfo, id, Fields.EMPTY_FIELDS);
    authorizeDelete(securityContext, id);

    EntityTimeSeriesDAO timeSeriesDAO = Entity.getCollectionDAO().entityExtensionTimeSeriesDao();
    timeSeriesDAO.deleteBeforeTimestamp(
        dataContract.getFullyQualifiedName(), "dataContract.dataContractResult", timestamp);
    return Response.ok().build();
  }

  public Response validateContract(UriInfo uriInfo, SecurityContext securityContext, UUID id) {
    DataContract dataContract = repository.get(uriInfo, id, Fields.EMPTY_FIELDS);
    authorizeEditAll(securityContext, id);

    RestUtil.PutResponse<DataContractResult> result = repository.validateContract(dataContract);
    return result.toResponse();
  }

  public ODCSDataContract exportToODCS(
      UriInfo uriInfo, SecurityContext securityContext, UUID id, String fieldsParam) {
    DataContract dataContract =
        getInternal(uriInfo, securityContext, id, fieldsParam, Include.NON_DELETED);
    return ODCSConverter.toODCS(dataContract);
  }

  public Response exportToODCSYaml(
      UriInfo uriInfo, SecurityContext securityContext, UUID id, String fieldsParam) {
    DataContract dataContract =
        getInternal(uriInfo, securityContext, id, fieldsParam, Include.NON_DELETED);
    ODCSDataContract odcs = ODCSConverter.toODCS(dataContract);
    try {
      ObjectMapper yamlMapper = new ObjectMapper(new YAMLFactory());
      yamlMapper.setSerializationInclusion(
          com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL);
      String yamlContent = yamlMapper.writeValueAsString(odcs);
      return Response.ok(yamlContent, "application/yaml").build();
    } catch (Exception e) {
      throw new IllegalArgumentException("Failed to convert to YAML: " + e.getMessage(), e);
    }
  }

  public ODCSDataContract exportToODCSByFqn(
      UriInfo uriInfo, SecurityContext securityContext, String fqn, String fieldsParam) {
    DataContract dataContract =
        getByNameInternal(uriInfo, securityContext, fqn, fieldsParam, Include.NON_DELETED);
    return ODCSConverter.toODCS(dataContract);
  }

  public Response importFromODCS(
      UriInfo uriInfo,
      SecurityContext securityContext,
      UUID entityId,
      String entityType,
      ODCSDataContract odcs) {
    EntityReference entityRef = new EntityReference().withId(entityId).withType(entityType);
    DataContract dataContract = ODCSConverter.fromODCS(odcs, entityRef);
    dataContract.setUpdatedBy(securityContext.getUserPrincipal().getName());
    dataContract.setUpdatedAt(System.currentTimeMillis());
    return create(uriInfo, securityContext, dataContract);
  }

  public Response importFromODCSYaml(
      UriInfo uriInfo,
      SecurityContext securityContext,
      UUID entityId,
      String entityType,
      String yamlContent) {
    try {
      ObjectMapper yamlMapper = new ObjectMapper(new YAMLFactory());
      ODCSDataContract odcs = yamlMapper.readValue(yamlContent, ODCSDataContract.class);
      return importFromODCS(uriInfo, securityContext, entityId, entityType, odcs);
    } catch (Exception e) {
      throw new IllegalArgumentException("Invalid ODCS YAML content: " + e.getMessage(), e);
    }
  }

  public Response createOrUpdateFromODCS(
      UriInfo uriInfo,
      SecurityContext securityContext,
      UUID entityId,
      String entityType,
      ODCSDataContract odcs) {
    EntityReference entityRef = new EntityReference().withId(entityId).withType(entityType);
    DataContract dataContract = ODCSConverter.fromODCS(odcs, entityRef);
    dataContract.setUpdatedBy(securityContext.getUserPrincipal().getName());
    dataContract.setUpdatedAt(System.currentTimeMillis());
    return createOrUpdate(uriInfo, securityContext, dataContract);
  }

  public Response createOrUpdateFromODCSYaml(
      UriInfo uriInfo,
      SecurityContext securityContext,
      UUID entityId,
      String entityType,
      String yamlContent) {
    try {
      ObjectMapper yamlMapper = new ObjectMapper(new YAMLFactory());
      ODCSDataContract odcs = yamlMapper.readValue(yamlContent, ODCSDataContract.class);
      return createOrUpdateFromODCS(uriInfo, securityContext, entityId, entityType, odcs);
    } catch (Exception e) {
      throw new IllegalArgumentException("Invalid ODCS YAML content: " + e.getMessage(), e);
    }
  }

  private DataContractResult prepareContractResult(
      DataContract dataContract, DataContractResult newResult) {
    return newResult
        .withId(newResult.getId() == null ? UUID.randomUUID() : newResult.getId())
        .withDataContractFQN(dataContract.getFullyQualifiedName());
  }

  private void authorizeViewBasic(SecurityContext securityContext, UUID id) {
    OperationContext operationContext =
        new OperationContext(Entity.DATA_CONTRACT, MetadataOperation.VIEW_BASIC);
    ResourceContext<DataContract> resourceContext =
        new ResourceContext<>(Entity.DATA_CONTRACT, id, null);
    authorizer.authorize(securityContext, operationContext, resourceContext);
  }

  private void authorizeEditAll(SecurityContext securityContext, UUID id) {
    OperationContext operationContext =
        new OperationContext(Entity.DATA_CONTRACT, MetadataOperation.EDIT_ALL);
    ResourceContext<DataContract> resourceContext =
        new ResourceContext<>(Entity.DATA_CONTRACT, id, null);
    authorizer.authorize(securityContext, operationContext, resourceContext);
  }

  private void authorizeDelete(SecurityContext securityContext, UUID id) {
    OperationContext operationContext =
        new OperationContext(Entity.DATA_CONTRACT, MetadataOperation.DELETE);
    ResourceContext<DataContract> resourceContext =
        new ResourceContext<>(Entity.DATA_CONTRACT, id, null);
    authorizer.authorize(securityContext, operationContext, resourceContext);
  }

  public static class DataContractList extends ResultList<DataContract> {
    @SuppressWarnings("unused")
    public DataContractList() {
      /* Required for serde */
    }
  }
}
