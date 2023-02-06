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
import org.openmetadata.schema.api.configuration.pipelineServiceClient.PipelineServiceClientConfiguration;
import org.openmetadata.sdk.PipelineServiceClient;

@Slf4j
public class PipelineServiceClientFactory {

  @Getter private static PipelineServiceClient pipelineServiceClient;

  public static PipelineServiceClient createPipelineServiceClient(PipelineServiceClientConfiguration config) {
    if (pipelineServiceClient != null) {
      return pipelineServiceClient;
    }

    String pipelineServiceClientClass = config.getClassName();
    LOG.info("Registering PipelineServiceClient: {}", pipelineServiceClientClass);

    try {
      pipelineServiceClient =
          Class.forName(pipelineServiceClientClass)
              .asSubclass(PipelineServiceClient.class)
              .getConstructor(PipelineServiceClientConfiguration.class)
              .newInstance(config);
      return pipelineServiceClient;
    } catch (ClassNotFoundException
        | NoSuchMethodException
        | InvocationTargetException
        | InstantiationException
        | IllegalAccessException e) {
      throw new RuntimeException(
          String.format("Error trying to load PipelineServiceClient %s: %s", pipelineServiceClientClass, e.getMessage())
      );
    }
  }
}
