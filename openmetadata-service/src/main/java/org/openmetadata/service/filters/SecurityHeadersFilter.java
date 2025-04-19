package org.openmetadata.service.filters;

import java.io.IOException;
import java.util.List;
import javax.ws.rs.container.ContainerRequestContext;
import javax.ws.rs.container.ContainerResponseContext;
import javax.ws.rs.container.ContainerResponseFilter;
import javax.ws.rs.ext.Provider;

/**
 * A response filter that appends essential HTTP security headers to every API response.
 *
 * <p>This filter serves to:
 * <ol>
 *   <li>Prevent clickjacking by blocking the page from being embedded within frames or iframes.</li>
 *   <li>Restrict content loading to the same origin using a Content Security Policy (CSP), reducing the risk of XSS and injection attacks.</li>
 *   <li>Enable built-in browser XSS protection, halting page rendering when a threat is detected.</li>
 *   <li>Turn off MIME-type sniffing to ensure content types are strictly interpreted as declared.</li>
 *   <li>Disable caching of sensitive information by instructing the browser not to store response data.</li>
 *   <li>Include legacy cache-control directives to support older clients and browsers.</li>
 * </ol>
 */
@Provider
public class SecurityHeadersFilter implements ContainerResponseFilter {

  @Override
  public void filter(
      ContainerRequestContext requestContext, ContainerResponseContext responseContext)
      throws IOException {

    // Security headers
    responseContext
        .getHeaders()
        .putIfAbsent(
            SecurityHeaders.X_FRAME_OPTIONS, List.of(SecurityHeaders.VALUE_X_FRAME_OPTIONS));

    responseContext
        .getHeaders()
        .putIfAbsent(
            SecurityHeaders.CONTENT_SECURITY_POLICY,
            List.of(SecurityHeaders.VALUE_CONTENT_SECURITY_POLICY));

    responseContext
        .getHeaders()
        .putIfAbsent(
            SecurityHeaders.X_XSS_PROTECTION, List.of(SecurityHeaders.VALUE_X_XSS_PROTECTION));

    responseContext
        .getHeaders()
        .putIfAbsent(
            SecurityHeaders.X_CONTENT_TYPE_OPTIONS,
            List.of(SecurityHeaders.VALUE_X_CONTENT_TYPE_OPTIONS));

    // Cache control headers
    responseContext
        .getHeaders()
        .putIfAbsent(
            SecurityHeaders.CACHE_CONTROL, List.of(SecurityHeaders.VALUE_CACHE_CONTROL_NO_STORE));

    responseContext
        .getHeaders()
        .putIfAbsent(SecurityHeaders.PRAGMA, List.of(SecurityHeaders.VALUE_PRAGMA_NO_CACHE));
  }

  private static final class SecurityHeaders {
    private SecurityHeaders() {}

    // Header Names
    static final String X_FRAME_OPTIONS = "X-Frame-Options";
    static final String CONTENT_SECURITY_POLICY = "Content-Security-Policy";
    static final String X_XSS_PROTECTION = "X-XSS-Protection";
    static final String X_CONTENT_TYPE_OPTIONS = "X-Content-Type-Options";
    static final String CACHE_CONTROL = "Cache-Control";
    static final String PRAGMA = "Pragma";

    // Header Values
    static final String VALUE_X_FRAME_OPTIONS = "DENY";
    static final String VALUE_CONTENT_SECURITY_POLICY =
        "default-src 'self'; script-src 'self'; frame-ancestors 'self'; object-src 'none'; form-action 'self';";
    static final String VALUE_X_XSS_PROTECTION = "1; mode=block";
    static final String VALUE_X_CONTENT_TYPE_OPTIONS = "nosniff";
    static final String VALUE_CACHE_CONTROL_NO_STORE = "no-store";
    static final String VALUE_PRAGMA_NO_CACHE = "no-cache";
  }
}
