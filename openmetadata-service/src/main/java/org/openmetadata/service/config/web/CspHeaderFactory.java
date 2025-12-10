package org.openmetadata.service.config.web;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Collections;
import java.util.Map;
import lombok.Getter;
import lombok.Setter;

/**
 * Content-Security-Policy header factory.
 * Replaces io.dropwizard.web.conf.CspHeaderFactory.
 */
@Getter
@Setter
public class CspHeaderFactory extends HeaderFactory {

  public static final String CSP_HEADER = "Content-Security-Policy";

  @JsonProperty("policy")
  private String policy;

  @Override
  protected Map<String, String> buildHeaders() {
    if (policy != null && !policy.isEmpty()) {
      return Collections.singletonMap(CSP_HEADER, policy);
    }
    return Collections.emptyMap();
  }
}
