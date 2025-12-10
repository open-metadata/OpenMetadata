package org.openmetadata.service.config.web;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Collections;
import java.util.Map;
import lombok.Getter;
import lombok.Setter;

/**
 * X-XSS-Protection header factory.
 * Replaces io.dropwizard.web.conf.XssProtectionHeaderFactory.
 */
@Getter
@Setter
public class XssProtectionHeaderFactory extends HeaderFactory {

  public static final String XSS_PROTECTION_HEADER = "X-XSS-Protection";

  @JsonProperty("enabled")
  private boolean enabled = true;

  @JsonProperty("block")
  private boolean block = true;

  @Override
  protected Map<String, String> buildHeaders() {
    if (!enabled) {
      return Collections.singletonMap(XSS_PROTECTION_HEADER, "0");
    }
    String value = block ? "1; mode=block" : "1";
    return Collections.singletonMap(XSS_PROTECTION_HEADER, value);
  }
}
