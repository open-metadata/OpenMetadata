package org.openmetadata.service.util;

import static freemarker.template.Configuration.VERSION_2_3_28;

import freemarker.template.Configuration;
import freemarker.template.Template;
import java.io.IOException;
import org.openmetadata.schema.email.SmtpSettings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.service.resources.settings.SettingsCache;

public class DefaultTemplateProvider implements TemplateProvider {
  public static String EMAIL_TEMPLATE_BASEPATH = "/emailTemplates";
  private static final Configuration templateConfiguration = new Configuration(VERSION_2_3_28);

  public DefaultTemplateProvider() {
    initializeTemplateConfiguration();
  }

  @Override
  public void initializeTemplateConfiguration() {
    String templatePath = getTemplatePath();

    if (templatePath != null && !templatePath.isBlank()) {
      EMAIL_TEMPLATE_BASEPATH += "/" + templatePath;
    }

    templateConfiguration.setClassForTemplateLoading(
        DefaultTemplateProvider.class, EMAIL_TEMPLATE_BASEPATH);
  }

  @Override
  public Template getTemplate(String templateName) throws IOException {
    return templateConfiguration.getTemplate(templateName);
  }

  public static String getTemplatePath() {
    SmtpSettings emailConfig =
        SettingsCache.getSetting(SettingsType.EMAIL_CONFIGURATION, SmtpSettings.class);

    return emailConfig.getTemplatePath();
  }
}
