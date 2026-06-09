package org.openmetadata.service.util.jdbi;

import java.net.MalformedURLException;
import java.net.URI;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.openmetadata.common.utils.CommonUtil;
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
public class AwsRdsDatabaseAuthenticationProvider
    implements DatabaseAuthenticationProvider, AutoCloseable {

  public static final String AWS_REGION = "awsRegion";
  public static final String ALLOW_PUBLIC_KEY_RETRIEVAL = "allowPublicKeyRetrieval";
  public static final String ASSUME_ROLE_ARN = "assumeRoleArn";
  public static final String PROTOCOL = "https://";

  private final Map<String, AwsCredentialsProvider> credentialsProviderCache =
      new ConcurrentHashMap<>();
  private final Map<String, StsClient> stsClientCache = new ConcurrentHashMap<>();
  private final Map<String, RdsUtilities> rdsUtilitiesCache = new ConcurrentHashMap<>();
  private static final AwsCredentialsProvider DEFAULT_CREDENTIALS_PROVIDER =
      DefaultCredentialsProvider.create();

  @Override
  public String authenticate(final String jdbcUrl, final String username, final String password) {
    try {
      final URI uri = URI.create(PROTOCOL + removeProtocolFrom(jdbcUrl));
      final Map<String, String> queryParams = parseQueryParams(uri.toURL());

      // Set
      final String awsRegion = queryParams.get(AWS_REGION);
      final String allowPublicKeyRetrieval = queryParams.get(ALLOW_PUBLIC_KEY_RETRIEVAL);
      final String assumeRoleArn = queryParams.get(ASSUME_ROLE_ARN);

      // Validate
      if (CommonUtil.nullOrEmpty(awsRegion)) {
        throw new DatabaseAuthenticationProviderException(
            "Parameter `awsRegion` shall be provided in the jdbc url.");
      }
      if (CommonUtil.nullOrEmpty(allowPublicKeyRetrieval)) {
        throw new DatabaseAuthenticationProviderException(
            "Parameter `allowPublicKeyRetrieval` shall be provided in the jdbc url.");
      }

      final AwsCredentialsProvider credentialsProvider =
          getCredentialsProvider(awsRegion, assumeRoleArn);

      // Prepare request
      final GenerateAuthenticationTokenRequest request =
          GenerateAuthenticationTokenRequest.builder()
              .credentialsProvider(credentialsProvider)
              .hostname(uri.getHost())
              .port(uri.getPort())
              .username(username)
              .build();

      // Return token
      return getRdsUtilities(awsRegion).generateAuthenticationToken(request);

    } catch (MalformedURLException e) {
      // Throw
      throw new DatabaseAuthenticationProviderException(e);
    } catch (Exception e) {
      throw new DatabaseAuthenticationProviderException("Failed to generate AWS RDS IAM token", e);
    }
  }

  private RdsUtilities getRdsUtilities(final String awsRegion) {
    return rdsUtilitiesCache.computeIfAbsent(
        awsRegion, region -> RdsUtilities.builder().region(Region.of(region)).build());
  }

  private AwsCredentialsProvider getCredentialsProvider(
      final String awsRegion, final String assumeRoleArn) {
    if (CommonUtil.nullOrEmpty(assumeRoleArn)) {
      return DEFAULT_CREDENTIALS_PROVIDER;
    }

    final String cacheKey = awsRegion + ":" + assumeRoleArn;
    return credentialsProviderCache.computeIfAbsent(
        cacheKey,
        k -> {
          final StsClient stsClient =
              stsClientCache.computeIfAbsent(
                  awsRegion,
                  region ->
                      StsClient.builder()
                          .region(Region.of(region))
                          .credentialsProvider(DEFAULT_CREDENTIALS_PROVIDER)
                          .build());

          final AssumeRoleRequest assumeRoleRequest =
              AssumeRoleRequest.builder()
                  .roleArn(assumeRoleArn)
                  .roleSessionName("OpenMetadata-RDS-IAM-Auth")
                  .build();

          return StsAssumeRoleCredentialsProvider.builder()
              .stsClient(stsClient)
              .refreshRequest(assumeRoleRequest)
              .build();
        });
  }

  @Override
  public void close() {
    credentialsProviderCache
        .values()
        .forEach(
            p -> {
              if (p instanceof AutoCloseable closeable) {
                try {
                  closeable.close();
                } catch (Exception ignored) {
                  // Ignored
                }
              }
            });
    stsClientCache.values().forEach(StsClient::close);
    credentialsProviderCache.clear();
    stsClientCache.clear();
    rdsUtilitiesCache.clear();
  }
}
