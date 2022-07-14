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

package org.openmetadata.catalog.jdbi3;

import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.services.PipelineService;
import org.openmetadata.catalog.resources.services.pipeline.PipelineServiceResource;
import org.openmetadata.catalog.secrets.SecretsManager;
import org.openmetadata.catalog.type.PipelineConnection;

public class PipelineServiceRepository extends ServiceRepository<PipelineService, PipelineConnection> {

  public PipelineServiceRepository(CollectionDAO dao, SecretsManager secretsManager) {
    super(
        PipelineServiceResource.COLLECTION_PATH,
        Entity.PIPELINE_SERVICE,
        dao,
        dao.pipelineServiceDAO(),
        secretsManager,
        PipelineConnection.class);
  }

  @Override
  protected String getServiceType(PipelineService pipelineService) {
    return pipelineService.getServiceType().value();
  }
}
