package org.openmetadata.service.security.saml;

import io.github.maksymdolgykh.dropwizard.micrometer.MicrometerBundle;
import java.io.IOException;
import javax.servlet.Filter;
import javax.servlet.FilterChain;
import javax.servlet.FilterConfig;
import javax.servlet.ServletException;
import javax.servlet.ServletRequest;
import javax.servlet.ServletResponse;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import org.openmetadata.common.utils.CommonUtil;

public class OMMicrometerHttpFilter implements Filter {
  protected FilterConfig filterConfig;

  public OMMicrometerHttpFilter() {}

  public void init(FilterConfig filterConfig) throws ServletException {
    this.filterConfig = filterConfig;
  }

  public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
      throws IOException, ServletException {
    long startTime = System.nanoTime();
    chain.doFilter(request, response);
    double elapsed = (double) (System.nanoTime() - startTime) / 1.0E9;
    String requestPath = ((HttpServletRequest) request).getPathInfo();
    if (CommonUtil.nullOrEmpty(requestPath)) {
      requestPath = ((HttpServletRequest) request).getServletPath();
    }
    String responseStatus = String.valueOf(((HttpServletResponse) response).getStatus());
    String requestMethod = ((HttpServletRequest) request).getMethod();
    MicrometerBundle.httpRequests.labels(requestMethod, responseStatus, requestPath).observe(elapsed);
  }

  public void destroy() {}
}
