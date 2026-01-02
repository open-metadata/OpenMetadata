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

package org.openmetadata.service.services.glossary;

import java.util.UUID;
import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.VoteRequest;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.GlossaryRepository;
import org.openmetadata.service.resources.glossary.GlossaryMapper;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.services.AbstractEntityService;
import org.openmetadata.service.services.Service;
import org.openmetadata.service.util.RestUtil;

@Slf4j
@Singleton
@Service(entityType = Entity.GLOSSARY)
public class GlossaryService extends AbstractEntityService<Glossary> {

  @Getter private final GlossaryMapper mapper;
  private final GlossaryRepository glossaryRepository;

  @Inject
  public GlossaryService(
      GlossaryRepository repository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      GlossaryMapper mapper) {
    super(repository, searchRepository, authorizer, Entity.GLOSSARY);
    this.glossaryRepository = repository;
    this.mapper = mapper;
  }

  public RestUtil.PutResponse<Glossary> updateVote(String updatedBy, UUID id, VoteRequest request) {
    return glossaryRepository.updateVote(updatedBy, id, request);
  }
}
