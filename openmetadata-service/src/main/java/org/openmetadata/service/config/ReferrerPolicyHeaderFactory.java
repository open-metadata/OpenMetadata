package org.openmetadata.service.config;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.dropwizard.web.conf.HeaderFactory;
import java.util.Collections;
import java.util.Map;

public class ReferrerPolicyHeaderFactory extends HeaderFactory {

  public static final String REFERRER_POLICY_HEADER = "Referrer-Policy";

  @JsonProperty
  private ReferrerPolicyOption option;

  public ReferrerPolicyHeaderFactory() {
    this.option = ReferrerPolicyOption.NO_REFERRER;
  }

  public ReferrerPolicyOption getOption() {
    return this.option;
  }

  public void setOption(ReferrerPolicyOption option) {
    this.option = option;
  }

  @Override
  public Map<String, String> buildHeaders() {
    return Collections.singletonMap(REFERRER_POLICY_HEADER, this.option.getValue());
  }

  public enum ReferrerPolicyOption {
    NO_REFERRER("no-referrer"),
    NO_REFERRER_WHEN_DOWNGRADE("no-referrer-when-downgrade"),
    ORIGIN("origin"),
    ORIGIN_WHEN_CROSS_ORIGIN("origin-when-cross-origin"),
    SAME_ORIGIN("same-origin"),
    STRICT_ORIGIN("strict-origin"),
    STRICT_ORIGIN_WHEN_CROSS_ORIGIN("strict-origin-when-cross-origin"),
    UNSAFE_URL("unsafe-url");

    private final String value;

    ReferrerPolicyOption(String value) {
      this.value = value;
    }

    public String getValue() {
      return this.value;
    }
  }
}
