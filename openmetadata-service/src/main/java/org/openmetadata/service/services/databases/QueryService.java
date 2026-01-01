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
import java.util.UUID;
import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.VoteRequest;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.QueryRepository;
import org.openmetadata.service.resources.query.QueryMapper;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.services.AbstractEntityService;
import org.openmetadata.service.services.Service;
import org.openmetadata.service.util.RestUtil;

@Slf4j
@Singleton
@Service(entityType = Entity.QUERY)
public class QueryService extends AbstractEntityService<Query> {

  @Getter private final QueryMapper mapper;
  private final QueryRepository queryRepository;

  @Inject
  public QueryService(
      QueryRepository repository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      QueryMapper mapper) {
    super(repository, searchRepository, authorizer, Entity.QUERY);
    this.queryRepository = repository;
    this.mapper = mapper;
  }

  public RestUtil.PutResponse<Query> addFollower(
      SecurityContext securityContext, UUID id, UUID userId) {
    return queryRepository.addFollower(securityContext.getUserPrincipal().getName(), id, userId);
  }

  public RestUtil.PutResponse<Query> deleteFollower(
      SecurityContext securityContext, UUID id, UUID userId) {
    return queryRepository.deleteFollower(securityContext.getUserPrincipal().getName(), id, userId);
  }

  public RestUtil.PutResponse<Query> updateVote(
      SecurityContext securityContext, UUID id, VoteRequest request) {
    return queryRepository.updateVote(securityContext.getUserPrincipal().getName(), id, request);
  }
}
