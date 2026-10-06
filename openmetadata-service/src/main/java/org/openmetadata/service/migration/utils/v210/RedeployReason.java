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

package org.openmetadata.service.migration.utils.v210;

import java.util.function.Predicate;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;

/**
 * A reason the v2.1.0 migration redeploys a stored workflow definition. Stored definitions are not
 * rebuilt at startup, so a change to how a definition is deployed reaches it only once it is
 * redeployed. {@code appliesTo} reads the stored definition alone; {@code isDeploymentOutdated}
 * reads its current deployment, so a definition a run already redeployed is left alone by the
 * next.
 */
record RedeployReason(
    Predicate<WorkflowDefinition> appliesTo, Predicate<WorkflowDefinition> isDeploymentOutdated) {

  boolean requiresRedeploy(WorkflowDefinition definition) {
    return appliesTo.test(definition) && isDeploymentOutdated.test(definition);
  }
}
