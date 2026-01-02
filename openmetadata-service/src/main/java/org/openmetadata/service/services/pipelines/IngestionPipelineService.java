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

package org.openmetadata.service.services.pipelines;

import static org.openmetadata.common.utils.CommonUtil.listOf;

import jakarta.ws.rs.core.UriInfo;
import java.util.List;
import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.EntityBaseService;
import org.openmetadata.service.resources.ResourceEntityInfo;
import org.openmetadata.service.resources.services.ingestionpipelines.IngestionPipelineMapper;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.services.Service;

@Slf4j
@Singleton
@Service(entityType = Entity.INGESTION_PIPELINE)
public class IngestionPipelineService
    extends EntityBaseService<IngestionPipeline, IngestionPipelineRepository> {
  @Getter private final IngestionPipelineMapper mapper;
  public static final String FIELDS = "owners,followers";

  @Inject
  public IngestionPipelineService(
      IngestionPipelineRepository repository,
      Authorizer authorizer,
      IngestionPipelineMapper mapper,
      Limits limits) {
    super(
        new ResourceEntityInfo<>(Entity.INGESTION_PIPELINE, IngestionPipeline.class),
        repository,
        authorizer,
        limits);
    this.mapper = mapper;
  }

  @Override
  public IngestionPipeline addHref(UriInfo uriInfo, IngestionPipeline ingestionPipeline) {
    super.addHref(uriInfo, ingestionPipeline);
    Entity.withHref(uriInfo, ingestionPipeline.getService());
    return ingestionPipeline;
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    return listOf(
        MetadataOperation.CREATE_INGESTION_PIPELINE_AUTOMATOR,
        MetadataOperation.EDIT_INGESTION_PIPELINE_STATUS);
  }

  public static class IngestionPipelineList extends ResultList<IngestionPipeline> {
    /* Required for serde */
  }
}
