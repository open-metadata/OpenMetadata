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
  private static AWSSecretsManager instance = null;
  private static final String SECRET_MANAGER_ARN_RESOURCE_SEGMENT = ":secret:";
  private static final String ARN_SUFFIX_SEPARATOR = "-";
  private static final int ARN_SUFFIX_LENGTH = 6;
  private static final Pattern ALPHANUMERIC_SUFFIX = Pattern.compile("[a-zA-Z0-9]{6}");
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

  /**
   * Secrets Manager's ARN carries the secret name after a {@code secret:} segment (the resource
   * separator is a colon, unlike SSM's slash), and {@link #getSecret} resolves it as-is. The ARN
   * cannot contain a colon inside the name, so finding the segment recovers the name exactly.
   */
  @Override
  protected String toNativeSecretName(String secretName) {
    int resourceSegment = secretName.indexOf(SECRET_MANAGER_ARN_RESOURCE_SEGMENT);
    return resourceSegment >= 0
        ? secretName.substring(resourceSegment + SECRET_MANAGER_ARN_RESOURCE_SEGMENT.length())
        : secretName;
  }

  /**
   * AWS renames every created secret to {@code <name>-<6 random characters>}, so the ARN of the
   * secret this very field stored carries that field's id followed by a suffix the server cannot
   * recompute. A reference in that form still points at the field's own secret
   * ({@link #getSecret} accepts the suffix-less name wherever it accepts the ARN), so it counts as
   * the entity's own when the remainder is exactly a six-character alphanumeric suffix - which is
   * what AWS appends. A reference that merely extends the field id with other characters stays a
   * foreign reference, so a different entity cannot claim this field's id by prefixing.
   *
   * <p>The reference that reaches the strict encrypt pass on an unchanged save has already proven
   * itself against the stored value byte-for-byte (see {@code PasswordEntityMasker}); the random
   * suffix exists only on values the server could not have recomputed anyway, so no guessable id
   * is newly accepted.
   */
  @Override
  protected boolean matchesOwnFieldId(String requestedSecretName, String ownFieldSecretId) {
    int suffixEnd = ownFieldSecretId.length() + ARN_SUFFIX_SEPARATOR.length() + ARN_SUFFIX_LENGTH;
    return requestedSecretName.equals(ownFieldSecretId)
        || (requestedSecretName.startsWith(ownFieldSecretId + ARN_SUFFIX_SEPARATOR)
            && requestedSecretName.length() == suffixEnd
            && ALPHANUMERIC_SUFFIX
                .matcher(requestedSecretName.substring(ownFieldSecretId.length() + 1))
                .matches());
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
