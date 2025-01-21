/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.service.security.saml;

import static org.openmetadata.service.util.MicrometerBundleSingleton.prometheusMeterRegistry;

import io.micrometer.core.instrument.Timer;
import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.FilterConfig;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.util.MicrometerBundleSingleton;

/**
 * This is OMMicrometerHttpFilter is similar to MicrometerHttpFilter with support to handle OM Servlets, and provide
 * metric information for them.
 */
@Slf4j
public class OMMicrometerHttpFilter implements Filter {
  protected FilterConfig filterConfig;

  public OMMicrometerHttpFilter() {
    /* default */
  }

  @Override
  public void init(FilterConfig filterConfig) {
    this.filterConfig = filterConfig;
  }

  @Override
  public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
      throws IOException, ServletException {
    Timer.Sample timer = Timer.start(prometheusMeterRegistry);
    long startTime = System.nanoTime();
    chain.doFilter(request, response);
    double elapsed = (System.nanoTime() - startTime) / 1.0E9;
    String requestMethod = ((HttpServletRequest) request).getMethod();
    MicrometerBundleSingleton.httpRequests.labels(requestMethod).observe(elapsed);
    timer.stop(MicrometerBundleSingleton.getRequestsLatencyTimer());
  }

  @Override
  public void destroy() {
    LOG.info("OMMicrometerHttpFilter destroyed.");
  }
}
