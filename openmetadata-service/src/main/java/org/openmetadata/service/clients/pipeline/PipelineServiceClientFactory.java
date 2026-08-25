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

package org.openmetadata.service.clients.pipeline;

import java.lang.reflect.InvocationTargetException;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.api.configuration.pipelineServiceClient.PipelineServiceClientConfiguration;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.sdk.exception.PipelineServiceClientException;

@Slf4j
public final class PipelineServiceClientFactory {
  private PipelineServiceClientFactory() {
    // Final class
  }

  /** Lock for thread-safe client creation. */
  private static final Object LOCK = new Object();

  /** Volatile to ensure visibility across threads. */
  @Getter private static volatile PipelineServiceClientInterface pipelineServiceClient;

  /**
   * Reset the cached pipeline service client. This is used by tests that need to switch between
   * different pipeline client implementations (e.g., MockPipelineServiceClient vs
   * K8sPipelineClient).
   */
  @com.google.common.annotations.VisibleForTesting
  public static void reset() {
    synchronized (LOCK) {
      pipelineServiceClient = null;
    }
  }

  /**
   * Creates or returns the cached pipeline service client. Thread-safe with double-checked locking.
   *
   * @param config The pipeline service client configuration
   * @return The pipeline service client instance
   */
  public static PipelineServiceClientInterface createPipelineServiceClient(
      PipelineServiceClientConfiguration config) {
    if (CommonUtil.nullOrEmpty(config)) {
      return pipelineServiceClient;
    }

    // Fast path: check if we can reuse cached client without locking
    PipelineServiceClientInterface cached = pipelineServiceClient;
    if (cached != null && isSameClientType(cached, config.getClassName())) {
      return cached;
    }

    // Slow path: synchronized creation
    synchronized (LOCK) {
      // Double-check after acquiring lock
      cached = pipelineServiceClient;
      if (cached != null && isSameClientType(cached, config.getClassName())) {
        return cached;
      }

      if (cached != null) {
        LOG.info(
            "Requested PipelineServiceClient class {} differs from cached {}, creating new client",
            config.getClassName(),
            getActualClientClassName(cached));
      }

      if (Boolean.FALSE.equals(config.getEnabled())) {
        LOG.debug("Pipeline Service Client is disabled. Skipping initialization.");
        return null;
      }

      String pipelineServiceClientClass = config.getClassName();
      LOG.info("Creating PipelineServiceClient: {}", pipelineServiceClientClass);

      try {
        PipelineServiceClientInterface client =
            Class.forName(pipelineServiceClientClass)
                .asSubclass(PipelineServiceClient.class)
                .getConstructor(PipelineServiceClientConfiguration.class)
                .newInstance(config);
        pipelineServiceClient = new MeteredPipelineServiceClient(client);
        return pipelineServiceClient;
      } catch (ClassNotFoundException
          | NoSuchMethodException
          | InvocationTargetException
          | InstantiationException
          | IllegalAccessException e) {
        throw new PipelineServiceClientException(
            String.format(
                "Error trying to load PipelineServiceClient %s: %s",
                pipelineServiceClientClass, e.getCause()));
      }
    }
  }

  /** Check if the cached client is of the same type as requested. */
  private static boolean isSameClientType(
      PipelineServiceClientInterface cached, String requestedClassName) {
    return getActualClientClassName(cached).equals(requestedClassName);
  }

  /** Get the actual client class name, unwrapping MeteredPipelineServiceClient if needed. */
  private static String getActualClientClassName(PipelineServiceClientInterface client) {
    if (client instanceof MeteredPipelineServiceClient) {
      return ((MeteredPipelineServiceClient) client).getDecoratedClient().getClass().getName();
    }
    return client.getClass().getName();
  }
}
