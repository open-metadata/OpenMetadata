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

import static org.openmetadata.common.utils.CommonUtil.listOf;

import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.util.List;
import java.util.UUID;
import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.services.MlModelService;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.entity.services.connections.TestConnectionResult;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.MlModelConnection;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.MlModelServiceRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.ServiceEntityInfo;
import org.openmetadata.service.resources.services.ServiceEntityResource;
import org.openmetadata.service.resources.services.mlmodel.MlModelServiceMapper;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.services.Service;

@Slf4j
@Singleton
@Service(entityType = Entity.MLMODEL_SERVICE)
public class MlModelServiceEntityService
    extends ServiceEntityResource<MlModelService, MlModelServiceRepository, MlModelConnection> {
  public static final String FIELDS = "pipelines,owners,tags,domains,followers";

  @Getter private final MlModelServiceMapper mapper = new MlModelServiceMapper();

  @Inject
  public MlModelServiceEntityService(
      MlModelServiceRepository repository, Authorizer authorizer, Limits limits) {
    super(
        new ServiceEntityInfo<>(Entity.MLMODEL_SERVICE, ServiceType.ML_MODEL, MlModelService.class),
        repository,
        authorizer,
        limits);
  }

  @Override
  public MlModelService addHref(UriInfo uriInfo, MlModelService mlModelService) {
    super.addHref(uriInfo, mlModelService);
    Entity.withHref(uriInfo, mlModelService.getPipelines());
    return mlModelService;
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    addViewOperation("pipelines", MetadataOperation.VIEW_BASIC);
    return listOf(MetadataOperation.VIEW_USAGE, MetadataOperation.EDIT_USAGE);
  }

  @Override
  protected MlModelService nullifyConnection(MlModelService service) {
    return service.withConnection(null);
  }

  @Override
  protected String extractServiceType(MlModelService service) {
    return service.getServiceType().value();
  }

  public MlModelService addTestConnectionResult(
      SecurityContext securityContext, UUID serviceId, TestConnectionResult testConnectionResult) {
    OperationContext operationContext =
        new OperationContext(getEntityType(), MetadataOperation.CREATE);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(serviceId));
    MlModelService service = repository.addTestConnectionResult(serviceId, testConnectionResult);
    return decryptOrNullify(securityContext, service);
  }

  public static class MlModelServiceList extends ResultList<MlModelService> {
    /* Required for serde */
  }
}
