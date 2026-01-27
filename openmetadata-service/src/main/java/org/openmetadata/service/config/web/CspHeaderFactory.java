package org.openmetadata.service.config.web;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.HashMap;
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
  public static final String CSP_REPORT_ONLY_HEADER = "Content-Security-Policy-Report-Only";

  @JsonProperty("policy")
  private String policy;

  @JsonProperty("reportOnlyPolicy")
  private String reportOnlyPolicy;

  @Override
  protected Map<String, String> buildHeaders() {
    Map<String, String> headers = new HashMap<>();
    if (policy != null && !policy.isEmpty()) {
      headers.put(CSP_HEADER, policy);
    }
    if (reportOnlyPolicy != null && !reportOnlyPolicy.isEmpty()) {
      headers.put(CSP_REPORT_ONLY_HEADER, reportOnlyPolicy);
    }
    return headers;
  }
}
