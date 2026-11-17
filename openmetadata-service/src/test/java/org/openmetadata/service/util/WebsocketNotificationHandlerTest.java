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

package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.feed.Announcement;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;

class WebsocketNotificationHandlerTest {

  @Test
  void entityAnnouncementBroadcastCarriesOnlyItsId() {
    Announcement announcement = announcement().withEntityLink("<#E::table::svc.db.schema.orders>");

    String broadcast = WebsocketNotificationHandler.announcementBroadcast(announcement);

    assertEquals(
        announcement.getId(), JsonUtils.readValue(broadcast, EntityReference.class).getId());
    assertFalse(broadcast.contains("orders"));
    assertFalse(broadcast.contains("Maintenance window"));
  }

  @Test
  void systemAnnouncementBroadcastCarriesTheAnnouncement() {
    String broadcast = WebsocketNotificationHandler.announcementBroadcast(announcement());

    assertEquals(
        "Maintenance window", JsonUtils.readValue(broadcast, Announcement.class).getDescription());
  }

  private static Announcement announcement() {
    return new Announcement()
        .withId(UUID.randomUUID())
        .withName("maintenance")
        .withDescription("Maintenance window")
        .withStartTime(0L)
        .withEndTime(1L);
  }
}
