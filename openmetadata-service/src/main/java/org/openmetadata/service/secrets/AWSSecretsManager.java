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
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import lombok.extern.slf4j.Slf4j;
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.secretsmanager.SecretsManagerClient;
import software.amazon.awssdk.services.secretsmanager.model.CreateSecretRequest;
import software.amazon.awssdk.services.secretsmanager.model.DeleteSecretRequest;
import software.amazon.awssdk.services.secretsmanager.model.GetSecretValueRequest;
import software.amazon.awssdk.services.secretsmanager.model.ResourceNotFoundException;
import software.amazon.awssdk.services.secretsmanager.model.Tag;
import software.amazon.awssdk.services.secretsmanager.model.UpdateSecretRequest;

@Slf4j
public class AWSSecretsManager extends AWSBasedSecretsManager {
  private static final int MAX_SECRET_NAME_LENGTH = 512;
  private static final Pattern SECRET_ARN =
      Pattern.compile("^arn:[^:]+:secretsmanager:[^:]*:[^:]*:secret:(.+?)(-[A-Za-z0-9]{6})?$");
  private static AWSSecretsManager instance = null;
  private SecretsManagerClient secretsClient;

  private AWSSecretsManager(SecretsConfig secretsConfig) {
    super(MANAGED_AWS, secretsConfig);
  }

  @Override
  void initClientWithoutCredentials() {
    this.secretsClient = SecretsManagerClient.create();
  }

  @Override
  void initClientWithCredentials(String region, AwsCredentialsProvider staticCredentialsProvider) {
    this.secretsClient =
        SecretsManagerClient.builder()
            .region(Region.of(region))
            .credentialsProvider(staticCredentialsProvider)
            .build();
  }

  @Override
  public void storeSecret(String secretName, String secretValue) {
    CreateSecretRequest createSecretRequest =
        CreateSecretRequest.builder()
            .name(secretName)
            .description("This secret was created by OpenMetadata")
            .secretString(Objects.isNull(secretValue) ? NULL_SECRET_STRING : secretValue)
            .tags(
                SecretsManager.getTags(getSecretsConfig()).entrySet().stream()
                    .map(entry -> Tag.builder().key(entry.getKey()).value(entry.getValue()).build())
                    .toList())
            .build();
    this.secretsClient.createSecret(createSecretRequest);
  }

  @Override
  public void updateSecret(String secretName, String secretValue) {
    UpdateSecretRequest updateSecretRequest =
        UpdateSecretRequest.builder()
            .secretId(secretName)
            .description("This secret was created by OpenMetadata")
            .secretString(cleanNullOrEmpty(secretValue))
            .build();
    this.secretsClient.updateSecret(updateSecretRequest);
  }

  @Override
  public String getSecret(String secretName) {
    GetSecretValueRequest getSecretValueRequest =
        GetSecretValueRequest.builder().secretId(secretName).build();
    return this.secretsClient.getSecretValue(getSecretValueRequest).secretString();
  }

  @Override
  protected void deleteSecretInternal(String secretName) {
    DeleteSecretRequest deleteSecretRequest =
        DeleteSecretRequest.builder().secretId(secretName).forceDeleteWithoutRecovery(true).build();
    this.secretsClient.deleteSecret(deleteSecretRequest);
  }

  @Override
  protected boolean isNotFoundException(Exception exception) {
    return exception instanceof ResourceNotFoundException;
  }

  @Override
  protected int maxSecretIdLength() {
    return MAX_SECRET_NAME_LENGTH;
  }

  /**
   * A secret can also be read by its ARN: the secret's name, followed in a full ARN by a hyphen and
   * six random characters. A partial ARN leaves them out, so a name that itself ends in a hyphen and
   * six letters or digits reads here as a full ARN; AWS advises against such names for that reason.
   */
  @Override
  protected String canonicalSecretName(String secretName) {
    Matcher arn = SECRET_ARN.matcher(secretName);
    return arn.matches() ? arn.group(1) : secretName;
  }

  public static AWSSecretsManager getInstance(SecretsConfig secretsConfig) {
    if (instance == null) {
      instance = new AWSSecretsManager(secretsConfig);
    }
    return instance;
  }

  @VisibleForTesting
  protected void setSecretsClient(SecretsManagerClient secretsClient) {
    this.secretsClient = secretsClient;
  }
}
