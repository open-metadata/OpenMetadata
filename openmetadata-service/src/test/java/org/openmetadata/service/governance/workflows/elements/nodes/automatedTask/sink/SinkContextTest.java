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

package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.sink;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Map;
import org.junit.jupiter.api.Test;

class SinkContextTest {
  private static final String DECRYPTED_TOKEN = "ghp_decryptedSinkToken";

  @Test
  void toStringLeavesOutTheDecryptedSinkConfig() {
    SinkContext.SinkContextBuilder builder =
        SinkContext.builder()
            .sinkConfig(Map.of("credentials", Map.of("token", DECRYPTED_TOKEN)))
            .workflowName("gitSinkWorkflow");

    String context = builder.build().toString();

    assertFalse(context.contains(DECRYPTED_TOKEN), context);
    assertTrue(context.contains("gitSinkWorkflow"), context);
    assertFalse(builder.toString().contains(DECRYPTED_TOKEN), builder.toString());
  }
}
