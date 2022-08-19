/*
 *  Copyright 2022 Collate
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

package org.openmetadata.catalog.secrets;

import static java.util.Objects.isNull;

import com.google.common.base.CaseFormat;
import java.util.List;
import lombok.Getter;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.airflow.AirflowConfiguration;
import org.openmetadata.catalog.airflow.AuthConfiguration;
import org.openmetadata.catalog.entity.services.ServiceType;
import org.openmetadata.catalog.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.catalog.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.catalog.exception.SecretsManagerException;
import org.openmetadata.catalog.metadataIngestion.DatabaseServiceMetadataPipeline;
import org.openmetadata.catalog.services.connections.metadata.OpenMetadataServerConnection;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.util.JsonUtils;

public abstract class SecretsManager {

  @Getter private final String clusterPrefix;

  @Getter private final OpenMetadataServerConnection.SecretsManagerProvider secretsManagerProvider;

  protected SecretsManager(
      OpenMetadataServerConnection.SecretsManagerProvider secretsManagerProvider, String clusterPrefix) {
    this.secretsManagerProvider = secretsManagerProvider;
    this.clusterPrefix = clusterPrefix;
  }

  public boolean isLocal() {
    return false;
  }

  public abstract Object encryptOrDecryptServiceConnectionConfig(
      Object connectionConfig, String connectionType, String connectionName, ServiceType serviceType, boolean encrypt);

  abstract Object encryptOrDecryptDbtConfigSource(Object dbtConfigSource, String serviceName, boolean encrypt);

  public void encryptOrDecryptDbtConfigSource(IngestionPipeline ingestionPipeline, boolean encrypt) {
    encryptOrDecryptDbtConfigSource(ingestionPipeline, ingestionPipeline.getService(), encrypt);
  }

  public void encryptOrDecryptDbtConfigSource(
      IngestionPipeline ingestionPipeline, EntityReference service, boolean encrypt) {
    // DatabaseServiceMetadataPipeline contains dbtConfigSource and must be encrypted
    if (service.getType().equals(Entity.DATABASE_SERVICE)
        && ingestionPipeline.getPipelineType().equals(PipelineType.METADATA)) {
      DatabaseServiceMetadataPipeline databaseServiceMetadataPipeline =
          JsonUtils.convertValue(
              ingestionPipeline.getSourceConfig().getConfig(), DatabaseServiceMetadataPipeline.class);
      databaseServiceMetadataPipeline.setDbtConfigSource(
          encryptOrDecryptDbtConfigSource(
              databaseServiceMetadataPipeline.getDbtConfigSource(), service.getName(), encrypt));
      ingestionPipeline.getSourceConfig().setConfig(databaseServiceMetadataPipeline);
    }
  }

  public OpenMetadataServerConnection decryptServerConnection(AirflowConfiguration airflowConfiguration) {
    OpenMetadataServerConnection.AuthProvider authProvider =
        OpenMetadataServerConnection.AuthProvider.fromValue(airflowConfiguration.getAuthProvider());
    String openMetadataURL = airflowConfiguration.getMetadataApiEndpoint();
    return new OpenMetadataServerConnection()
        .withAuthProvider(authProvider)
        .withHostPort(openMetadataURL)
        .withSecurityConfig(decryptAuthProviderConfig(authProvider, airflowConfiguration.getAuthConfig()));
  }

  public abstract AirflowConfiguration encryptAirflowConnection(AirflowConfiguration airflowConfiguration);

  protected abstract Object decryptAuthProviderConfig(
      OpenMetadataServerConnection.AuthProvider authProvider, AuthConfiguration authConfig);

  protected String getSecretSeparator() {
    return "/";
  }

  protected boolean startsWithSeparator() {
    return true;
  }

  protected String buildSecretId(String... secretIdValues) {
    StringBuilder format = new StringBuilder();
    format.append(startsWithSeparator() ? getSecretSeparator() : "");
    format.append(clusterPrefix);
    for (String secretIdValue : List.of(secretIdValues)) {
      if (isNull(secretIdValue)) {
        throw new SecretsManagerException("Cannot build a secret id with null values.");
      }
      format.append(getSecretSeparator());
      format.append("%s");
    }
    return String.format(format.toString(), (Object[]) secretIdValues).toLowerCase();
  }

  protected Class<?> createConnectionConfigClass(String connectionType, String connectionPackage)
      throws ClassNotFoundException {
    String clazzName =
        "org.openmetadata.catalog.services.connections." + connectionPackage + "." + connectionType + "Connection";
    return Class.forName(clazzName);
  }

  protected String extractConnectionPackageName(ServiceType serviceType) {
    return CaseFormat.UPPER_CAMEL.to(CaseFormat.LOWER_CAMEL, serviceType.value());
  }
}
