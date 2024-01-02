package org.openmetadata.service.config;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.dropwizard.web.conf.WebConfiguration;

public class OMWebConfiguration extends WebConfiguration {

  @JsonProperty("referrer-policy")
  private ReferrerPolicyHeaderFactory referrerPolicyHeaderFactory;

  @JsonProperty("permission-policy")
  private PermissionPolicyHeaderFactory permissionPolicyHeaderFactory;

  public OMWebConfiguration() {}

  public ReferrerPolicyHeaderFactory getReferrerPolicyHeaderFactory() {
    return this.referrerPolicyHeaderFactory;
  }

  public void setReferrerPolicyHeaderFactory(
      ReferrerPolicyHeaderFactory referrerPolicyHeaderFactory) {
    this.referrerPolicyHeaderFactory = referrerPolicyHeaderFactory;
  }

  public PermissionPolicyHeaderFactory getPermissionPolicyHeaderFactory() {
    return this.permissionPolicyHeaderFactory;
  }

  public void setPermissionPolicyHeaderFactory(
      PermissionPolicyHeaderFactory permissionPolicyHeaderFactory) {
    this.permissionPolicyHeaderFactory = permissionPolicyHeaderFactory;
  }
}
