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

package org.openmetadata.service.services.metrics;

import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.VoteRequest;
import org.openmetadata.schema.api.data.CreateMetric;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.MetricRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.mapper.EntityMapper;
import org.openmetadata.service.resources.EntityBaseService;
import org.openmetadata.service.resources.ResourceEntityInfo;
import org.openmetadata.service.resources.metrics.MetricMapper;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.services.Service;
import org.openmetadata.service.util.RestUtil;

@Slf4j
@Singleton
@Service(entityType = Entity.METRIC)
public class MetricService extends EntityBaseService<Metric, MetricRepository> {

  @Getter private final MetricMapper mapper;
  public static final String FIELDS =
      "owners,reviewers,relatedMetrics,followers,tags,extension,domains,dataProducts";

  @Inject
  public MetricService(
      MetricRepository repository, Authorizer authorizer, MetricMapper mapper, Limits limits) {
    super(new ResourceEntityInfo<>(Entity.METRIC, Metric.class), repository, authorizer, limits);
    this.mapper = mapper;
  }

  @Override
  public Metric addHref(UriInfo uriInfo, Metric metric) {
    super.addHref(uriInfo, metric);
    Entity.withHref(uriInfo, metric.getRelatedMetrics());
    return metric;
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    addViewOperation("relatedMetrics", MetadataOperation.VIEW_BASIC);
    return Collections.emptyList();
  }

  public RestUtil.PutResponse<Metric> addFollower(
      SecurityContext securityContext, UUID id, UUID userId) {
    return addFollower(securityContext.getUserPrincipal().getName(), id, userId);
  }

  public RestUtil.PutResponse<Metric> deleteFollower(
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
      List<CreateMetric> createRequests,
      EntityMapper<Metric, CreateMetric> entityMapper,
      boolean async) {
    return processBulkRequest(uriInfo, securityContext, createRequests, entityMapper, async);
  }

  public List<String> getDistinctCustomUnitsOfMeasurement() {
    return repository.getDistinctCustomUnitsOfMeasurement();
  }

  public static class MetricsList extends ResultList<Metric> {
    /* Required for serde */
  }
}
