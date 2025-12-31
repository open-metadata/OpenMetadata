package org.openmetadata.mcp.server.auth.annotations;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Annotation to specify required OAuth scopes for MCP tool execution.
 *
 * <p>This annotation can be applied to classes (tool implementations) or methods to enforce
 * scope-based authorization. When a tool is invoked, the system will validate that the access token
 * contains at least one of the required scopes.
 *
 * <p>Example usage:
 *
 * <pre>
 * &#64;RequireScope({"metadata:read"})
 * public class SearchMetadataTool implements McpTool {
 *   // Tool implementation
 * }
 *
 * &#64;RequireScope({"metadata:write"})
 * public class PatchEntityTool implements McpTool {
 *   // Tool implementation
 * }
 * </pre>
 *
 * <p>Standard scopes:
 *
 * <ul>
 *   <li><code>metadata:read</code> - Read-only access to metadata resources
 *   <li><code>metadata:write</code> - Write access to metadata resources
 *   <li><code>connector:access</code> - Access to connector operations
 * </ul>
 */
@Documented
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.TYPE, ElementType.METHOD})
public @interface RequireScope {

  /**
   * The required OAuth scopes. At least one of the specified scopes must be present in the access
   * token for authorization to succeed.
   *
   * @return an array of required scope strings
   */
  String[] value();

  /**
   * Whether all specified scopes are required (AND logic) or just one (OR logic). Default is false
   * (OR logic - at least one scope required).
   *
   * @return true if all scopes are required, false if at least one is sufficient
   */
  boolean requireAll() default false;
}
