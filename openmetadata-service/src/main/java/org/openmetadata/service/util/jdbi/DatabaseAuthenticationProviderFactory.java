package org.openmetadata.service.util.jdbi;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.net.URI;
import java.net.URLDecoder;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

/** Factory class for {@link DatabaseAuthenticationProvider}. */
public class DatabaseAuthenticationProviderFactory {
  /** C'tor */
  private DatabaseAuthenticationProviderFactory() {}

  /**
   * Get auth provider based on the given jdbc url.
   */
  public static Optional<DatabaseAuthenticationProvider> get(String jdbcURL) {
    Map<String, String> queryParams = parseQueryParams(jdbcURL);

    if ("true".equals(queryParams.get("azure"))) {
      return Optional.of(new AzureDatabaseAuthenticationProvider());
    } else if (jdbcURL.contains(AwsRdsDatabaseAuthenticationProvider.AWS_REGION)
        && jdbcURL.contains(AwsRdsDatabaseAuthenticationProvider.ALLOW_PUBLIC_KEY_RETRIEVAL)) {
      return Optional.of(new AwsRdsDatabaseAuthenticationProvider());
    }

    return Optional.empty();
  }

  private static Map<String, String> parseQueryParams(String jdbcURL) {
    try {
      URI uri = new URI(jdbcURL.substring(jdbcURL.indexOf(":") + 1));
      Map<String, String> queryPairs = new LinkedHashMap<>();
      String query = uri.getQuery();
      if (!nullOrEmpty(query)) {
        String[] pairs = query.split("&");
        for (String pair : pairs) {
          int idx = pair.indexOf("=");
          queryPairs.put(
              URLDecoder.decode(pair.substring(0, idx), "UTF-8"),
              URLDecoder.decode(pair.substring(idx + 1), "UTF-8"));
        }
      }
      return queryPairs;
    } catch (Exception e) {
      throw new IllegalArgumentException("Failed to parse query parameters from JDBC URL", e);
    }
  }
}
