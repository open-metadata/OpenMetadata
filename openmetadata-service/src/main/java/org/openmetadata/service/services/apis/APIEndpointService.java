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

package org.openmetadata.service.services.apis;

import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.data.APIEndpoint;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.APIEndpointRepository;
import org.openmetadata.service.resources.apis.APIEndpointMapper;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.services.AbstractEntityService;
import org.openmetadata.service.services.Service;

/**
 * Service layer for APIEndpoint entity operations.
 *
 * <p>Extends AbstractEntityService to inherit all standard CRUD operations with proper
 * authorization and repository delegation.
 */
@Slf4j
@Singleton
@Service(entityType = Entity.API_ENDPOINT)
public class APIEndpointService extends AbstractEntityService<APIEndpoint> {

  @SuppressWarnings("unused")
  private final APIEndpointMapper mapper;

  @Inject
  public APIEndpointService(
      APIEndpointRepository repository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      APIEndpointMapper mapper) {
    super(repository, searchRepository, authorizer, Entity.API_ENDPOINT);
    this.mapper = mapper;
  }
}
