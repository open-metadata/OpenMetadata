package org.openmetadata.mcp.server.auth;

import org.openmetadata.mcp.server.auth.annotations.RequireScope;
import org.openmetadata.mcp.server.auth.middleware.AuthContext;
import org.openmetadata.mcp.tools.McpTool;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Interceptor for enforcing scope-based authorization on MCP tool execution.
 *
 * <p>This interceptor checks if a tool class is annotated with {@link RequireScope} and validates
 * that the current {@link AuthContext} contains the required scopes before allowing execution.
 *
 * <p>Usage example:
 *
 * <pre>
 * // Before executing a tool
 * ScopeInterceptor.validateToolScopes(tool);
 *
 * // Then execute the tool
 * tool.execute(authorizer, securityContext, params);
 * </pre>
 */
public class ScopeInterceptor {

  private static final Logger LOG = LoggerFactory.getLogger(ScopeInterceptor.class);

  private ScopeInterceptor() {
    // Utility class, prevent instantiation
  }

  /**
   * Validates that the current authentication context has the required scopes to execute the given
   * tool.
   *
   * @param tool the tool to execute
   * @throws AuthorizationException if the tool requires scopes that are not present in the current
   *     auth context
   * @throws IllegalStateException if no auth context is set for the current thread
   */
  public static void validateToolScopes(McpTool tool) {
    if (tool == null) {
      return;
    }

    // Check if the tool class has the @RequireScope annotation
    Class<?> toolClass = tool.getClass();
    RequireScope scopeAnnotation = toolClass.getAnnotation(RequireScope.class);

    if (scopeAnnotation == null) {
      // No scope requirements, allow execution
      LOG.debug("Tool {} has no scope requirements", toolClass.getSimpleName());
      return;
    }

    // Get the current auth context
    AuthContext authContext = AuthContext.getCurrent();
    if (authContext == null) {
      // OAuth scope enforcement is optional for backward compatibility with PAT tokens
      // If AuthContext is not available, skip scope validation and allow tool execution
      LOG.warn(
          "No AuthContext available for tool {}, skipping scope validation (OAuth scope enforcement disabled)",
          toolClass.getSimpleName());
      return; // Allow execution without scope checking
    }

    // Validate scopes
    String[] requiredScopes = scopeAnnotation.value();
    boolean requireAll = scopeAnnotation.requireAll();

    LOG.debug(
        "Validating scopes for tool {}. Required: {}, RequireAll: {}",
        toolClass.getSimpleName(),
        requiredScopes,
        requireAll);

    try {
      authContext.requireScopes(requiredScopes, requireAll);
      LOG.debug("Scope validation passed for tool {}", toolClass.getSimpleName());
    } catch (AuthorizationException e) {
      LOG.warn(
          "Scope validation failed for tool {}: {}", toolClass.getSimpleName(), e.getMessage());
      throw e;
    }
  }

  /**
   * Validates that the current authentication context has the required scopes to execute the given
   * tool class.
   *
   * @param toolClass the tool class to check
   * @throws AuthorizationException if the tool requires scopes that are not present in the current
   *     auth context
   * @throws IllegalStateException if no auth context is set for the current thread
   */
  public static void validateToolClassScopes(Class<? extends McpTool> toolClass) {
    if (toolClass == null) {
      return;
    }

    RequireScope scopeAnnotation = toolClass.getAnnotation(RequireScope.class);

    if (scopeAnnotation == null) {
      LOG.debug("Tool class {} has no scope requirements", toolClass.getSimpleName());
      return;
    }

    AuthContext authContext = AuthContext.getCurrent();
    if (authContext == null) {
      // OAuth scope enforcement is optional for backward compatibility with PAT tokens
      LOG.warn(
          "No AuthContext available for tool class {}, skipping scope validation (OAuth scope enforcement disabled)",
          toolClass.getSimpleName());
      return; // Allow execution without scope checking
    }

    String[] requiredScopes = scopeAnnotation.value();
    boolean requireAll = scopeAnnotation.requireAll();

    LOG.debug(
        "Validating scopes for tool class {}. Required: {}, RequireAll: {}",
        toolClass.getSimpleName(),
        requiredScopes,
        requireAll);

    authContext.requireScopes(requiredScopes, requireAll);
    LOG.debug("Scope validation passed for tool class {}", toolClass.getSimpleName());
  }

  /**
   * Checks if the current authentication context has the required scopes for a tool without
   * throwing an exception.
   *
   * @param tool the tool to check
   * @return true if the user has the required scopes or if no scopes are required, false otherwise
   */
  public static boolean hasRequiredScopes(McpTool tool) {
    try {
      validateToolScopes(tool);
      return true;
    } catch (AuthorizationException | IllegalStateException e) {
      return false;
    }
  }

  /**
   * Checks if the current authentication context has the required scopes for a tool class without
   * throwing an exception.
   *
   * @param toolClass the tool class to check
   * @return true if the user has the required scopes or if no scopes are required, false otherwise
   */
  public static boolean hasRequiredScopesForClass(Class<? extends McpTool> toolClass) {
    try {
      validateToolClassScopes(toolClass);
      return true;
    } catch (AuthorizationException | IllegalStateException e) {
      return false;
    }
  }
}
