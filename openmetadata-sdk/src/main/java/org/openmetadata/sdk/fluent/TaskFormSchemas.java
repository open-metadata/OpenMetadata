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

package org.openmetadata.sdk.fluent;

import java.util.Map;
import java.util.UUID;
import org.openmetadata.schema.entity.feed.TaskFormSchema;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

public final class TaskFormSchemas {
  private static OpenMetadataClient defaultClient;

  private TaskFormSchemas() {}

  public static void setDefaultClient(OpenMetadataClient client) {
    defaultClient = client;
  }

  private static OpenMetadataClient getClient() {
    if (defaultClient == null) {
      throw new IllegalStateException(
          "Client not initialized. Call TaskFormSchemas.setDefaultClient() first.");
    }
    return defaultClient;
  }

  public static TaskFormSchema create(TaskFormSchema entity) {
    return getClient().taskFormSchemas().create(entity);
  }

  public static TaskFormSchema get(String id) {
    return getClient().taskFormSchemas().get(id);
  }

  public static TaskFormSchema get(String id, String fields) {
    return getClient().taskFormSchemas().get(id, fields);
  }

  public static TaskFormSchema get(String id, String fields, String include) {
    return getClient().taskFormSchemas().get(id, fields, include);
  }

  public static TaskFormSchema getByName(String fqn) {
    return getClient().taskFormSchemas().getByName(fqn);
  }

  public static TaskFormSchema getByName(String fqn, String fields) {
    return getClient().taskFormSchemas().getByName(fqn, fields);
  }

  public static TaskFormSchema update(String id, TaskFormSchema entity) {
    return getClient().taskFormSchemas().update(id, entity);
  }

  public static void delete(String id) {
    getClient().taskFormSchemas().delete(id);
  }

  public static void delete(String id, Map<String, String> params) {
    getClient().taskFormSchemas().delete(id, params);
  }

  public static void restore(String id) {
    getClient().taskFormSchemas().restore(id);
  }

  public static ListResponse<TaskFormSchema> list(ListParams params) {
    return getClient().taskFormSchemas().list(params);
  }

  public static EntityHistory getVersionList(UUID id) {
    return getClient().taskFormSchemas().getVersionList(id);
  }

  public static TaskFormSchema getVersion(String id, Double version) {
    return getClient().taskFormSchemas().getVersion(id, version);
  }
}
