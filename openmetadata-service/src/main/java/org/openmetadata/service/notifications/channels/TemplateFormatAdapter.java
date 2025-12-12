package org.openmetadata.service.notifications.channels;

public interface TemplateFormatAdapter {
  /**
   * Convert template content to the format expected by the renderer.
   *
   * @param templateContent The compiled template content
   * @return The converted content in the target format
   */
  String adapt(String templateContent);
}
