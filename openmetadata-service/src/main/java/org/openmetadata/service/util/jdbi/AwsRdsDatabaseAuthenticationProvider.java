package org.openmetadata.service.util.jdbi;

import java.net.MalformedURLException;
import java.net.URI;
import java.util.Map;
import java.util.Objects;
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.rds.RdsUtilities;
import software.amazon.awssdk.services.rds.model.GenerateAuthenticationTokenRequest;
import software.amazon.awssdk.services.sts.StsClient;
import software.amazon.awssdk.services.sts.auth.StsAssumeRoleCredentialsProvider;
import software.amazon.awssdk.services.sts.model.AssumeRoleRequest;

/**
 * {@link DatabaseAuthenticationProvider} implementation for AWS RDS IAM Auth.
 *
 * @see <a href="https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.IAMDBAuth.Enabling.html"></a>
 */
public class AwsRdsDatabaseAuthenticationProvider implements DatabaseAuthenticationProvider {

  public static final String AWS_REGION = "awsRegion";
  public static final String ALLOW_PUBLIC_KEY_RETRIEVAL = "allowPublicKeyRetrieval";
  public static final String ASSUME_ROLE_ARN = "assumeRoleArn";
  public static final String PROTOCOL = "https://";

  @Override
  public String authenticate(String jdbcUrl, String username, String password) {
    try {

      URI uri = URI.create(PROTOCOL + removeProtocolFrom(jdbcUrl));
      Map<String, String> queryParams = parseQueryParams(uri.toURL());

      // Set
      String awsRegion = queryParams.get(AWS_REGION);
      String allowPublicKeyRetrieval = queryParams.get(ALLOW_PUBLIC_KEY_RETRIEVAL);
      String assumeRoleArn = queryParams.get(ASSUME_ROLE_ARN);

      // Validate
      Objects.requireNonNull(awsRegion, "Parameter `awsRegion` shall be provided in the jdbc url.");
      Objects.requireNonNull(
          allowPublicKeyRetrieval,
          "Parameter `allowPublicKeyRetrieval` shall be provided in the jdbc url.");

      AwsCredentialsProvider credentialsProvider = DefaultCredentialsProvider.create();

      if (assumeRoleArn != null) {
        StsClient stsClient =
            StsClient.builder()
                .region(Region.of(awsRegion))
                .credentialsProvider(credentialsProvider)
                .build();

        AssumeRoleRequest assumeRoleRequest =
            AssumeRoleRequest.builder()
                .roleArn(assumeRoleArn)
                .roleSessionName("OpenMetadata-RDS-IAM-Auth")
                .build();

        credentialsProvider =
            StsAssumeRoleCredentialsProvider.builder()
                .stsClient(stsClient)
                .refreshRequest(assumeRoleRequest)
                .build();
      }

      // Prepare request
      GenerateAuthenticationTokenRequest request =
          GenerateAuthenticationTokenRequest.builder()
              .credentialsProvider(credentialsProvider)
              .hostname(uri.getHost())
              .port(uri.getPort())
              .username(username)
              .build();

      // Return token
      return RdsUtilities.builder()
          .region(Region.of(awsRegion))
          .build()
          .generateAuthenticationToken(request);

    } catch (MalformedURLException e) {
      // Throw
      throw new DatabaseAuthenticationProviderException(e);
    }
  }
}
