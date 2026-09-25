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

import java.util.Map;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;

/**
 * Narrows a run of one pipeline type to a single entity, by the source config keys it overrides for
 * that run. Every rule that keeps a scoped run safe for its pipeline type lives in its scoper, so it
 * is written and reviewed once rather than by each caller that runs a pipeline for an entity.
 */
public interface SourceConfigScoper {

  /**
   * Rejects a scoped run that would be unsafe for this pipeline, before anything is triggered. It
   * reads the stored pipeline, so it runs before secrets are resolved and the source config is
   * withheld from a caller without ViewAll.
   */
  default void checkScopable(IngestionPipeline pipeline) {}

  /** The source config keys that narrow the run to {@code target}; see RunOptions. */
  Map<String, Object> sourceConfigOverride(EntityInterface target);
}
