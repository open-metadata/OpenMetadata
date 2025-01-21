package org.openmetadata.service.exception;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import lombok.extern.slf4j.Slf4j;
import org.eclipse.jetty.server.Dispatcher;
import org.eclipse.jetty.server.Request;
import org.eclipse.jetty.server.handler.ContextHandler;
import org.eclipse.jetty.servlet.ErrorPageErrorHandler;
import org.openmetadata.service.config.OMWebConfiguration;

@Slf4j
public class OMErrorPageHandler extends ErrorPageErrorHandler {
  private static final String CACHE_CONTROL_HEADER = "Cache-Control";
  private static final String PRAGMA_HEADER = "Pragma";
  private final OMWebConfiguration webConfiguration;

  public OMErrorPageHandler(OMWebConfiguration webConfiguration) {
    this.webConfiguration = webConfiguration;
  }

  @Override
  public void handle(
      String target, Request baseRequest, HttpServletRequest request, HttpServletResponse response)
      throws IOException {
    this.doError(target, baseRequest, request, response);
  }

  @Deprecated
  @Override
  public void doError(
      String target, Request baseRequest, HttpServletRequest request, HttpServletResponse response)
      throws IOException {
    setSecurityHeader(this.webConfiguration, response);
    String errorPage = ((ErrorPageMapper) this).getErrorPage(request);
    ContextHandler.Context context = baseRequest.getErrorContext();
    Dispatcher errorDispatcher =
        errorPage != null && context != null
            ? (Dispatcher) context.getRequestDispatcher(errorPage)
            : null;

    try {
      if (errorDispatcher != null) {
        try {
          errorDispatcher.error(request, response);
          return;
        } catch (ServletException ex) {
          LOG.debug("Error in OMErrorPageHandler", ex);
          if (response.isCommitted()) {
            return;
          }
        }
      }

      String message = (String) request.getAttribute("javax.servlet.error.message");
      if (message == null) {
        message = baseRequest.getResponse().getReason();
      }

      this.generateAcceptableResponse(
          baseRequest, request, response, response.getStatus(), message);
    } finally {
      baseRequest.setHandled(true);
    }
  }

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
