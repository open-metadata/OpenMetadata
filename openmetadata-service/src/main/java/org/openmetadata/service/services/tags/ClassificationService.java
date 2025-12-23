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

package org.openmetadata.service.services.tags;

import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ClassificationRepository;
import org.openmetadata.service.resources.tags.ClassificationMapper;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.services.AbstractEntityService;
import org.openmetadata.service.services.Service;

/**
 * Service layer for Classification entity operations.
 *
 * <p>Extends AbstractEntityService to inherit all standard CRUD operations with proper
 * authorization and repository delegation.
 */
@Slf4j
@Singleton
@Service(entityType = Entity.CLASSIFICATION)
public class ClassificationService extends AbstractEntityService<Classification> {

  @SuppressWarnings("unused")
  private final ClassificationMapper mapper;

  @Inject
  public ClassificationService(
      ClassificationRepository repository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      ClassificationMapper mapper) {
    super(repository, searchRepository, authorizer, Entity.CLASSIFICATION);
    this.mapper = mapper;
  }
}
