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
import java.util.List;
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.ssm.SsmClient;
import software.amazon.awssdk.services.ssm.model.DeleteParameterRequest;
import software.amazon.awssdk.services.ssm.model.GetParameterRequest;
import software.amazon.awssdk.services.ssm.model.ParameterAlreadyExistsException;
import software.amazon.awssdk.services.ssm.model.ParameterNotFoundException;
import software.amazon.awssdk.services.ssm.model.ParameterType;
import software.amazon.awssdk.services.ssm.model.PutParameterRequest;
import software.amazon.awssdk.services.ssm.model.Tag;

public class AWSSSMSecretsManager extends AWSBasedSecretsManager {
  private static AWSSSMSecretsManager instance = null;
  private SsmClient ssmClient;

  private AWSSSMSecretsManager(SecretsConfig secretsConfig) {
    super(MANAGED_AWS_SSM, secretsConfig);
  }

  @Override
  void initClientWithoutCredentials() {
    this.ssmClient = SsmClient.create();
  }

  @Override
  void initClientWithCredentials(String region, AwsCredentialsProvider staticCredentialsProvider) {
    this.ssmClient =
        SsmClient.builder()
            .region(Region.of(region))
            .credentialsProvider(staticCredentialsProvider)
            .build();
  }

  @Override
  void storeOrUpdateSecret(String secretName, String secretValue) {
    // SSM cannot create-with-tags and overwrite in one read-free call, so attempt the tagged create
    // and fall back to an overwrite when the parameter already exists. This avoids a GetParameter
    // existence probe (and its read/decrypt permission requirement) on every write.
    throttle();
    try {
      storeSecret(secretName, secretValue);
    } catch (ParameterAlreadyExistsException e) {
      throttle();
      updateSecret(secretName, secretValue);
    }
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
    PutParameterRequest.Builder requestBuilder =
        PutParameterRequest.builder()
            .name(parameterName)
            .description("This secret parameter was created by OpenMetadata")
            .value(parameterValue)
            .overwrite(overwrite)
            .type(ParameterType.SECURE_STRING);
    // AWS SSM rejects PutParameter when Overwrite and Tags are sent together. Tags are applied
    // only on creation; an overwrite (update/rotation) leaves the existing parameter's tags as-is.
    if (!overwrite) {
      requestBuilder.tags(buildTags());
    }
    this.ssmClient.putParameter(requestBuilder.build());
  }

  private List<Tag> buildTags() {
    return SecretsManager.getTags(getSecretsConfig()).entrySet().stream()
        .map(entry -> Tag.builder().key(entry.getKey()).value(entry.getValue()).build())
        .toList();
  }

  @Override
  public String getSecret(String secretName) {
    GetParameterRequest parameterRequest =
        GetParameterRequest.builder().name(secretName).withDecryption(true).build();
    return ssmClient.getParameter(parameterRequest).parameter().value();
  }

  @Override
  protected void deleteSecretInternal(String secretName) {
    DeleteParameterRequest deleteParameterRequest =
        DeleteParameterRequest.builder().name(secretName).build();
    this.ssmClient.deleteParameter(deleteParameterRequest);
  }

  @Override
  protected boolean isNotFoundException(Exception exception) {
    return exception instanceof ParameterNotFoundException;
  }

  public static AWSSSMSecretsManager getInstance(SecretsConfig secretsConfig) {
    if (instance == null) instance = new AWSSSMSecretsManager(secretsConfig);
    return instance;
  }

  @VisibleForTesting
  protected void setSsmClient(SsmClient ssmClient) {
    this.ssmClient = ssmClient;
  }
}
