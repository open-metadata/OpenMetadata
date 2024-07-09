package org.openmetadata.service.util;

import freemarker.template.Template;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.entities.docStore.Document;

public interface TemplateProvider {

  /**
   * Initializes the configuration for the template provider.
   */
  void initializeTemplateConfiguration();

  /**
   * Retrieves a FreeMarker template based on its name.
   *
   * @return The FreeMarker template object.
   */
  Template getTemplate(String templateName) throws IOException;

  /**
   * Fetches a template stored in a document store.
   * @param fqn The fully qualified name (FQN) or identifier of the template.
   */
  String fetchTemplateFromDocStore(String fqn);

  /**
   * Retrieves placeholders defined in email templates.
   * @return A map where each key is a template name and the value is a list of placeholders defined in that template.
   */
  Map<String, List<String>> getPlaceholdersForEmailTemplates() throws IOException;

  /**
   * Validates an email template document by checking for the presence of required placeholders.
   * @return A map containing validation results:
   *         - "valid" (boolean): Indicates whether the template is valid.
   *         - "missingParameters" (List<String>): If validation fails, lists the placeholders that are missing.
   */
  Map<String, Object> validateEmailTemplate(Document document);
}
