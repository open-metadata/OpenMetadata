package org.openmetadata.service.secrets.converter;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.security.credentials.AWSCredentials;
import org.openmetadata.schema.security.credentials.AzureCredentials;
import org.openmetadata.schema.services.connections.pipeline.SSISConnection;
import org.openmetadata.schema.services.connections.storage.ADLSConnection;
import org.openmetadata.schema.services.connections.storage.S3Connection;
import org.openmetadata.schema.utils.JsonUtils;

class SsisConnectionClassConverterTest {

  private final ClassConverter converter = ClassConverterFactory.getConverter(SSISConnection.class);

  private SSISConnection roundTrip(Object packageConnection) {
    SSISConnection input = new SSISConnection().withPackageConnection(packageConnection);
    Object rawInput = JsonUtils.readValue(JsonUtils.pojoToJson(input), Object.class);
    return (SSISConnection) converter.convert(rawInput);
  }

  @Test
  void testConvertsS3PackageConnection() {
    S3Connection s3 =
        new S3Connection().withAwsConfig(new AWSCredentials().withAwsRegion("us-east-1"));

    assertInstanceOf(S3Connection.class, roundTrip(s3).getPackageConnection());
  }

  @Test
  void testConvertsAdlsPackageConnection() {
    ADLSConnection adls =
        new ADLSConnection()
            .withContainerName("ssis-packages")
            .withCredentials(
                new AzureCredentials()
                    .withClientId("client-id")
                    .withClientSecret("client-secret")
                    .withTenantId("tenant-id")
                    .withAccountName("account"));

    ADLSConnection result =
        assertInstanceOf(ADLSConnection.class, roundTrip(adls).getPackageConnection());
    assertEquals("ssis-packages", result.getContainerName());
    assertEquals("client-secret", result.getCredentials().getClientSecret());
  }

  @Test
  void testConvertsLocalPathPackageConnection() {
    assertEquals("/opt/ssis/projects", roundTrip("/opt/ssis/projects").getPackageConnection());
  }
}
