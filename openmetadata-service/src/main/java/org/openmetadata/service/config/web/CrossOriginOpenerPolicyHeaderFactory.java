package org.openmetadata.service.config.web;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Collections;
import java.util.Map;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CrossOriginOpenerPolicyHeaderFactory extends HeaderFactory {

  public static final String CROSS_ORIGIN_OPENER_POLICY_HEADER = "Cross-Origin-Opener-Policy";

  @JsonProperty("option")
  private CoopOption option = CoopOption.SAME_ORIGIN;

  @Override
  protected Map<String, String> buildHeaders() {
    return Collections.singletonMap(CROSS_ORIGIN_OPENER_POLICY_HEADER, option.getValue());
  }

  public enum CoopOption {
    SAME_ORIGIN("same-origin"),
    SAME_ORIGIN_ALLOW_POPUPS("same-origin-allow-popups"),
    UNSAFE_NONE("unsafe-none");

    private final String value;

    CoopOption(String value) {
      this.value = value;
    }

    public String getValue() {
      return this.value;
    }
  }
}
