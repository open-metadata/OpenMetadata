package org.openmetadata.service.config.web;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.HashMap;
import java.util.Map;
import lombok.Getter;
import lombok.Setter;

/**
 * Web configuration for security headers.
 * This is a local implementation replacing io.dropwizard.web.conf.WebConfiguration
 * since dropwizard-web is not yet compatible with Dropwizard 5.0.
 */
@Getter
@Setter
public class WebConfiguration {

  @JsonProperty("uriPath")
  private String uriPath = "/";

  @JsonProperty("hsts")
  private HstsHeaderFactory hstsHeaderFactory;

  @JsonProperty("frame-options")
  private FrameOptionsHeaderFactory frameOptionsHeaderFactory = new FrameOptionsHeaderFactory();

  @JsonProperty("content-type-options")
  private ContentTypeOptionsHeaderFactory contentTypeOptionsHeaderFactory =
      new ContentTypeOptionsHeaderFactory();

  @JsonProperty("xss-protection")
  private XssProtectionHeaderFactory xssProtectionHeaderFactory = new XssProtectionHeaderFactory();

  @JsonProperty("csp")
  private CspHeaderFactory cspHeaderFactory;

  @JsonProperty("cors")
  private CorsFilterFactory corsFilterFactory;

  @JsonProperty("headers")
  private Map<String, String> headers = new HashMap<>();
}
