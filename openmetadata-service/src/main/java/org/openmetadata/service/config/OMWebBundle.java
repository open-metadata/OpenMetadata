package org.openmetadata.service.config;

import io.dropwizard.Configuration;
import io.dropwizard.ConfiguredBundle;
import io.dropwizard.setup.Bootstrap;
import io.dropwizard.setup.Environment;
import java.util.Collections;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.Map;
import java.util.stream.Collectors;
import javax.servlet.DispatcherType;
import javax.servlet.FilterRegistration;
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

    // Other Headers
    headers.putAll(webConfig.getHeaders());
    this.configureHeaderFilter(environment, webConfig.getUriPath(), urlPattern, headers);
    if (webConfig.getCorsFilterFactory() != null) {
      webConfig.getCorsFilterFactory().build(environment, urlPattern);
    }
  }

  protected void configureHeaderFilter(
    Environment environment,
    String uriPath,
    String urlPattern,
    Map<String, String> headers
  ) {
    String headerConfig = headers
      .entrySet()
      .stream()
      .map(entry -> "set " + entry.getKey() + ": " + entry.getValue())
      .collect(Collectors.joining(","));
    Map<String, String> filterConfig = Collections.singletonMap("headerConfig", headerConfig);
    FilterRegistration.Dynamic filter = environment
      .servlets()
      .addFilter("header-filter-" + uriPath, HeaderFilter.class);
    filter.addMappingForUrlPatterns(EnumSet.of(DispatcherType.REQUEST), true, urlPattern);
    filter.setInitParameters(filterConfig);
  }

  private String deriveUrlPattern(String uri) {
    return uri.endsWith("/") ? uri + "*" : uri + "/*";
  }

  public abstract OMWebConfiguration getWebConfiguration(T var1);
}
