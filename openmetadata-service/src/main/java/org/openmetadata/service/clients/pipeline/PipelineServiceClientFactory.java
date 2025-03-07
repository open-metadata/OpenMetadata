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

  @Getter private static PipelineServiceClientInterface pipelineServiceClient;

  public static PipelineServiceClientInterface createPipelineServiceClient(
      PipelineServiceClientConfiguration config) {
    if (pipelineServiceClient != null || CommonUtil.nullOrEmpty(config)) {
      return pipelineServiceClient;
    }

    if (Boolean.FALSE.equals(config.getEnabled())) {
      LOG.debug("Pipeline Service Client is disabled. Skipping initialization.");
      return null;
    }

    String pipelineServiceClientClass = config.getClassName();
    LOG.debug("Registering PipelineServiceClient: {}", pipelineServiceClientClass);

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
