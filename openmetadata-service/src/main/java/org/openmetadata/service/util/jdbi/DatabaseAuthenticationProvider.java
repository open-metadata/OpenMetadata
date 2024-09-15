package org.openmetadata.service.util.jdbi;

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
}
