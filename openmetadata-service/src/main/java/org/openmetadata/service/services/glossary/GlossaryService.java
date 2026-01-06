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

import static org.openmetadata.common.utils.CommonUtil.listOf;

import java.util.List;
import java.util.UUID;
import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.VoteRequest;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.GlossaryRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.EntityBaseService;
import org.openmetadata.service.resources.ResourceEntityInfo;
import org.openmetadata.service.resources.glossary.GlossaryMapper;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.services.Service;
import org.openmetadata.service.util.RestUtil;

@Slf4j
@Singleton
@Service(entityType = Entity.GLOSSARY, order = 9)
public class GlossaryService extends EntityBaseService<Glossary, GlossaryRepository> {

  @Getter private final GlossaryMapper mapper;
  public static final String FIELDS =
      "owners,tags,reviewers,usageCount,termCount,domains,extension";

  @Inject
  public GlossaryService(
      GlossaryRepository repository, Authorizer authorizer, GlossaryMapper mapper, Limits limits) {
    super(
        new ResourceEntityInfo<>(Entity.GLOSSARY, Glossary.class), repository, authorizer, limits);
    this.mapper = mapper;
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    addViewOperation("reviewers,usageCount,termCount", MetadataOperation.VIEW_BASIC);
    return listOf();
  }

  public RestUtil.PutResponse<Glossary> updateVote(String updatedBy, UUID id, VoteRequest request) {
    return repository.updateVote(updatedBy, id, request);
  }

  public static class GlossaryList extends ResultList<Glossary> {
    /* Required for serde */
  }
}
