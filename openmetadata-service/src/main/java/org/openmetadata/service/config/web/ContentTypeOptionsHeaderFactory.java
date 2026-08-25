package org.openmetadata.service.config.web;

import java.util.Collections;
import java.util.Map;
import lombok.Getter;
import lombok.Setter;

/**
 * X-Content-Type-Options header factory.
 * Replaces io.dropwizard.web.conf.ContentTypeOptionsHeaderFactory.
 */
@Getter
@Setter
public class ContentTypeOptionsHeaderFactory extends HeaderFactory {

  public static final String CONTENT_TYPE_OPTIONS_HEADER = "X-Content-Type-Options";

  public ContentTypeOptionsHeaderFactory() {
    setEnabled(true);
  }

  @Override
  protected Map<String, String> buildHeaders() {
    return Collections.singletonMap(CONTENT_TYPE_OPTIONS_HEADER, "nosniff");
  }
}
