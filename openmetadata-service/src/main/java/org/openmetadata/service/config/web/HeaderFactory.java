package org.openmetadata.service.config.web;

import java.util.Map;

/**
 * Base class for header factories that build HTTP security headers.
 * This is a local copy replacing io.dropwizard.web.conf.HeaderFactory
 * since dropwizard-web is not yet compatible with Dropwizard 5.0.
 */
public abstract class HeaderFactory {

  public Map<String, String> build() {
    return buildHeaders();
  }

  protected abstract Map<String, String> buildHeaders();
}
