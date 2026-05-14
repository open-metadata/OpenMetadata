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
import org.openmetadata.schema.api.feed.CreateAnnouncement;
import org.openmetadata.schema.entity.feed.Announcement;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

public final class Announcements {
  private static OpenMetadataClient defaultClient;

  private Announcements() {}

  public static void setDefaultClient(OpenMetadataClient client) {
    defaultClient = client;
  }

  private static OpenMetadataClient getClient() {
    if (defaultClient == null) {
      throw new IllegalStateException(
          "Client not initialized. Call Announcements.setDefaultClient() first.");
    }
    return defaultClient;
  }

  public static Announcement create(CreateAnnouncement request) {
    return getClient().announcements().create(request);
  }

  public static Announcement createOrUpdate(CreateAnnouncement request) {
    return getClient().announcements().createOrUpdate(request);
  }

  public static Announcement get(String id) {
    return getClient().announcements().get(id);
  }

  public static Announcement get(String id, String fields) {
    return getClient().announcements().get(id, fields);
  }

  public static Announcement get(String id, String fields, String include) {
    return getClient().announcements().get(id, fields, include);
  }

  public static Announcement getByName(String fqn) {
    return getClient().announcements().getByName(fqn);
  }

  public static Announcement getByName(String fqn, String fields) {
    return getClient().announcements().getByName(fqn, fields);
  }

  public static Announcement update(String id, Announcement entity) {
    return getClient().announcements().update(id, entity);
  }

  public static void delete(String id) {
    getClient().announcements().delete(id);
  }

  public static void delete(String id, Map<String, String> params) {
    getClient().announcements().delete(id, params);
  }

  public static void restore(String id) {
    getClient().announcements().restore(id);
  }

  public static ListResponse<Announcement> list(ListParams params) {
    return getClient().announcements().list(params);
  }

  public static EntityHistory getVersionList(UUID id) {
    return getClient().announcements().getVersionList(id);
  }

  public static Announcement getVersion(String id, Double version) {
    return getClient().announcements().getVersion(id, version);
  }
}
