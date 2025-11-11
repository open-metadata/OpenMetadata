package org.openmetadata.service.util.jdbi;

import jakarta.validation.constraints.NotNull;
import java.net.URL;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Database authentication provider is the main interface responsible for all implementation that requires additional
 * authentication steps required by the database in order to authorize a user to be able to operate on it.
 *
 * <p>For example if a jdbc url requires to retrieve and authorized token this interface shall be implemented to
 * retrieve the token.
 */
public interface DatabaseAuthenticationProvider {

  /**
   * Authenticate a user for the given jdbc url.
   *
   * @return authorization token
   */
  String authenticate(String jdbcUrl, String username, String password);

  @NotNull
  default String removeProtocolFrom(String jdbcUrl) {
    return jdbcUrl.substring(jdbcUrl.indexOf("://") + 3);
  }

  default Map<String, String> parseQueryParams(URL url) {
    // Prepare
    Map<String, String> queryPairs = new LinkedHashMap<>();
    String query = url.getQuery();
    String[] pairs = query.split("&");

    // Loop
    for (String pair : pairs) {
      int idx = pair.indexOf("=");
      // Add
      queryPairs.put(
          URLDecoder.decode(pair.substring(0, idx), StandardCharsets.UTF_8),
          URLDecoder.decode(pair.substring(idx + 1), StandardCharsets.UTF_8));
    }
    // Return
    return queryPairs;
  }
}
