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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

import java.lang.reflect.Field;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.metadataIngestion.DbtPipeline;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.metadataIngestion.dbtconfig.DbtS3Config;
import org.openmetadata.schema.security.credentials.AWSCredentials;
import org.openmetadata.schema.security.secrets.Parameters;
import org.openmetadata.schema.security.secrets.SecretsManagerConfiguration;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.fernet.Fernet;

@ExtendWith(MockitoExtension.class)
public abstract class AWSBasedSecretsManagerTest extends ExternalSecretsManagerTest {

  @BeforeEach
  void setUp() {
    // Ensure AWS system properties are set at the instance level too
    System.setProperty("aws.region", "us-east-1");
    System.setProperty("aws.accessKeyId", "test-access-key");
    System.setProperty("aws.secretAccessKey", "test-secret-key");

    Fernet fernet = Fernet.getInstance();
    fernet.setFernetKey("jJ/9sz0g0OHxsfxOoSfdFdmk3ysNmPRnH3TUAbz3IHA=");
    Parameters parameters = new Parameters();
    parameters.setAdditionalProperty("region", "us-east-1");
    parameters.setAdditionalProperty("accessKeyId", "test-access-key");
    parameters.setAdditionalProperty("secretAccessKey", "test-secret-key");
    SecretsManagerConfiguration config = new SecretsManagerConfiguration();
    config.setParameters(parameters);
    setUpSpecific(config);
  }

  @AfterEach
  void tearDown() {
    // Clear AWS system properties
    System.clearProperty("aws.region");
    System.clearProperty("aws.accessKeyId");
    System.clearProperty("aws.secretAccessKey");

    // Reset singleton instances using reflection to ensure test isolation
    try {
      resetSingleton("org.openmetadata.service.secrets.AWSSecretsManager");
      resetSingleton("org.openmetadata.service.secrets.AWSSSMSecretsManager");
    } catch (Exception e) {
      // Ignore reflection exceptions in test cleanup
    }
  }

  private void resetSingleton(String className) throws Exception {
    Class<?> clazz = Class.forName(className);
    Field instanceField = clazz.getDeclaredField("instance");
    instanceField.setAccessible(true);
    instanceField.set(null, null);
  }

  @Test
  void testEncryptDecryptIngestionPipelineDBTConfig() {
    String secretKey =
        "secret:/openmetadata/pipeline/my-pipeline/sourceconfig/config/dbtconfigsource"
            + "/dbtsecurityconfig/awssecretaccesskey";
    AWSCredentials credentials =
        new AWSCredentials().withAwsSecretAccessKey(secretKey).withAwsRegion("eu-west-1");
    DbtS3Config config = new DbtS3Config().withDbtSecurityConfig(credentials);
    DbtPipeline dbtPipeline = new DbtPipeline().withDbtConfigSource(config);
    SourceConfig sourceConfig = new SourceConfig().withConfig(dbtPipeline);
    IngestionPipeline expectedIngestionPipeline =
        new IngestionPipeline()
            .withName("my-pipeline")
            .withPipelineType(PipelineType.DBT)
            .withService(
                new DatabaseService().getEntityReference().withType(Entity.DATABASE_SERVICE))
            .withSourceConfig(sourceConfig);

    IngestionPipeline actualIngestionPipeline =
        JsonUtils.convertValue(expectedIngestionPipeline, IngestionPipeline.class);

    // Encrypt the pipeline and make sure it is secret key encrypted
    secretsManager.encryptIngestionPipeline(actualIngestionPipeline);
    assertNotEquals(secretKey, getAwsSecretAccessKey(actualIngestionPipeline));

    // Decrypt the pipeline and make sure the secret key is decrypted
    secretsManager.decryptIngestionPipeline(actualIngestionPipeline);
    assertEquals(secretKey, getAwsSecretAccessKey(actualIngestionPipeline));
    assertEquals(expectedIngestionPipeline, actualIngestionPipeline);
  }

  private String getAwsSecretAccessKey(IngestionPipeline ingestionPipeline) {
    DbtPipeline expectedDbtPipeline =
        ((DbtPipeline) ingestionPipeline.getSourceConfig().getConfig());
    return ((DbtS3Config) expectedDbtPipeline.getDbtConfigSource())
        .getDbtSecurityConfig()
        .getAwsSecretAccessKey();
  }
}
