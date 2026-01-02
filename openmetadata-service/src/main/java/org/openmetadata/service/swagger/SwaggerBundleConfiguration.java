package org.openmetadata.service.swagger;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.Setter;

/**
 * Configuration for the Swagger bundle compatible with Dropwizard 5.0. This replaces
 * io.federecio.dropwizard.swagger.SwaggerBundleConfiguration.
 */
@Getter
@Setter
public class SwaggerBundleConfiguration {

  @JsonProperty private String resourcePackage;

  @JsonProperty private String title;

  @JsonProperty private String version;

  @JsonProperty private String description;

  @JsonProperty private String termsOfServiceUrl;

  @JsonProperty private String contact;

  @JsonProperty private String contactEmail;

  @JsonProperty private String contactUrl;

  @JsonProperty private String license;

  @JsonProperty private String licenseUrl;

  @JsonProperty private String[] schemes = new String[] {"http", "https"};

  @JsonProperty private String host;

  @JsonProperty private String uriPrefix = "/";

  @JsonProperty private boolean enabled = true;

  @JsonProperty private boolean prettyPrint = true;

  @JsonProperty private String swaggerViewConfiguration;

  @Override
  public String toString() {
    return "SwaggerBundleConfiguration{"
        + "resourcePackage='"
        + resourcePackage
        + '\''
        + ", title='"
        + title
        + '\''
        + ", version='"
        + version
        + '\''
        + ", description='"
        + description
        + '\''
        + ", enabled="
        + enabled
        + '}';
  }
}
