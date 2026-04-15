package org.openmetadata.service.config.web;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Collections;
import java.util.Map;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CrossOriginEmbedderPolicyHeaderFactory extends HeaderFactory {

  public static final String CROSS_ORIGIN_EMBEDDER_POLICY_HEADER = "Cross-Origin-Embedder-Policy";

  @JsonProperty("option")
  private CoepOption option = CoepOption.REQUIRE_CORP;

  @Override
  protected Map<String, String> buildHeaders() {
    return Collections.singletonMap(CROSS_ORIGIN_EMBEDDER_POLICY_HEADER, option.getValue());
  }

  public enum CoepOption {
    REQUIRE_CORP("require-corp"),
    UNSAFE_NONE("unsafe-none"),
    CREDENTIALLESS("credentialless");

    private final String value;

    CoepOption(String value) {
      this.value = value;
    }

    public String getValue() {
      return this.value;
    }
  }
}
