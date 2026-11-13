package org.openmetadata.service.alerting.content.template.sandbox;

import com.github.jknack.handlebars.io.AbstractTemplateLoader;
import com.github.jknack.handlebars.io.TemplateSource;

/** Templates are self-contained: no other template is ever loaded into one. */
final class RefusingTemplateLoader extends AbstractTemplateLoader {

  @Override
  public TemplateSource sourceAt(String location) {
    throw new TemplateRefusedException(
        String.format("Template '%s' cannot be included: partials are not supported", location));
  }
}
