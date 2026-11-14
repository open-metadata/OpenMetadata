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

package org.openmetadata.service.alerting.channel.teams;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.utils.JsonUtils;

class TeamsTestMessageTest {

  /** Byte for byte what the test message was before it left the message decorator. */
  @Test
  void theTestMessageIsUnchanged() throws IOException {
    try (InputStream golden =
        getClass().getResourceAsStream("/alerting/test-messages/teams.json")) {
      assertEquals(
          new String(golden.readAllBytes(), StandardCharsets.UTF_8),
          JsonUtils.pojoToJsonIgnoreNull(TeamsTestMessage.build()));
    }
  }
}
