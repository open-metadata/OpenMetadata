package org.openmetadata.mcp.server.auth;

import java.util.Arrays;
import java.util.Collection;
import java.util.List;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Utility class for validating OAuth scopes against required scopes.
 *
 * <p>This validator supports two modes of validation:
 *
 * <ul>
 *   <li><b>OR mode</b> (default): At least one of the required scopes must be present
 *   <li><b>AND mode</b>: All required scopes must be present
 * </ul>
 *
 * <p>Example usage:
 *
 * <pre>
 * List&lt;String&gt; granted = Arrays.asList("metadata:read", "metadata:write");
 * String[] required = {"metadata:read"};
 *
 * // OR mode - succeeds if at least one scope matches
 * ScopeValidator.validateScopes(granted, required, false);
 *
 * // AND mode - succeeds only if all scopes are present
 * ScopeValidator.validateScopes(granted, new String[]{"metadata:read", "metadata:write"}, true);
 * </pre>
 */
public class ScopeValidator {

  private static final Logger LOG = LoggerFactory.getLogger(ScopeValidator.class);

  private ScopeValidator() {
    // Utility class, prevent instantiation
  }

  /**
   * Validates that the granted scopes satisfy the required scopes.
   *
   * @param grantedScopes the scopes granted to the user (from access token)
   * @param requiredScopes the scopes required for the operation
   * @param requireAll if true, all required scopes must be present; if false, at least one must be
   *     present
   * @throws AuthorizationException if the validation fails
   */
  public static void validateScopes(
      List<String> grantedScopes, String[] requiredScopes, boolean requireAll) {
    if (requiredScopes == null || requiredScopes.length == 0) {
      // No scopes required, validation passes
      return;
    }

    if (grantedScopes == null || grantedScopes.isEmpty()) {
      String message =
          String.format(
              "Access denied: Required scopes %s, but no scopes granted",
              Arrays.toString(requiredScopes));
      LOG.warn(message);
      throw new AuthorizationException(message, Arrays.asList(requiredScopes), List.of());
    }

    List<String> requiredList = Arrays.asList(requiredScopes);

    if (requireAll) {
      // AND mode: all required scopes must be present
      List<String> missingScopes =
          requiredList.stream()
              .filter(scope -> !grantedScopes.contains(scope))
              .collect(Collectors.toList());

      if (!missingScopes.isEmpty()) {
        String message =
            String.format(
                "Access denied: All scopes %s are required, but missing %s. Granted scopes: %s",
                requiredList, missingScopes, grantedScopes);
        LOG.warn(message);
        throw new AuthorizationException(message, requiredList, grantedScopes);
      }
    } else {
      // OR mode: at least one required scope must be present
      boolean hasAnyScope = requiredList.stream().anyMatch(scope -> grantedScopes.contains(scope));

      if (!hasAnyScope) {
        String message =
            String.format(
                "Access denied: At least one of %s is required. Granted scopes: %s",
                requiredList, grantedScopes);
        LOG.warn(message);
        throw new AuthorizationException(message, requiredList, grantedScopes);
      }
    }

    LOG.debug(
        "Scope validation passed. Required: {}, Granted: {}, RequireAll: {}",
        requiredList,
        grantedScopes,
        requireAll);
  }

  /**
   * Validates that the granted scopes satisfy the required scopes (OR mode).
   *
   * @param grantedScopes the scopes granted to the user (from access token)
   * @param requiredScopes the scopes required for the operation
   * @throws AuthorizationException if none of the required scopes are present
   */
  public static void validateScopes(List<String> grantedScopes, String[] requiredScopes) {
    validateScopes(grantedScopes, requiredScopes, false);
  }

  /**
   * Checks if the granted scopes satisfy the required scopes without throwing an exception.
   *
   * @param grantedScopes the scopes granted to the user (from access token)
   * @param requiredScopes the scopes required for the operation
   * @param requireAll if true, all required scopes must be present; if false, at least one must be
   *     present
   * @return true if validation passes, false otherwise
   */
  public static boolean hasRequiredScopes(
      List<String> grantedScopes, String[] requiredScopes, boolean requireAll) {
    try {
      validateScopes(grantedScopes, requiredScopes, requireAll);
      return true;
    } catch (AuthorizationException e) {
      return false;
    }
  }

  /**
   * Checks if the granted scopes contain at least one of the required scopes.
   *
   * @param grantedScopes the scopes granted to the user (from access token)
   * @param requiredScopes the scopes required for the operation
   * @return true if at least one required scope is present, false otherwise
   */
  public static boolean hasAnyScope(Collection<String> grantedScopes, String... requiredScopes) {
    if (requiredScopes == null || requiredScopes.length == 0) {
      return true;
    }
    if (grantedScopes == null || grantedScopes.isEmpty()) {
      return false;
    }
    return Arrays.stream(requiredScopes).anyMatch(grantedScopes::contains);
  }

  /**
   * Checks if the granted scopes contain all of the required scopes.
   *
   * @param grantedScopes the scopes granted to the user (from access token)
   * @param requiredScopes the scopes required for the operation
   * @return true if all required scopes are present, false otherwise
   */
  public static boolean hasAllScopes(Collection<String> grantedScopes, String... requiredScopes) {
    if (requiredScopes == null || requiredScopes.length == 0) {
      return true;
    }
    if (grantedScopes == null || grantedScopes.isEmpty()) {
      return false;
    }
    return Arrays.stream(requiredScopes).allMatch(grantedScopes::contains);
  }
}
