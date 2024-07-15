package org.openmetadata.service.util;

import freemarker.template.Template;
import java.io.IOException;

public interface TemplateProvider {

  void initializeTemplateConfiguration();

  Template getTemplate(String templateName) throws IOException;
}
