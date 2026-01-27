package org.openmetadata.service.exception;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.Charset;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.eclipse.jetty.ee10.servlet.ErrorPageErrorHandler;
import org.eclipse.jetty.http.HttpField;
import org.eclipse.jetty.http.HttpHeader;
import org.eclipse.jetty.server.Request;
import org.eclipse.jetty.server.Response;
import org.eclipse.jetty.util.Callback;
import org.openmetadata.service.config.OMWebConfiguration;

/**
 * Custom error page handler that adds security headers to error responses. This is compatible with
 * Jetty 12.1.x which uses the new Request/Response/Callback API pattern.
 */
@Slf4j
public class OMErrorPageHandler extends ErrorPageErrorHandler {
  private static final String CACHE_CONTROL_HEADER = "Cache-Control";
  private static final String PRAGMA_HEADER = "Pragma";
  private final OMWebConfiguration webConfiguration;

  public OMErrorPageHandler(OMWebConfiguration webConfiguration) {
    this.webConfiguration = webConfiguration;
  }

  @Override
  protected boolean generateAcceptableResponse(
      Request request,
      Response response,
      Callback callback,
      String contentType,
      List<Charset> charsets,
      int code,
      String message,
      Throwable cause)
      throws IOException {
    // Add security headers to the response before generating the error page
    setSecurityHeaders(this.webConfiguration, response);
    return super.generateAcceptableResponse(
        request, response, callback, contentType, charsets, code, message, cause);
  }

  /**
   * Sets security headers on the Jetty Response object (new Jetty 12.1 API).
   *
   * @param webConfiguration the web configuration containing header settings
   * @param response the Jetty Response object
   */
  public static void setSecurityHeaders(OMWebConfiguration webConfiguration, Response response) {
    // Hsts
    if (webConfiguration.getHstsHeaderFactory() != null) {
      webConfiguration
          .getHstsHeaderFactory()
          .build()
          .forEach((name, value) -> response.getHeaders().put(new HttpField(name, value)));
    }

    // Frame Options
    if (webConfiguration.getFrameOptionsHeaderFactory() != null) {
      webConfiguration
          .getFrameOptionsHeaderFactory()
          .build()
          .forEach((name, value) -> response.getHeaders().put(new HttpField(name, value)));
    }

    // Content Type Options
    if (webConfiguration.getContentTypeOptionsHeaderFactory() != null) {
      webConfiguration
          .getContentTypeOptionsHeaderFactory()
          .build()
          .forEach((name, value) -> response.getHeaders().put(new HttpField(name, value)));
    }

    // XSS Protection
    if (webConfiguration.getXssProtectionHeaderFactory() != null) {
      webConfiguration
          .getXssProtectionHeaderFactory()
          .build()
          .forEach((name, value) -> response.getHeaders().put(new HttpField(name, value)));
    }

    // CSP
    if (webConfiguration.getCspHeaderFactory() != null) {
      webConfiguration
          .getCspHeaderFactory()
          .build()
          .forEach((name, value) -> response.getHeaders().put(new HttpField(name, value)));
    }

    // Referrer Policy
    if (webConfiguration.getReferrerPolicyHeaderFactory() != null) {
      webConfiguration
          .getReferrerPolicyHeaderFactory()
          .build()
          .forEach((name, value) -> response.getHeaders().put(new HttpField(name, value)));
    }

    // Permission Policy
    if (webConfiguration.getPermissionPolicyHeaderFactory() != null) {
      webConfiguration
          .getPermissionPolicyHeaderFactory()
          .build()
          .forEach((name, value) -> response.getHeaders().put(new HttpField(name, value)));
    }

    // Cache-Control
    if (!nullOrEmpty(webConfiguration.getCacheControl())) {
      response.getHeaders().put(HttpHeader.CACHE_CONTROL, webConfiguration.getCacheControl());
    }

    // Pragma
    if (!nullOrEmpty(webConfiguration.getPragma())) {
      response.getHeaders().put(HttpHeader.PRAGMA, webConfiguration.getPragma());
    }

    // Additional Headers
    webConfiguration
        .getHeaders()
        .forEach((name, value) -> response.getHeaders().put(new HttpField(name, value)));
  }

  /**
   * Sets security headers on a servlet HttpServletResponse object. This method is kept for
   * compatibility with other parts of the application that use servlet API.
   *
   * @param webConfiguration the web configuration containing header settings
   * @param response the servlet HttpServletResponse object
   */
  public static void setSecurityHeader(
      OMWebConfiguration webConfiguration, HttpServletResponse response) {
    // Hsts
    if (webConfiguration.getHstsHeaderFactory() != null) {
      webConfiguration.getHstsHeaderFactory().build().forEach(response::setHeader);
    }

    // Frame Options
    if (webConfiguration.getFrameOptionsHeaderFactory() != null) {
      webConfiguration.getFrameOptionsHeaderFactory().build().forEach(response::setHeader);
    }

    // Content Type Options
    if (webConfiguration.getContentTypeOptionsHeaderFactory() != null) {
      webConfiguration.getContentTypeOptionsHeaderFactory().build().forEach(response::setHeader);
    }

    // XSS Protection
    if (webConfiguration.getXssProtectionHeaderFactory() != null) {
      webConfiguration.getXssProtectionHeaderFactory().build().forEach(response::setHeader);
    }

    // CSP
    if (webConfiguration.getCspHeaderFactory() != null) {
      webConfiguration.getCspHeaderFactory().build().forEach(response::setHeader);
    }

    // Referrer Policy
    if (webConfiguration.getReferrerPolicyHeaderFactory() != null) {
      webConfiguration.getReferrerPolicyHeaderFactory().build().forEach(response::setHeader);
    }

    // Permission Policy
    if (webConfiguration.getPermissionPolicyHeaderFactory() != null) {
      webConfiguration.getPermissionPolicyHeaderFactory().build().forEach(response::setHeader);
    }

    // Cache-Control
    if (!nullOrEmpty(webConfiguration.getCacheControl())) {
      response.setHeader(CACHE_CONTROL_HEADER, webConfiguration.getCacheControl());
    }

    // Pragma
    if (!nullOrEmpty(webConfiguration.getPragma())) {
      response.setHeader(PRAGMA_HEADER, webConfiguration.getPragma());
    }

    // Additional Headers
    webConfiguration.getHeaders().forEach(response::setHeader);
  }
}
