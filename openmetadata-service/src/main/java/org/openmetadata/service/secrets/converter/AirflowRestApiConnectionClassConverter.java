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

import java.util.List;
import java.util.Map;
import org.openmetadata.schema.entity.utils.common.AccessTokenConfig;
import org.openmetadata.schema.entity.utils.common.BasicAuthConfig;
import org.openmetadata.schema.entity.utils.common.GcpCredentialsConfig;
import org.openmetadata.schema.entity.utils.common.MWAAAuthConfig;
import org.openmetadata.schema.security.credentials.AWSCredentials;
import org.openmetadata.schema.security.credentials.GCPCredentials;
import org.openmetadata.schema.services.connections.pipeline.AirflowRestApiConnection;
import org.openmetadata.schema.utils.JsonUtils;

/** Converter class to get an `AirflowRestApiConnection` object. */
public class AirflowRestApiConnectionClassConverter extends ClassConverter {

  public AirflowRestApiConnectionClassConverter() {
    super(AirflowRestApiConnection.class);
  }

  @Override
  public Object convert(Object object) {
    AirflowRestApiConnection conn =
        (AirflowRestApiConnection) JsonUtils.convertValue(object, this.clazz);

    if (!(conn.getAuthConfig() instanceof Map<?, ?> authMap)) {
      return conn;
    }

    if (authMap.containsKey("username")) {
      tryToConvertOrFail(authMap, List.of(BasicAuthConfig.class)).ifPresent(conn::setAuthConfig);
    } else if (authMap.containsKey("token")) {
      tryToConvertOrFail(authMap, List.of(AccessTokenConfig.class)).ifPresent(conn::setAuthConfig);
    } else if (authMap.containsKey("credentials")) {
      tryToConvertOrFail(authMap, List.of(GcpCredentialsConfig.class))
          .ifPresent(conn::setAuthConfig);
      if (conn.getAuthConfig() instanceof GcpCredentialsConfig gcpCfg) {
        tryToConvertOrFail(gcpCfg.getCredentials(), List.of(GCPCredentials.class))
            .ifPresent(obj -> gcpCfg.setCredentials((GCPCredentials) obj));
      }
    } else if (authMap.containsKey("mwaaConfig")) {
      tryToConvertOrFail(authMap, List.of(MWAAAuthConfig.class)).ifPresent(conn::setAuthConfig);
      if (conn.getAuthConfig() instanceof MWAAAuthConfig mwaaCfg) {
        if (mwaaCfg.getMwaaConfig() != null && mwaaCfg.getMwaaConfig().getAwsConfig() != null) {
          tryToConvertOrFail(mwaaCfg.getMwaaConfig().getAwsConfig(), List.of(AWSCredentials.class))
              .ifPresent(obj -> mwaaCfg.getMwaaConfig().setAwsConfig((AWSCredentials) obj));
        }
      }
    }

    return conn;
  }
}
