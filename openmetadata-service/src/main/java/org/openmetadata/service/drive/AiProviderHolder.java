/*
 * Copyright 2024 Collate.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package org.openmetadata.service.drive;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.configuration.LLMConfiguration;
import org.openmetadata.service.clients.llm.LlmConfigHolder;

/**
 * Process-wide holder of the single {@link AiProvider}. Resolves the implementation once, lazily,
 * from {@code llmConfiguration.aiProviderClass} in {@code openmetadata.yaml}: when that names a class
 * on the classpath it is used, otherwise (unset, blank, or absent) the built-in {@link
 * LlmAiProvider} is used. This is the config-driven seam (same shape as {@code
 * pipelineServiceClientConfiguration.className}): the default distribution works standalone, and an
 * alternate backend is selected purely by setting the class name in config. {@link #setForTesting} /
 * {@link #reset} are the test seams.
 */
@Slf4j
public final class AiProviderHolder {
  private static volatile AiProvider instance;

  private AiProviderHolder() {}

  public static AiProvider get() {
    AiProvider current = instance;
    if (current == null) {
      current = build();
    }
    return current;
  }

  private static synchronized AiProvider build() {
    if (instance == null) {
      instance = resolve(configuredProviderClass());
    }
    return instance;
  }

  private static String configuredProviderClass() {
    final LLMConfiguration config = LlmConfigHolder.get();
    return config == null ? null : config.getAiProviderClass();
  }

  private static AiProvider resolve(final String className) {
    AiProvider resolved;
    if (nullOrEmpty(className)) {
      resolved = new LlmAiProvider();
    } else {
      resolved = resolveConfigured(className);
    }
    return resolved;
  }

  private static AiProvider resolveConfigured(final String className) {
    AiProvider resolved;
    try {
      final Class<?> clazz = Class.forName(className);
      resolved = (AiProvider) clazz.getDeclaredConstructor().newInstance();
      LOG.info("Using AI provider: {}", className);
    } catch (ClassNotFoundException notOnClasspath) {
      LOG.warn(
          "Configured aiProviderClass '{}' is not on the classpath; using the built-in LLM provider",
          className);
      resolved = new LlmAiProvider();
    } catch (ReflectiveOperationException badProvider) {
      LOG.error(
          "Configured aiProviderClass '{}' could not be instantiated; using the built-in LLM provider",
          className,
          badProvider);
      resolved = new LlmAiProvider();
    }
    return resolved;
  }

  /** Test seam: inject a deterministic provider. */
  public static synchronized void setForTesting(final AiProvider provider) {
    instance = provider;
  }

  /** Test seam: clear the cached provider so the next {@link #get()} re-resolves. */
  public static synchronized void reset() {
    instance = null;
  }
}
