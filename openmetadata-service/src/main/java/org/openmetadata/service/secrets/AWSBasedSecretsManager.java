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

import org.apache.logging.log4j.util.Strings;
import org.openmetadata.schema.security.secrets.SecretsManagerProvider;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;

public abstract class AWSBasedSecretsManager extends ExternalSecretsManager {

  public static final String ACCESS_KEY_ID = "accessKeyId";
  public static final String SECRET_ACCESS_KEY = "secretAccessKey";
  public static final String REGION = "region";

  protected AWSBasedSecretsManager(
      SecretsManagerProvider awsProvider, SecretsManagerConfiguration config, String clusterPrefix) {
    super(awsProvider, clusterPrefix, 100);
    // initialize the secret client depending on the SecretsManagerConfiguration passed
    if (config != null
        && config.getParameters() != null
        && !Strings.isBlank(config.getParameters().getOrDefault(REGION, ""))) {
      String region = config.getParameters().getOrDefault(REGION, "");
      String accessKeyId = config.getParameters().getOrDefault(ACCESS_KEY_ID, "");
      String secretAccessKey = config.getParameters().getOrDefault(SECRET_ACCESS_KEY, "");
      AwsCredentialsProvider credentialsProvider;
      if (Strings.isBlank(accessKeyId) && Strings.isBlank(secretAccessKey)) {
        credentialsProvider = DefaultCredentialsProvider.create();
      } else {
        credentialsProvider =
            StaticCredentialsProvider.create(AwsBasicCredentials.create(accessKeyId, secretAccessKey));
      }
      initClientWithCredentials(region, credentialsProvider);
    } else {
      // initialized with the region loaded from the DefaultAwsRegionProviderChain and credentials loaded from the
      // DefaultCredentialsProvider
      initClientWithoutCredentials();
    }
  }

  abstract void initClientWithoutCredentials();

  abstract void initClientWithCredentials(String region, AwsCredentialsProvider staticCredentialsProvider);
}
