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

package org.openmetadata.service.resources.services.ingestionpipelines;

import jakarta.ws.rs.core.SecurityContext;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.CreateResourceContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;

/**
 * Guards every path that starts an ingestion pipeline run. Shared so that running a pipeline
 * directly and running it scoped to one entity cannot diverge on who may trigger it or on the
 * limits that apply - a second implementation would be free to drift from this one on exactly the
 * checks that keep a run authorized.
 */
public final class IngestionPipelineTriggers {

  private IngestionPipelineTriggers() {}

  /**
   * The pipeline must carry its owners: both the Trigger policy and the limits can be conditioned
   * on them, and a pipeline read without {@link Entity#FIELD_OWNERS} would evaluate both against
   * null owners.
   */
  public static void authorizeTrigger(
      Authorizer authorizer,
      Limits limits,
      SecurityContext securityContext,
      IngestionPipeline pipeline) {
    OperationContext trigger =
        new OperationContext(Entity.INGESTION_PIPELINE, MetadataOperation.TRIGGER);
    authorizer.authorize(
        securityContext,
        trigger,
        new ResourceContext<>(Entity.INGESTION_PIPELINE, pipeline.getId(), null));
    limits.enforceLimits(
        securityContext, new CreateResourceContext<>(Entity.INGESTION_PIPELINE, pipeline), trigger);
  }
}
