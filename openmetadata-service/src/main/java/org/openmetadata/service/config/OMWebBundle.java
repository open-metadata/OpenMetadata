package org.openmetadata.service.config;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import io.dropwizard.core.Configuration;
import io.dropwizard.core.ConfiguredBundle;
import io.dropwizard.core.setup.Bootstrap;
import io.dropwizard.core.setup.Environment;
import jakarta.servlet.DispatcherType;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.Map;
import java.util.stream.Collectors;
import org.eclipse.jetty.server.session.SessionHandler;
import org.eclipse.jetty.servlet.FilterHolder;
import org.eclipse.jetty.servlets.HeaderFilter;

public abstract class OMWebBundle<T extends Configuration> implements ConfiguredBundle<T> {
  protected OMWebBundle() {}

  @Override
  public void initialize(Bootstrap<?> bootstrap) {}

  @Override
  public void run(T configuration, Environment environment) {
    OMWebConfiguration webConfig = this.getWebConfiguration(configuration);
    String urlPattern = this.deriveUrlPattern(webConfig.getUriPath());
    Map<String, String> headers = new HashMap<>();
    // Hsts
    if (webConfig.getHstsHeaderFactory() != null) {
      headers.putAll(webConfig.getHstsHeaderFactory().build());
    }

    // Frame Options
    headers.putAll(webConfig.getFrameOptionsHeaderFactory().build());

    // Content Type Options
    headers.putAll(webConfig.getContentTypeOptionsHeaderFactory().build());

    // XSS-Protection
    headers.putAll(webConfig.getXssProtectionHeaderFactory().build());

    // CSP
    if (webConfig.getCspHeaderFactory() != null) {
      headers.putAll(webConfig.getCspHeaderFactory().build());
    }

    // Referrer Policy
    if (webConfig.getReferrerPolicyHeaderFactory() != null) {
      headers.putAll(webConfig.getReferrerPolicyHeaderFactory().build());
    }

    // Permission Policy
    if (webConfig.getPermissionPolicyHeaderFactory() != null) {
      headers.putAll(webConfig.getPermissionPolicyHeaderFactory().build());
    }

    // Cache Control
    if (!nullOrEmpty(webConfig.getCacheControl())) {
      headers.put("Cache-Control", webConfig.getCacheControl());
    }

    // Pragma
    if (!nullOrEmpty(webConfig.getPragma())) {
      headers.put("Pragma", webConfig.getPragma());
    }

    // Other Headers
    headers.putAll(webConfig.getHeaders());
    this.configureHeaderFilter(environment, webConfig.getUriPath(), urlPattern, headers);
    if (webConfig.getCorsFilterFactory() != null) {
      webConfig.getCorsFilterFactory().build(environment, urlPattern);
    }
  }

  protected void configureHeaderFilter(
      Environment environment, String uriPath, String urlPattern, Map<String, String> headers) {

    String headerConfig =
        headers.entrySet().stream()
            .map(entry -> "set " + entry.getKey() + ": " + entry.getValue())
            .collect(Collectors.joining(","));

    FilterHolder holder = new FilterHolder(new HeaderFilter());
    holder.setName("header-filter-" + uriPath);
    holder.setInitParameter("headerConfig", headerConfig);

    // Add the filter to Jetty's application context with the specified URL pattern
    // Note: ensure you have a session handler if needed
    if (environment.getApplicationContext().getSessionHandler() == null) {
      environment.getApplicationContext().setSessionHandler(new SessionHandler());
    }

    environment
        .getApplicationContext()
        .addFilter(holder, urlPattern, EnumSet.of(DispatcherType.REQUEST));
  }

  private String deriveUrlPattern(String uri) {
    return uri.endsWith("/") ? uri + "*" : uri + "/*";
  }

  public abstract OMWebConfiguration getWebConfiguration(T var1);
}
