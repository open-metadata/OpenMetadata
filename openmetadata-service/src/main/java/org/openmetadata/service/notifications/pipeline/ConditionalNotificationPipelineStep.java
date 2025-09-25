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

package org.openmetadata.service.notifications.pipeline;

/**
 * Conditional pipeline step that only processes when certain conditions are met.
 * Provides a default implementation that delegates to doProcess() only when shouldProcess() returns true.
 */
public interface ConditionalNotificationPipelineStep extends NotificationPipelineStep {

  /**
   * Check if this step should process the given context
   */
  boolean shouldProcess(NotificationPipelineContext context);

  /**
   * Actual processing logic when conditions are met
   */
  NotificationPipelineContext doProcess(NotificationPipelineContext context);

  @Override
  default NotificationPipelineContext process(NotificationPipelineContext context) {
    if (shouldProcess(context)) {
      return doProcess(context);
    }
    // Return context unchanged if conditions not met
    return context;
  }
}
