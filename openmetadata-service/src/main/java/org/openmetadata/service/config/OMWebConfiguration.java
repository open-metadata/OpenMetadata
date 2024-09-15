package org.openmetadata.service.config;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.dropwizard.web.conf.WebConfiguration;

public class OMWebConfiguration extends WebConfiguration {

  @JsonProperty("referrer-policy")
  private ReferrerPolicyHeaderFactory referrerPolicyHeaderFactory;

  @JsonProperty("permission-policy")
  private PermissionPolicyHeaderFactory permissionPolicyHeaderFactory;

  @JsonProperty("cache-control")
  private String cacheControl;

  @JsonProperty("pragma")
  private String pragma;

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

  public String getCacheControl() {
    return this.cacheControl;
  }

  public String getPragma() {
    return this.pragma;
  }

  public void setCacheControl(String cacheControl) {
    this.cacheControl = cacheControl;
  }

  public void setPragma(String pragma) {
    this.pragma = pragma;
  }

  public void setPermissionPolicyHeaderFactory(
      PermissionPolicyHeaderFactory permissionPolicyHeaderFactory) {
    this.permissionPolicyHeaderFactory = permissionPolicyHeaderFactory;
  }
}
