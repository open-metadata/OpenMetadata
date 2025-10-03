package org.openmetadata.service.template.handlebars;

import com.github.jknack.handlebars.Handlebars;

/**
 * Interface for all Handlebars helpers. Each helper should implement this interface to provide a
 * consistent way of registering helpers with Handlebars.
 */
public interface HandlebarsHelper {
  /**
   * Get the name of this helper as it will be used in templates.
   *
   * @return The helper name
   */
  String getName();

  /**
   * Register this helper with the given Handlebars instance.
   *
   * @param handlebars The Handlebars instance to register with
   */
  void register(Handlebars handlebars);
}
