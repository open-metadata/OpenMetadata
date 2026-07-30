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
package org.openmetadata.service.apps.bundles.rdf;

import java.util.Set;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.service.rdf.RdfWriteMode;

public record RdfIndexingRunContext(RdfWriteMode writeMode, Set<String> entityTypesInRun) {

  public RdfIndexingRunContext {
    writeMode = writeMode != null ? writeMode : RdfWriteMode.RECONCILE;
    entityTypesInRun = entityTypesInRun != null ? Set.copyOf(entityTypesInRun) : Set.of();
  }

  public static RdfIndexingRunContext reconcileDefaults() {
    return new RdfIndexingRunContext(RdfWriteMode.RECONCILE, Set.of());
  }

  public static RdfIndexingRunContext forJob(EventPublisherJob job) {
    if (job == null) {
      return reconcileDefaults();
    }
    RdfWriteMode writeMode =
        Boolean.TRUE.equals(job.getRecreateIndex())
            ? RdfWriteMode.INSERT_ONLY
            : RdfWriteMode.RECONCILE;
    return new RdfIndexingRunContext(writeMode, job.getEntities());
  }
}
