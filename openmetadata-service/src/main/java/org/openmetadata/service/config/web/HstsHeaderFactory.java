package org.openmetadata.service.config.web;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.dropwizard.util.Duration;
import java.util.Collections;
import java.util.Map;
import lombok.Getter;
import lombok.Setter;

/**
 * HTTP Strict Transport Security (HSTS) header factory.
 * Replaces io.dropwizard.web.conf.HstsHeaderFactory.
 */
@Getter
@Setter
public class HstsHeaderFactory extends HeaderFactory {

  public static final String HSTS_HEADER = "Strict-Transport-Security";

  @JsonProperty("maxAge")
  private Duration maxAge = Duration.days(365);

  @JsonProperty("includeSubDomains")
  private boolean includeSubDomains = true;

  @JsonProperty("preload")
  private boolean preload = false;

  @Override
  protected Map<String, String> buildHeaders() {
    StringBuilder value = new StringBuilder();
    value.append("max-age=").append(maxAge.toSeconds());
    if (includeSubDomains) {
      value.append("; includeSubDomains");
    }
    if (preload) {
      value.append("; preload");
    }
    return Collections.singletonMap(HSTS_HEADER, value.toString());
  }
}
