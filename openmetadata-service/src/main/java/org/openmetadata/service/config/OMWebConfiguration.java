package org.openmetadata.service.config;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.Setter;
import org.openmetadata.service.config.web.CrossOriginEmbedderPolicyHeaderFactory;
import org.openmetadata.service.config.web.CrossOriginOpenerPolicyHeaderFactory;
import org.openmetadata.service.config.web.CrossOriginResourcePolicyHeaderFactory;
import org.openmetadata.service.config.web.WebConfiguration;

@Setter
@Getter
public class OMWebConfiguration extends WebConfiguration {

  @JsonProperty("referrer-policy")
  private ReferrerPolicyHeaderFactory referrerPolicyHeaderFactory;

  @JsonProperty("permission-policy")
  private PermissionPolicyHeaderFactory permissionPolicyHeaderFactory;

  @JsonProperty("cross-origin-embedder-policy")
  private CrossOriginEmbedderPolicyHeaderFactory crossOriginEmbedderPolicyHeaderFactory;

  @JsonProperty("cross-origin-resource-policy")
  private CrossOriginResourcePolicyHeaderFactory crossOriginResourcePolicyHeaderFactory;

  @JsonProperty("cross-origin-opener-policy")
  private CrossOriginOpenerPolicyHeaderFactory crossOriginOpenerPolicyHeaderFactory;

  @JsonProperty("cache-control")
  private String cacheControl;

  @JsonProperty("pragma")
  private String pragma;
}
