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

package org.openmetadata.catalog.airflow;

import java.util.HashMap;
import java.util.Map;
import org.openmetadata.catalog.airflow.models.OpenMetadataIngestionComponent;

public final class AirflowUtils {

  // TODO: Use this to enrich the AirflowPipeline info with default sink and metadata-rest config

  private AirflowUtils() {}

  public static OpenMetadataIngestionComponent makeElasticSearchSinkComponent() {
    Map<String, Object> sinkConfig = new HashMap<>();
    return OpenMetadataIngestionComponent.builder().type("elasticsearch").config(sinkConfig).build();
  }

  public static OpenMetadataIngestionComponent makeOpenMetadataSinkComponent() {
    Map<String, Object> sinkConfig = new HashMap<>();
    return OpenMetadataIngestionComponent.builder().type("metadata-rest").config(sinkConfig).build();
  }

  public static OpenMetadataIngestionComponent makeOpenMetadataConfigComponent(
      AirflowConfiguration airflowConfiguration) {
    Map<String, Object> metadataConfig = new HashMap<>();
    metadataConfig.put("api_endpoint", airflowConfiguration.getMetadataApiEndpoint());
    metadataConfig.put("auth_provider_type", airflowConfiguration.getAuthProvider());
    metadataConfig.put("secret_key", airflowConfiguration.getSecretKey());
    return OpenMetadataIngestionComponent.builder().type("metadata-server").config(metadataConfig).build();
  }
}
