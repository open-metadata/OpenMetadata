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
import org.openmetadata.schema.api.VoteRequest;
import org.openmetadata.schema.api.data.CreateChart;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ChartRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.mapper.EntityMapper;
import org.openmetadata.service.resources.EntityBaseService;
import org.openmetadata.service.resources.ResourceEntityInfo;
import org.openmetadata.service.resources.charts.ChartMapper;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.services.Service;
import org.openmetadata.service.util.RestUtil;

@Slf4j
@Singleton
@Service(entityType = Entity.CHART)
public class ChartService extends EntityBaseService<Chart, ChartRepository> {

  @Getter private final ChartMapper mapper;
  public static final String FIELDS =
      "owners,followers,tags,domains,dataProducts,sourceHash,dashboards,extension";

  @Inject
  public ChartService(
      ChartRepository repository, Authorizer authorizer, ChartMapper mapper, Limits limits) {
    super(new ResourceEntityInfo<>(Entity.CHART, Chart.class), repository, authorizer, limits);
    this.mapper = mapper;
  }

  @Override
  public Chart addHref(UriInfo uriInfo, Chart chart) {
    super.addHref(uriInfo, chart);
    Entity.withHref(uriInfo, chart.getService());
    return chart;
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    addViewOperation("usageSummary", MetadataOperation.VIEW_USAGE);
    return listOf(MetadataOperation.VIEW_USAGE, MetadataOperation.EDIT_LINEAGE);
  }

  public RestUtil.PutResponse<Chart> addFollower(
      SecurityContext securityContext, UUID id, UUID userId) {
    return addFollower(securityContext.getUserPrincipal().getName(), id, userId);
  }

  public RestUtil.PutResponse<Chart> deleteFollower(
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
      List<CreateChart> createRequests,
      EntityMapper<Chart, CreateChart> entityMapper,
      boolean async) {
    return processBulkRequest(uriInfo, securityContext, createRequests, entityMapper, async);
  }

  public static class ChartList extends ResultList<Chart> {
    /* Required for serde */
  }
}
