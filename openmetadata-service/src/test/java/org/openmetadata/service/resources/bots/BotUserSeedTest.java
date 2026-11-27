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

package org.openmetadata.service.resources.bots;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.teams.User;

class BotUserSeedTest {
  private static final String DOMAIN = "open-metadata.org";

  @Test
  void seededBotUserKeepsTheSeedDisplayName() {
    User seed =
        new User().withName("AIAutomationApplicationBot").withDisplayName("AI Automation Bot");

    User user = BotResource.toSeededBotUser(seed, DOMAIN);

    assertEquals("AI Automation Bot", user.getDisplayName());
    assertEquals("aiautomationapplicationbot", user.getName());
    assertTrue(user.getIsBot());
  }

  @Test
  void seededBotUserWithoutDisplayNameHasNone() {
    User seed = new User().withName("ingestion-bot");

    User user = BotResource.toSeededBotUser(seed, DOMAIN);

    assertNull(user.getDisplayName());
  }
}
