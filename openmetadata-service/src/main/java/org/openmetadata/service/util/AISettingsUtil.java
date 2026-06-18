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

import org.openmetadata.schema.configuration.AISettings;
import org.openmetadata.schema.configuration.PromptConfig;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.service.resources.settings.SettingsCache;

public final class AISettingsUtil {
  private AISettingsUtil() {}

  /** Returns the current AISettings from cache; never null — falls back to a defaulted-enabled instance. */
  public static AISettings get() {
    AISettings settings;
    try {
      settings = SettingsCache.getSetting(SettingsType.AI_SETTINGS, AISettings.class);
    } catch (Exception ex) {
      settings = new AISettings().withEnabled(true);
    }
    return settings;
  }

  public static boolean isFileExtractionEnabled(AISettings s) {
    return masterOn(s)
        && s.getMemoryExtraction() != null
        && Boolean.TRUE.equals(s.getMemoryExtraction().getFromFiles());
  }

  public static boolean isPageExtractionEnabled(AISettings s) {
    return masterOn(s)
        && s.getMemoryExtraction() != null
        && Boolean.TRUE.equals(s.getMemoryExtraction().getFromPages());
  }

  public static boolean isOntologyAgentEnabled(AISettings s) {
    return masterOn(s)
        && s.getOntologyAgent() != null
        && Boolean.TRUE.equals(s.getOntologyAgent().getEnabled());
  }

  public static String memoryExtractionPrompt(AISettings s, String fallback) {
    PromptConfig promptConfig =
        s == null || s.getPrompts() == null ? null : s.getPrompts().getMemoryExtraction();
    return promptOrFallback(promptConfig, fallback);
  }

  public static String ontologyAgentPrompt(AISettings s, String fallback) {
    PromptConfig promptConfig =
        s == null || s.getPrompts() == null ? null : s.getPrompts().getOntologyAgent();
    return promptOrFallback(promptConfig, fallback);
  }

  private static boolean masterOn(AISettings s) {
    return s != null && Boolean.TRUE.equals(s.getEnabled());
  }

  private static String promptOrFallback(PromptConfig p, String fallback) {
    String result = fallback;
    if (p != null && p.getSystemPrompt() != null && !p.getSystemPrompt().isBlank()) {
      result = p.getSystemPrompt();
    }
    return result;
  }
}
