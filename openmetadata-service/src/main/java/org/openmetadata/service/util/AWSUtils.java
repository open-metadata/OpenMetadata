package org.openmetadata.service.util;

import java.util.Objects;
import lombok.extern.slf4j.Slf4j;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.rds.RdsUtilities;
import software.amazon.awssdk.services.rds.model.GenerateAuthenticationTokenRequest;

/** Amazon utility methods used for the AWS services. */
@Slf4j
public final class AWSUtils {

  /**
   * Generate AWS database authentication token.
   *
   * @param region The AWS Region as string. Example: 'eu-west-1'.
   * @param hostName The AWS Host name.
   * @param port The AWS host port.
   * @param username The AWS username.
   * @return Generated authentication token
   * @see <a href="https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.IAMDBAuth.Enabling.html"></a>
   */
  public static String generateDBAuthToken(String region, String hostName, Integer port, String username) {
    // Validate
    Objects.requireNonNull(region, "AWS region required");
    Objects.requireNonNull(hostName, "AWS hostname required");
    Objects.requireNonNull(port, "AWS host port required");
    Objects.requireNonNull(username, "AWS UserName required");

    // Prepare request
    GenerateAuthenticationTokenRequest request =
        GenerateAuthenticationTokenRequest.builder()
            .credentialsProvider(DefaultCredentialsProvider.create())
            .hostname(hostName)
            .port(port)
            .username(username)
            .build();

    // Log it
    if (LOG.isDebugEnabled()) {
      LOG.debug("Generate AWS database auth token with TokenRequest: {}", request);
    }

    // Return token
    return RdsUtilities.builder().region(Region.of(region)).build().generateAuthenticationToken(request);
  }
}
