package org.openmetadata.service.config.web;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Collections;
import java.util.Map;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CrossOriginResourcePolicyHeaderFactory extends HeaderFactory {

  public static final String CROSS_ORIGIN_RESOURCE_POLICY_HEADER = "Cross-Origin-Resource-Policy";

  @JsonProperty("option")
  private CorpOption option = CorpOption.SAME_ORIGIN;

  @Override
  protected Map<String, String> buildHeaders() {
    return Collections.singletonMap(CROSS_ORIGIN_RESOURCE_POLICY_HEADER, option.getValue());
  }

  public enum CorpOption {
    SAME_SITE("same-site"),
    SAME_ORIGIN("same-origin"),
    CROSS_ORIGIN("cross-origin");

    private final String value;

    CorpOption(String value) {
      this.value = value;
    }

    public String getValue() {
      return this.value;
    }
  }
}
