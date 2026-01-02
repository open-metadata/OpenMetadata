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

package org.openmetadata.service.services.ml;

import static org.openmetadata.common.utils.CommonUtil.listOf;

import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.util.List;
import java.util.UUID;
import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.VoteRequest;
import org.openmetadata.schema.api.data.CreateMlModel;
import org.openmetadata.schema.entity.data.MlModel;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.MlModelRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.mapper.EntityMapper;
import org.openmetadata.service.resources.EntityBaseService;
import org.openmetadata.service.resources.ResourceEntityInfo;
import org.openmetadata.service.resources.mlmodels.MlModelMapper;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.services.Service;
import org.openmetadata.service.util.RestUtil;

@Slf4j
@Singleton
@Service(entityType = Entity.MLMODEL)
public class MlModelService extends EntityBaseService<MlModel, MlModelRepository> {

  @Getter private final MlModelMapper mapper;
  public static final String FIELDS =
      "owners,dashboard,followers,tags,usageSummary,extension,domains,sourceHash";

  @Inject
  public MlModelService(
      MlModelRepository repository, Authorizer authorizer, MlModelMapper mapper, Limits limits) {
    super(new ResourceEntityInfo<>(Entity.MLMODEL, MlModel.class), repository, authorizer, limits);
    this.mapper = mapper;
  }

  @Override
  public MlModel addHref(UriInfo uriInfo, MlModel mlmodel) {
    super.addHref(uriInfo, mlmodel);
    Entity.withHref(uriInfo, mlmodel.getDashboard());
    Entity.withHref(uriInfo, mlmodel.getService());
    return mlmodel;
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    addViewOperation("dashboard", MetadataOperation.VIEW_BASIC);
    addViewOperation("usageSummary", MetadataOperation.VIEW_USAGE);
    return listOf(MetadataOperation.VIEW_USAGE, MetadataOperation.EDIT_USAGE);
  }

  public RestUtil.PutResponse<MlModel> addFollower(
      SecurityContext securityContext, UUID id, UUID userId) {
    return addFollower(securityContext.getUserPrincipal().getName(), id, userId);
  }

  public RestUtil.PutResponse<MlModel> deleteFollower(
      SecurityContext securityContext, UUID id, UUID userId) {
    return deleteFollower(securityContext.getUserPrincipal().getName(), id, userId);
  }

  public Response updateVote(SecurityContext securityContext, UUID id, VoteRequest request) {
    return repository
        .updateVote(securityContext.getUserPrincipal().getName(), id, request)
        .toResponse();
  }

  public Response bulkCreateOrUpdate(
      UriInfo uriInfo,
      SecurityContext securityContext,
      List<CreateMlModel> createRequests,
      EntityMapper<MlModel, CreateMlModel> entityMapper,
      boolean async) {
    return processBulkRequest(uriInfo, securityContext, createRequests, entityMapper, async);
  }

  public static class MlModelList extends ResultList<MlModel> {
    /* Required for serde */
  }
}
