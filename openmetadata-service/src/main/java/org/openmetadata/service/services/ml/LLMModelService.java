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

import jakarta.ws.rs.core.UriInfo;
import java.util.List;
import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.ai.LLMModel;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.LLMModelRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.EntityBaseService;
import org.openmetadata.service.resources.ResourceEntityInfo;
import org.openmetadata.service.resources.ai.LLMModelMapper;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.services.Service;

/**
 * Service layer for LLMModel entity operations.
 *
 * <p>Extends EntityBaseService to inherit all standard CRUD operations with proper authorization
 * and repository delegation.
 */
@Slf4j
@Singleton
@Service(entityType = Entity.LLM_MODEL)
public class LLMModelService extends EntityBaseService<LLMModel, LLMModelRepository> {

  @Getter private final LLMModelMapper mapper;
  public static final String FIELDS = "owners,followers,tags,extension,domains";

  @Inject
  public LLMModelService(
      LLMModelRepository repository, Authorizer authorizer, LLMModelMapper mapper, Limits limits) {
    super(
        new ResourceEntityInfo<>(Entity.LLM_MODEL, LLMModel.class), repository, authorizer, limits);
    this.mapper = mapper;
  }

  @Override
  protected LLMModel addHref(UriInfo uriInfo, LLMModel llmModel) {
    super.addHref(uriInfo, llmModel);
    Entity.withHref(uriInfo, llmModel.getService());
    return llmModel;
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    return listOf(MetadataOperation.VIEW_USAGE, MetadataOperation.EDIT_USAGE);
  }

  public static class LLMModelList extends ResultList<LLMModel> {
    /* Required for serde */
  }
}
