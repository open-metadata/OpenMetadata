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

import static org.openmetadata.schema.security.secrets.SecretsManagerProvider.MANAGED_AWS_SSM;

import com.google.common.annotations.VisibleForTesting;
import org.openmetadata.schema.security.secrets.SecretsManagerConfiguration;
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.ssm.SsmClient;
import software.amazon.awssdk.services.ssm.model.DeleteParameterRequest;
import software.amazon.awssdk.services.ssm.model.GetParameterRequest;
import software.amazon.awssdk.services.ssm.model.ParameterType;
import software.amazon.awssdk.services.ssm.model.PutParameterRequest;
import software.amazon.awssdk.services.ssm.model.Tag;

public class AWSSSMSecretsManager extends AWSBasedSecretsManager {
  private static AWSSSMSecretsManager instance = null;
  private SsmClient ssmClient;

  private AWSSSMSecretsManager(SecretsManagerConfiguration config, SecretsConfig secretsConfig) {
    super(MANAGED_AWS_SSM, config, secretsConfig);
  }

  @Override
  void initClientWithoutCredentials() {
    this.ssmClient = SsmClient.create();
  }

  @Override
  void initClientWithCredentials(String region, AwsCredentialsProvider staticCredentialsProvider) {
    this.ssmClient =
        SsmClient.builder().region(Region.of(region)).credentialsProvider(staticCredentialsProvider).build();
  }

  @Override
  public void storeSecret(String secretName, String secretValue) {
    putSecretParameter(secretName, secretValue, false);
  }

  @Override
  public void updateSecret(String secretName, String secretValue) {
    putSecretParameter(secretName, secretValue, true);
  }

  private void putSecretParameter(String parameterName, String parameterValue, boolean overwrite) {
    PutParameterRequest putParameterRequest =
        PutParameterRequest.builder()
            .name(parameterName)
            .description("This secret parameter was created by OpenMetadata")
            .value(parameterValue)
            .overwrite(overwrite)
            .type(ParameterType.SECURE_STRING)
            .tags(
                this.getSecretsConfig().getTags().entrySet().stream()
                    .map(entry -> Tag.builder().key(entry.getKey()).value(entry.getValue()).build())
                    .toList())
            .build();
    this.ssmClient.putParameter(putParameterRequest);
  }

  @Override
  public String getSecret(String secretName) {
    GetParameterRequest parameterRequest = GetParameterRequest.builder().name(secretName).withDecryption(true).build();
    return ssmClient.getParameter(parameterRequest).parameter().value();
  }

  @Override
  protected void deleteSecretInternal(String secretName) {
    DeleteParameterRequest deleteParameterRequest = DeleteParameterRequest.builder().name(secretName).build();
    this.ssmClient.deleteParameter(deleteParameterRequest);
  }

  public static AWSSSMSecretsManager getInstance(SecretsManagerConfiguration config, SecretsConfig secretsConfig) {
    if (instance == null) instance = new AWSSSMSecretsManager(config, secretsConfig);
    return instance;
  }

  @VisibleForTesting
  protected void setSsmClient(SsmClient ssmClient) {
    this.ssmClient = ssmClient;
  }
}
