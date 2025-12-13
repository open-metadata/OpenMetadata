package org.openmetadata.service.config.web;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.dropwizard.core.setup.Environment;
import jakarta.servlet.DispatcherType;
import java.util.EnumSet;
import java.util.List;
import lombok.Getter;
import lombok.Setter;
import org.eclipse.jetty.ee10.servlets.CrossOriginFilter;

/**
 * Configuration factory for CORS filter.
 * This is a local copy replacing io.dropwizard.web.conf.CorsFilterFactory
 * since dropwizard-web is not yet compatible with Dropwizard 5.0.
 */
@Getter
@Setter
public class CorsFilterFactory {

  @JsonProperty("allowedOrigins")
  private List<String> allowedOrigins;

  @JsonProperty("allowedMethods")
  private List<String> allowedMethods;

  @JsonProperty("allowedHeaders")
  private List<String> allowedHeaders;

  @JsonProperty("exposedHeaders")
  private List<String> exposedHeaders;

  @JsonProperty("allowCredentials")
  private boolean allowCredentials = true;

  @JsonProperty("preflightMaxAge")
  private int preflightMaxAge = 1800;

  @JsonProperty("chainPreflight")
  private boolean chainPreflight = true;

  public void build(Environment environment, String urlPattern) {
    var filter = environment.servlets().addFilter("CORS", CrossOriginFilter.class);

    if (allowedOrigins != null && !allowedOrigins.isEmpty()) {
      filter.setInitParameter(
          CrossOriginFilter.ALLOWED_ORIGINS_PARAM, String.join(",", allowedOrigins));
    }
    if (allowedMethods != null && !allowedMethods.isEmpty()) {
      filter.setInitParameter(
          CrossOriginFilter.ALLOWED_METHODS_PARAM, String.join(",", allowedMethods));
    }
    if (allowedHeaders != null && !allowedHeaders.isEmpty()) {
      filter.setInitParameter(
          CrossOriginFilter.ALLOWED_HEADERS_PARAM, String.join(",", allowedHeaders));
    }
    if (exposedHeaders != null && !exposedHeaders.isEmpty()) {
      filter.setInitParameter(
          CrossOriginFilter.EXPOSED_HEADERS_PARAM, String.join(",", exposedHeaders));
    }
    filter.setInitParameter(
        CrossOriginFilter.ALLOW_CREDENTIALS_PARAM, String.valueOf(allowCredentials));
    filter.setInitParameter(
        CrossOriginFilter.PREFLIGHT_MAX_AGE_PARAM, String.valueOf(preflightMaxAge));
    filter.setInitParameter(
        CrossOriginFilter.CHAIN_PREFLIGHT_PARAM, String.valueOf(chainPreflight));

    filter.addMappingForUrlPatterns(EnumSet.of(DispatcherType.REQUEST), false, urlPattern);
  }
}
