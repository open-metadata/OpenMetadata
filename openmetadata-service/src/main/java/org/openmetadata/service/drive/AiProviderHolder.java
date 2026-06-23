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

import lombok.extern.slf4j.Slf4j;

/**
 * Process-wide holder of the single {@link AiProvider}. Resolves the implementation once, lazily:
 * the class named by {@code -Dopenmetadata.ai.provider.class} (default {@link
 * #DEFAULT_PROVIDER_CLASS}, a Collate-only class) if it is on the classpath, otherwise the OSS
 * {@link LlmAiProvider}. Mirrors the {@code McpServerProvider} seam in {@code
 * OpenMetadataApplication}: OSS works standalone; Collate ships the alternate class and it is picked
 * up automatically. {@link #setForTesting} / {@link #reset} are the test seams.
 */
@Slf4j
public final class AiProviderHolder {
  static final String PROVIDER_CLASS_PROPERTY = "openmetadata.ai.provider.class";
  static final String DEFAULT_PROVIDER_CLASS =
      "org.openmetadata.service.drive.collate.AiStudioAiProvider";

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
      instance = resolve(System.getProperty(PROVIDER_CLASS_PROPERTY, DEFAULT_PROVIDER_CLASS));
    }
    return instance;
  }

  private static AiProvider resolve(final String className) {
    AiProvider resolved;
    try {
      final Class<?> clazz = Class.forName(className);
      resolved = (AiProvider) clazz.getDeclaredConstructor().newInstance();
      LOG.info("Using AI provider: {}", className);
    } catch (ClassNotFoundException notOnClasspath) {
      resolved = new LlmAiProvider();
    } catch (ReflectiveOperationException badProvider) {
      LOG.error(
          "AI provider '{}' is on the classpath but could not be instantiated; "
              + "falling back to the OSS LLM provider",
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
