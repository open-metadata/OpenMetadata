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

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.Set;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.service.rdf.RdfWriteMode;

class RdfIndexingRunContextTest {

  @Test
  void recreateJobUsesInsertOnly() {
    EventPublisherJob job =
        new EventPublisherJob().withRecreateIndex(true).withEntities(Set.of("table", "dashboard"));

    RdfIndexingRunContext context = RdfIndexingRunContext.forJob(job);

    assertEquals(RdfWriteMode.INSERT_ONLY, context.writeMode());
    assertEquals(Set.of("table", "dashboard"), context.entityTypesInRun());
  }

  @Test
  void falseNullAndMissingJobsReconcile() {
    assertEquals(
        RdfWriteMode.RECONCILE,
        RdfIndexingRunContext.forJob(new EventPublisherJob().withRecreateIndex(false)).writeMode());
    assertEquals(
        RdfWriteMode.RECONCILE, RdfIndexingRunContext.forJob(new EventPublisherJob()).writeMode());
    assertEquals(RdfWriteMode.RECONCILE, RdfIndexingRunContext.forJob(null).writeMode());
  }
}
