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

package org.openmetadata.service.services.serviceentities;

import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.util.List;
import java.util.UUID;
import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.services.PipelineService;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.entity.services.connections.TestConnectionResult;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.PipelineConnection;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.PipelineServiceRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.ServiceEntityInfo;
import org.openmetadata.service.resources.services.ServiceEntityResource;
import org.openmetadata.service.resources.services.pipeline.PipelineServiceMapper;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.services.Service;

@Slf4j
@Singleton
@Service(entityType = Entity.PIPELINE_SERVICE)
public class PipelineServiceEntityService
    extends ServiceEntityResource<PipelineService, PipelineServiceRepository, PipelineConnection> {
  public static final String FIELDS = "pipelines,owners,domains,followers";

  @Getter private final PipelineServiceMapper mapper = new PipelineServiceMapper();

  @Inject
  public PipelineServiceEntityService(
      PipelineServiceRepository repository, Authorizer authorizer, Limits limits) {
    super(
        new ServiceEntityInfo<>(
            Entity.PIPELINE_SERVICE, ServiceType.PIPELINE, PipelineService.class),
        repository,
        authorizer,
        limits);
  }

  @Override
  public PipelineService addHref(UriInfo uriInfo, PipelineService pipelineService) {
    super.addHref(uriInfo, pipelineService);
    Entity.withHref(uriInfo, pipelineService.getPipelines());
    return pipelineService;
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    addViewOperation("pipelines", MetadataOperation.VIEW_BASIC);
    return null;
  }

  @Override
  protected PipelineService nullifyConnection(PipelineService service) {
    return service.withConnection(null);
  }

  @Override
  protected String extractServiceType(PipelineService service) {
    return service.getServiceType().value();
  }

  public PipelineService addTestConnectionResult(
      SecurityContext securityContext, UUID serviceId, TestConnectionResult testConnectionResult) {
    OperationContext operationContext =
        new OperationContext(getEntityType(), MetadataOperation.CREATE);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(serviceId));
    PipelineService service = repository.addTestConnectionResult(serviceId, testConnectionResult);
    return decryptOrNullify(securityContext, service);
  }

  public static class PipelineServiceList extends ResultList<PipelineService> {
    /* Required for serde */
  }
}
