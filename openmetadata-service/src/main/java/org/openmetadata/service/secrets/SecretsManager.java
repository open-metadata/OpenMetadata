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

package org.openmetadata.service.secrets;

import static java.util.Objects.isNull;

import java.util.List;
import java.util.Locale;
import lombok.Getter;
import org.openmetadata.api.configuration.airflow.AuthConfiguration;
import org.openmetadata.api.configuration.airflow.SSLConfig;
import org.openmetadata.schema.api.configuration.airflow.AirflowConfiguration;
import org.openmetadata.schema.api.services.ingestionPipelines.TestServiceConnection;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.metadataIngestion.DatabaseServiceMetadataPipeline;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataServerConnection;
import org.openmetadata.schema.services.connections.metadata.SecretsManagerProvider;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.SecretsManagerException;
import org.openmetadata.service.util.JsonUtils;

public abstract class SecretsManager {

  @Getter private final String clusterPrefix;

  @Getter private final SecretsManagerProvider secretsManagerProvider;

  protected SecretsManager(SecretsManagerProvider secretsManagerProvider, String clusterPrefix) {
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
    OpenMetadataServerConnection.VerifySSL verifySSL =
        OpenMetadataServerConnection.VerifySSL.fromValue(airflowConfiguration.getVerifySSL());
    return new OpenMetadataServerConnection()
        .withAuthProvider(authProvider)
        .withHostPort(openMetadataURL)
        .withSecurityConfig(decryptAuthProviderConfig(authProvider, airflowConfiguration.getAuthConfig()))
        .withVerifySSL(verifySSL)
        .withSslConfig(getAirflowSSLConfig(verifySSL, airflowConfiguration.getSslConfig()));
  }

  protected Object getAirflowSSLConfig(OpenMetadataServerConnection.VerifySSL verifySSL, SSLConfig sslConfig) {
    switch (verifySSL) {
      case NO_SSL:
      case IGNORE:
        return null;
      case VALIDATE:
        return sslConfig.getValidate();
      default:
        throw new IllegalArgumentException("OpenMetadata doesn't support SSL verification type " + verifySSL.value());
    }
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
        "org.openmetadata.schema.services.connections." + connectionPackage + "." + connectionType + "Connection";
    return Class.forName(clazzName);
  }

  protected String extractConnectionPackageName(ServiceType serviceType) {
    // All package names must be lowercase per java naming convention
    return serviceType.value().toLowerCase(Locale.ROOT);
  }

  public abstract Object storeTestConnectionObject(TestServiceConnection testServiceConnection);
}
