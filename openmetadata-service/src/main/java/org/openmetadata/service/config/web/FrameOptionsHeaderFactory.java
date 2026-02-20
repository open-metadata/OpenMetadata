package org.openmetadata.service.config.web;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Collections;
import java.util.Map;
import lombok.Getter;
import lombok.Setter;

/**
 * X-Frame-Options header factory.
 * Replaces io.dropwizard.web.conf.FrameOptionsHeaderFactory.
 */
@Getter
@Setter
public class FrameOptionsHeaderFactory extends HeaderFactory {

  public static final String FRAME_OPTIONS_HEADER = "X-Frame-Options";

  @JsonProperty("option")
  private FrameOption option = FrameOption.SAMEORIGIN;

  @JsonProperty("origin")
  private String origin;

  @Override
  protected Map<String, String> buildHeaders() {
    String value;
    if (option == FrameOption.ALLOW_FROM && origin != null) {
      value = option.getValue() + " " + origin;
    } else {
      value = option.getValue();
    }
    return Collections.singletonMap(FRAME_OPTIONS_HEADER, value);
  }

  public enum FrameOption {
    DENY("DENY"),
    SAMEORIGIN("SAMEORIGIN"),
    ALLOW_FROM("ALLOW-FROM");

    private final String value;

    FrameOption(String value) {
      this.value = value;
    }

    public String getValue() {
      return this.value;
    }
  }
}
