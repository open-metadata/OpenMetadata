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

package org.openmetadata.service.secrets.converter;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import lombok.Getter;
import org.openmetadata.schema.auth.SSOAuthMechanism;
import org.openmetadata.schema.entity.automations.TestServiceConnectionRequest;
import org.openmetadata.schema.entity.automations.Workflow;
import org.openmetadata.schema.metadataIngestion.DbtPipeline;
import org.openmetadata.schema.metadataIngestion.dbtconfig.DbtGCSConfig;
import org.openmetadata.schema.security.credentials.GCSCredentials;
import org.openmetadata.schema.services.connections.dashboard.SupersetConnection;
import org.openmetadata.schema.services.connections.database.BigQueryConnection;
import org.openmetadata.schema.services.connections.database.DatalakeConnection;
import org.openmetadata.schema.services.connections.database.datalake.GCSConfig;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.schema.services.connections.pipeline.AirflowConnection;
import org.openmetadata.schema.services.connections.storage.GcsConnection;

/** Factory class to get a `ClassConverter` based on the service class. */
public class ClassConverterFactory {

  @Getter private static final Map<Class<?>, ClassConverter> converterMap;

  static {
    converterMap =
        Collections.unmodifiableMap(
            new HashMap<>() {
              {
                put(AirflowConnection.class, new AirflowConnectionClassConverter());
                put(BigQueryConnection.class, new BigQueryConnectionClassConverter());
                put(DatalakeConnection.class, new DatalakeConnectionClassConverter());
                put(DbtGCSConfig.class, new DbtGCSConfigClassConverter());
                put(DbtPipeline.class, new DbtPipelineClassConverter());
                put(GCSConfig.class, new GCSConfigClassConverter());
                put(GCSCredentials.class, new GcsCredentialsClassConverter());
                put(GcsConnection.class, new GcsConnectionClassConverter());
                put(OpenMetadataConnection.class, new OpenMetadataConnectionClassConverter());
                put(SSOAuthMechanism.class, new SSOAuthMechanismClassConverter());
                put(SupersetConnection.class, new SupersetConnectionClassConverter());
                put(TestServiceConnectionRequest.class, new TestServiceConnectionRequestClassConverter());
                put(Workflow.class, new WorkflowClassConverter());
              }
            });
  }

  public static ClassConverter getConverter(Class<?> clazz) {
    return converterMap.getOrDefault(clazz, new DefaultConnectionClassConverter(clazz));
  }
}
