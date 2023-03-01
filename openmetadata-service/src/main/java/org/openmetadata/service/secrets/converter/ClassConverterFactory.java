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

import java.util.HashMap;
import java.util.Map;
import org.openmetadata.schema.auth.SSOAuthMechanism;
import org.openmetadata.schema.metadataIngestion.DbtPipeline;
import org.openmetadata.schema.security.credentials.GCSCredentials;
import org.openmetadata.schema.services.connections.dashboard.SupersetConnection;
import org.openmetadata.schema.services.connections.database.BigQueryConnection;
import org.openmetadata.schema.services.connections.database.DatalakeConnection;
import org.openmetadata.schema.services.connections.database.datalake.GCSConfig;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.schema.services.connections.objectstore.GcsConnection;
import org.openmetadata.schema.services.connections.pipeline.AirflowConnection;

/** Factory class to get a `ClassConverter` based on the service class. */
public class ClassConverterFactory {

  private static final Map<Class<?>, ClassConverter> converterMap = new HashMap<>();

  static {
    converterMap.put(AirflowConnection.class, new AirflowConnectionClassConverter());
    converterMap.put(DatalakeConnection.class, new DatalakeConnectionClassConverter());
    converterMap.put(DbtPipeline.class, new DbtPipelineClassConverter());
    converterMap.put(SSOAuthMechanism.class, new SSOAuthMechanismClassConverter());
    converterMap.put(SupersetConnection.class, new SupersetConnectionClassConverter());
    converterMap.put(GCSCredentials.class, new GcsCredentialsClassConverter());
    converterMap.put(OpenMetadataConnection.class, new OpenMetadataConnectionClassConverter());
    converterMap.put(GcsConnection.class, new GcsConnectionClassConverter());
    converterMap.put(GCSConfig.class, new GCSConfigClassConverter());
    converterMap.put(BigQueryConnection.class, new BigQueryConnectionClassConverter());
  }

  public static ClassConverter getConverter(Class<?> clazz) {
    return converterMap.getOrDefault(clazz, new DefaultConnectionClassConverter(clazz));
  }
}
