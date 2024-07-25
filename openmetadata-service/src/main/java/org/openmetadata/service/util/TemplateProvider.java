package org.openmetadata.service.util;

import freemarker.template.Template;
import java.io.IOException;
import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.email.EmailTemplatePlaceholder;
import org.openmetadata.schema.email.TemplateValidationResponse;

public interface TemplateProvider {

  Template getTemplate(String templateName) throws IOException;

  /**
   * Validates an email template document by checking for the presence of required placeholders.
   * @return A map containing validation results:
   *         - "valid" (boolean): Indicates whether the template is valid.
   *         - "missingParameters" (List<String>): If validation fails, lists the placeholders that are missing.
   */
  TemplateValidationResponse validateEmailTemplate(String docName, String actualContent);

  /**
   * Maps each template's name to a list of
   * {@link EmailTemplatePlaceholder}s extracted from the template data.
   */
  Map<String, Set<EmailTemplatePlaceholder>> getDocumentPlaceHolders();
}
