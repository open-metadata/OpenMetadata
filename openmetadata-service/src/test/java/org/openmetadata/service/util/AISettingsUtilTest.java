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

package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.configuration.AIPrompts;
import org.openmetadata.schema.configuration.AISettings;
import org.openmetadata.schema.configuration.MemoryExtractionSettings;
import org.openmetadata.schema.configuration.PromptConfig;

class AISettingsUtilTest {

  @Test
  void disabledMasterSwitchDisablesEverything() {
    AISettings off = new AISettings().withEnabled(false);
    assertFalse(AISettingsUtil.isFileExtractionEnabled(off));
    assertFalse(AISettingsUtil.isPageExtractionEnabled(off));
    assertFalse(AISettingsUtil.isOntologyAgentEnabled(off));
  }

  @Test
  void fileExtractionEnabledWhenMasterOnAndFlagSet() {
    AISettings on =
        new AISettings()
            .withEnabled(true)
            .withMemoryExtraction(
                new MemoryExtractionSettings().withFromFiles(true).withFromPages(false));
    assertTrue(AISettingsUtil.isFileExtractionEnabled(on));
    assertFalse(AISettingsUtil.isPageExtractionEnabled(on));
  }

  @Test
  void memoryExtractionPromptReturnsFallbackWhenNoPromptConfigured() {
    AISettings on =
        new AISettings()
            .withEnabled(true)
            .withMemoryExtraction(new MemoryExtractionSettings().withFromFiles(true));
    assertEquals("fallback", AISettingsUtil.memoryExtractionPrompt(on, "fallback"));
  }

  @Test
  void memoryExtractionPromptReturnsConfiguredPromptWhenSet() {
    AISettings on =
        new AISettings()
            .withEnabled(true)
            .withPrompts(
                new AIPrompts()
                    .withMemoryExtraction(new PromptConfig().withSystemPrompt("custom-prompt")));
    assertEquals("custom-prompt", AISettingsUtil.memoryExtractionPrompt(on, "fallback"));
  }
}
