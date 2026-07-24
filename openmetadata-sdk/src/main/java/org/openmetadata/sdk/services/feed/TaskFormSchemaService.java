/*
 *  Copyright 2024 Collate
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

package org.openmetadata.sdk.services.feed;

import org.openmetadata.schema.entity.feed.TaskFormSchema;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.services.EntityServiceBase;

public class TaskFormSchemaService extends EntityServiceBase<TaskFormSchema> {

  public TaskFormSchemaService(HttpClient httpClient) {
    super(httpClient, "/v1/taskFormSchemas");
  }

  @Override
  protected Class<TaskFormSchema> getEntityClass() {
    return TaskFormSchema.class;
  }
}
