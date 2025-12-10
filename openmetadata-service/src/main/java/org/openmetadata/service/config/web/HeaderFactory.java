package org.openmetadata.service.config.web;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Collections;
import java.util.Map;
import lombok.Getter;
import lombok.Setter;

/**
 * Base class for header factories that build HTTP security headers.
 * This is a local copy replacing io.dropwizard.web.conf.HeaderFactory
 * since dropwizard-web is not yet compatible with Dropwizard 5.0.
 */
@Getter
@Setter
public abstract class HeaderFactory {

  @JsonProperty("enabled")
  private boolean enabled = false;

  public Map<String, String> build() {
    if (!enabled) {
      return Collections.emptyMap();
    }
    return buildHeaders();
  }

  protected abstract Map<String, String> buildHeaders();
}
