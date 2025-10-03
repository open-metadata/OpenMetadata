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
 * Pipeline step interface for processing notifications.
 * Each step transforms the notification data and passes it to the next step.
 */
public interface NotificationPipelineStep {
  /**
   * Process the notification data through this pipeline step.
   *
   * @param context The pipeline context containing all data
   * @return Updated context after processing
   */
  NotificationPipelineContext process(NotificationPipelineContext context);
}
