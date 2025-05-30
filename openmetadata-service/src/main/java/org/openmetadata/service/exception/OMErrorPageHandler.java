package org.openmetadata.service.exception;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.eclipse.jetty.ee10.servlet.ErrorPageErrorHandler;
import org.openmetadata.service.config.OMWebConfiguration;

@Slf4j
public class OMErrorPageHandler extends ErrorPageErrorHandler {
  private static final String CACHE_CONTROL_HEADER = "Cache-Control";
  private static final String PRAGMA_HEADER = "Pragma";
  private final OMWebConfiguration webConfiguration;

  public OMErrorPageHandler(OMWebConfiguration webConfiguration) {
    this.webConfiguration = webConfiguration;
  }

  // Note: The service method no longer exists in Jetty 12 ErrorPageErrorHandler
  // The security headers can be set through other mechanisms or custom error pages

  public static void setSecurityHeader(
      OMWebConfiguration webConfiguration, HttpServletResponse response) {
    // Attach Response Header from OM
    // Hsts
    webConfiguration.getHstsHeaderFactory().build().forEach(response::setHeader);

    // Frame Options
    webConfiguration.getFrameOptionsHeaderFactory().build().forEach(response::setHeader);

    // Content Option
    webConfiguration.getContentTypeOptionsHeaderFactory().build().forEach(response::setHeader);

    // Xss Protections
    webConfiguration.getXssProtectionHeaderFactory().build().forEach(response::setHeader);

    // CSP
    webConfiguration.getCspHeaderFactory().build().forEach(response::setHeader);

    // Referrer Policy
    webConfiguration.getReferrerPolicyHeaderFactory().build().forEach(response::setHeader);

    // Policy Permission
    webConfiguration.getPermissionPolicyHeaderFactory().build().forEach(response::setHeader);

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
