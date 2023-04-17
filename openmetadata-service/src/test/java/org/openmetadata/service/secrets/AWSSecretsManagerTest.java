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

import static org.mockito.Mockito.reset;

import org.mockito.Mock;
import org.openmetadata.schema.security.secrets.SecretsManagerConfiguration;
import org.openmetadata.schema.security.secrets.SecretsManagerProvider;
import software.amazon.awssdk.services.secretsmanager.SecretsManagerClient;

public class AWSSecretsManagerTest extends ExternalSecretsManagerTest {

  @Mock private SecretsManagerClient secretsManagerClient;

  @Override
  void setUpSpecific(SecretsManagerConfiguration config) {
    secretsManager = AWSSecretsManager.getInstance(config, "openmetadata");
    ((AWSSecretsManager) secretsManager).setSecretsClient(secretsManagerClient);
    reset(secretsManagerClient);
  }

  @Override
  protected SecretsManagerProvider expectedSecretManagerProvider() {
    return SecretsManagerProvider.MANAGED_AWS;
  }
}
