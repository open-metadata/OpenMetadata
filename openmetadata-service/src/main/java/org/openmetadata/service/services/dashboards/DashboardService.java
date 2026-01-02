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

package org.openmetadata.service.services.dashboards;

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
import org.openmetadata.schema.CreateEntity;
import org.openmetadata.schema.api.VoteRequest;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.DashboardRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.mapper.EntityMapper;
import org.openmetadata.service.resources.EntityBaseService;
import org.openmetadata.service.resources.ResourceEntityInfo;
import org.openmetadata.service.resources.dashboards.DashboardMapper;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.services.Service;
import org.openmetadata.service.util.RestUtil;

@Slf4j
@Singleton
@Service(entityType = Entity.DASHBOARD)
public class DashboardService extends EntityBaseService<Dashboard, DashboardRepository> {

  @Getter private final DashboardMapper mapper;
  public static final String FIELDS =
      "owners,charts,followers,tags,usageSummary,extension,dataModels,domains,dataProducts,sourceHash";

  @Inject
  public DashboardService(
      DashboardRepository repository,
      Authorizer authorizer,
      DashboardMapper mapper,
      Limits limits) {
    super(
        new ResourceEntityInfo<>(Entity.DASHBOARD, Dashboard.class),
        repository,
        authorizer,
        limits);
    this.mapper = mapper;
  }

  @Override
  public Dashboard addHref(UriInfo uriInfo, Dashboard dashboard) {
    super.addHref(uriInfo, dashboard);
    Entity.withHref(uriInfo, dashboard.getService());
    Entity.withHref(uriInfo, dashboard.getCharts());
    Entity.withHref(uriInfo, dashboard.getDataModels());
    return dashboard;
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    addViewOperation("charts,dataModels", MetadataOperation.VIEW_BASIC);
    addViewOperation("usageSummary", MetadataOperation.VIEW_USAGE);
    return listOf(MetadataOperation.VIEW_USAGE, MetadataOperation.EDIT_LINEAGE);
  }

  public RestUtil.PutResponse<Dashboard> addFollower(
      SecurityContext securityContext, UUID id, UUID userId) {
    return addFollower(securityContext.getUserPrincipal().getName(), id, userId);
  }

  public RestUtil.PutResponse<Dashboard> deleteFollower(
      SecurityContext securityContext, UUID id, UUID userId) {
    return deleteFollower(securityContext.getUserPrincipal().getName(), id, userId);
  }

  public RestUtil.PutResponse<Dashboard> updateVote(
      SecurityContext securityContext, UUID id, VoteRequest request) {
    return getRepository().updateVote(securityContext.getUserPrincipal().getName(), id, request);
  }

  public <C extends CreateEntity> Response processBulkRequest(
      UriInfo uriInfo,
      SecurityContext securityContext,
      List<C> createRequests,
      EntityMapper<Dashboard, C> mapper,
      boolean async) {
    return super.processBulkRequest(uriInfo, securityContext, createRequests, mapper, async);
  }

  public static class DashboardList extends ResultList<Dashboard> {
    /* Required for serde */
  }
}
