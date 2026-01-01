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

import jakarta.ws.rs.core.SecurityContext;
import java.util.UUID;
import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.VoteRequest;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ChartRepository;
import org.openmetadata.service.resources.charts.ChartMapper;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.services.AbstractEntityService;
import org.openmetadata.service.services.Service;
import org.openmetadata.service.util.RestUtil;

@Slf4j
@Singleton
@Service(entityType = Entity.CHART)
public class ChartService extends AbstractEntityService<Chart> {

  @Getter private final ChartMapper mapper;
  private final ChartRepository chartRepository;

  @Inject
  public ChartService(
      ChartRepository repository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      ChartMapper mapper) {
    super(repository, searchRepository, authorizer, Entity.CHART);
    this.chartRepository = repository;
    this.mapper = mapper;
  }

  public RestUtil.PutResponse<Chart> addFollower(
      SecurityContext securityContext, UUID id, UUID userId) {
    return chartRepository.addFollower(securityContext.getUserPrincipal().getName(), id, userId);
  }

  public RestUtil.PutResponse<Chart> deleteFollower(
      SecurityContext securityContext, UUID id, UUID userId) {
    return chartRepository.deleteFollower(securityContext.getUserPrincipal().getName(), id, userId);
  }

  public RestUtil.PutResponse<Chart> updateVote(
      SecurityContext securityContext, UUID id, VoteRequest request) {
    return chartRepository.updateVote(securityContext.getUserPrincipal().getName(), id, request);
  }
}
