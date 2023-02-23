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

package org.openmetadata.service.secrets;

import static org.openmetadata.schema.security.secrets.SecretsManagerProvider.MANAGED_AWS;

import com.google.common.annotations.VisibleForTesting;
import java.util.Objects;
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.secretsmanager.SecretsManagerClient;
import software.amazon.awssdk.services.secretsmanager.model.CreateSecretRequest;
import software.amazon.awssdk.services.secretsmanager.model.GetSecretValueRequest;
import software.amazon.awssdk.services.secretsmanager.model.UpdateSecretRequest;

public class AWSSecretsManager extends AWSBasedSecretsManager {

  private static AWSSecretsManager INSTANCE = null;

  private SecretsManagerClient secretsClient;

  private AWSSecretsManager(SecretsManagerConfiguration config, String clusterPrefix) {
    super(MANAGED_AWS, config, clusterPrefix);
  }

  @Override
  void initClientWithoutCredentials() {
    this.secretsClient = SecretsManagerClient.create();
  }

  @Override
  void initClientWithCredentials(String region, AwsCredentialsProvider staticCredentialsProvider) {
    this.secretsClient =
        SecretsManagerClient.builder().region(Region.of(region)).credentialsProvider(staticCredentialsProvider).build();
  }

  @Override
  public void storeSecret(String secretName, String secretValue) {
    CreateSecretRequest createSecretRequest =
        CreateSecretRequest.builder()
            .name(secretName)
            .description("This secret was created by OpenMetadata")
            .secretString(Objects.isNull(secretValue) ? NULL_SECRET_STRING : secretValue)
            .build();
    this.secretsClient.createSecret(createSecretRequest);
  }

  @Override
  public void updateSecret(String secretName, String secretValue) {
    UpdateSecretRequest updateSecretRequest =
        UpdateSecretRequest.builder()
            .secretId(secretName)
            .description("This secret was created by OpenMetadata")
            .secretString(Objects.isNull(secretValue) ? NULL_SECRET_STRING : secretValue)
            .build();
    this.secretsClient.updateSecret(updateSecretRequest);
  }

  @Override
  public String getSecret(String secretName) {
    GetSecretValueRequest getSecretValueRequest = GetSecretValueRequest.builder().secretId(secretName).build();
    return this.secretsClient.getSecretValue(getSecretValueRequest).secretString();
  }

  public static AWSSecretsManager getInstance(SecretsManagerConfiguration config, String clusterPrefix) {
    if (INSTANCE == null) INSTANCE = new AWSSecretsManager(config, clusterPrefix);
    return INSTANCE;
  }

  @VisibleForTesting
  protected void setSecretsClient(SecretsManagerClient secretsClient) {
    this.secretsClient = secretsClient;
  }
}
