/*
 *  Copyright 2026 Collate
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

package org.openmetadata.service.resources.services.ingestionpipelines.run;

import java.util.List;
import java.util.Set;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;

/**
 * A table is owned by its database service's pipelines. Usage and lineage are left out: they are
 * driven by query logs, which a table filter does not bound, so a run would look scoped and not be.
 */
public class TablePipelineResolver implements RunnablePipelineResolver {

  @Override
  public Set<PipelineType> pipelineTypes() {
    return Set.of(PipelineType.PROFILER, PipelineType.METADATA, PipelineType.AUTO_CLASSIFICATION);
  }

  @Override
  public String entityFields() {
    return "";
  }

  @Override
  public List<IngestionPipeline> pipelinesOwning(EntityInterface table, PipelineType pipelineType) {
    DatabaseService service =
        Entity.getEntity(((Table) table).getService(), "pipelines", Include.NON_DELETED);
    return RunnablePipelineResolver.pipelinesOfType(service.getPipelines(), pipelineType);
  }
}
