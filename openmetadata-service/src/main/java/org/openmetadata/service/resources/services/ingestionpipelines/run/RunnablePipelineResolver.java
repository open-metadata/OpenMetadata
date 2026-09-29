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

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.List;
import java.util.Set;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;

/** Finds, for one entity type, the pipelines of a given type that own an entity of that type. */
public interface RunnablePipelineResolver {

  /** The pipeline types that can be run scoped to an entity of this type. */
  Set<PipelineType> pipelineTypes();

  /** The fields the entity has to be read with to resolve and scope its run. */
  String entityFields();

  /** The pipelines of {@code pipelineType} that own {@code target}, whether runnable or not. */
  List<IngestionPipeline> pipelinesOwning(EntityInterface target, PipelineType pipelineType);

  static List<IngestionPipeline> pipelinesOfType(
      List<EntityReference> pipelines, PipelineType pipelineType) {
    return listOrEmpty(pipelines).stream()
        .<IngestionPipeline>map(
            reference -> Entity.getEntity(reference, Entity.FIELD_OWNERS, Include.NON_DELETED))
        .filter(pipeline -> pipelineType.equals(pipeline.getPipelineType()))
        .toList();
  }
}
