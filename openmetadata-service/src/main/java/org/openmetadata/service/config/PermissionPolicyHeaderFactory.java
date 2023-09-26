package org.openmetadata.service.config;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.dropwizard.web.conf.HeaderFactory;
import java.util.Collections;
import java.util.Map;

public class PermissionPolicyHeaderFactory extends HeaderFactory {
  public static final String PERMISSION_POLICY_HEADER = "Permissions-Policy";

  @JsonProperty("option")
  private String option;

  public PermissionPolicyHeaderFactory() {}

  public String getOption() {
    return this.option;
  }

  public void setOption(String option) {
    this.option = option;
  }

  @Override
  protected Map<String, String> buildHeaders() {
    return Collections.singletonMap(PERMISSION_POLICY_HEADER, this.option);
  }
}
