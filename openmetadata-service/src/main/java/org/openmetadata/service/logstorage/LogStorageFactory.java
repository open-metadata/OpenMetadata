/*
 *  Copyright 2025 Collate
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

package org.openmetadata.service.logstorage;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.configuration.LogStorageConfiguration;
import org.openmetadata.sdk.PipelineServiceClientInterface;

/**
 * Factory class for creating LogStorageInterface implementations based on configuration.
 */
@Slf4j
public class LogStorageFactory {

  private LogStorageFactory() {
    // Private constructor to prevent instantiation
  }

  /**
   * Create a LogStorageInterface implementation based on the provided configuration.
   *
   * @param logStorageConfig The log storage configuration
   * @param pipelineServiceClient The pipeline service client (used for default storage)
   * @return LogStorageInterface implementation
   * @throws IOException if initialization fails
   */
  public static LogStorageInterface create(
      LogStorageConfiguration logStorageConfig,
      PipelineServiceClientInterface pipelineServiceClient)
      throws IOException {

    if (logStorageConfig == null) {
      LOG.info("No log storage configuration provided, using default log storage");
      return createDefaultLogStorage(pipelineServiceClient);
    }

    String storageType = logStorageConfig.getType().value();
    LOG.info("Creating log storage of type: {}", storageType);

    LogStorageInterface logStorage;
    Map<String, Object> initConfig = new HashMap<>();

    switch (storageType.toLowerCase()) {
      case "default":
        logStorage = new DefaultLogStorage();
        initConfig.put("pipelineServiceClient", pipelineServiceClient);
        break;

      case "s3":
        logStorage = new S3LogStorage();
        initConfig.put("config", logStorageConfig);
        break;

      default:
        throw new IllegalArgumentException("Unsupported log storage type: " + storageType);
    }

    logStorage.initialize(initConfig);
    return logStorage;
  }

  /**
   * Create a default log storage implementation.
   *
   * @param pipelineServiceClient The pipeline service client
   * @return DefaultLogStorage implementation
   * @throws IOException if initialization fails
   */
  private static LogStorageInterface createDefaultLogStorage(
      PipelineServiceClientInterface pipelineServiceClient) throws IOException {

    LogStorageInterface logStorage = new DefaultLogStorage();
    Map<String, Object> initConfig = new HashMap<>();
    initConfig.put("pipelineServiceClient", pipelineServiceClient);
    logStorage.initialize(initConfig);
    return logStorage;
  }
}
