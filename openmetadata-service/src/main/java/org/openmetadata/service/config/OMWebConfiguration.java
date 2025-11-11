package org.openmetadata.service.config;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.dropwizard.web.conf.WebConfiguration;
import lombok.Getter;
import lombok.Setter;

@Setter
@Getter
public class OMWebConfiguration extends WebConfiguration {

  @JsonProperty("referrer-policy")
  private ReferrerPolicyHeaderFactory referrerPolicyHeaderFactory;

  @JsonProperty("permission-policy")
  private PermissionPolicyHeaderFactory permissionPolicyHeaderFactory;

  @JsonProperty("cache-control")
  private String cacheControl;

  @JsonProperty("pragma")
  private String pragma;
}
