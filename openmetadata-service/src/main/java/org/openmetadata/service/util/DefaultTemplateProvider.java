package org.openmetadata.service.util;

import static freemarker.template.Configuration.VERSION_2_3_28;

import freemarker.template.Configuration;
import freemarker.template.Template;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.email.SmtpSettings;
import org.openmetadata.schema.entities.docStore.Document;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.DocumentRepository;
import org.openmetadata.service.resources.settings.SettingsCache;

@Slf4j
public class DefaultTemplateProvider implements TemplateProvider {
  public static String EMAIL_TEMPLATE_BASEPATH = "/emailTemplates";
  private static final Configuration templateConfiguration = new Configuration(VERSION_2_3_28);
  private final DocumentRepository documentRepository;
  public static final String EMAIL_TEMPLATE_VALID = "valid";
  public static final String ENTITY_TYPE_EMAIL_TEMPLATE = "_emailTemplate";
  public static final String EMAIL_TEMPLATE_MISSING_PLACEHOLDERS = "missingPlaceholders";

  public DefaultTemplateProvider() {
    this.documentRepository = (DocumentRepository) Entity.getEntityRepository(Entity.DOCUMENT);
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

  public List<Document> loadEmailTemplatesFromDocStore() {
    List<String> documents = documentRepository.fetchEmailTemplatesFromDocStore();

    return documents.stream()
        .map(
            json -> {
              return JsonUtils.readValue(json, Document.class);
            })
        .toList();
  }

  @Override
  public Template getTemplate(String templateName) throws IOException {
    return templateConfiguration.getTemplate(templateName);
  }

  @Override
  public String fetchTemplateFromDocStore(String fqn) {
    Document document = documentRepository.findByName(fqn, Include.NON_DELETED);
    return (String) document.getData().getAdditionalProperties().get("content");
  }

  @Override
  public Map<String, List<String>> getPlaceholdersForEmailTemplates() {
    List<Document> listOfDocuments = loadEmailTemplatesFromDocStore();

    return listOfDocuments.stream()
        .collect(
            Collectors.toMap(
                Document::getName,
                document ->
                    extractPlaceholders(
                        (String) document.getData().getAdditionalProperties().get("content"))));
  }

  @Override
  public Map<String, Object> validateEmailTemplate(Document document) {
    Map<String, Object> validationResponse = new HashMap<>();

    try {
      List<String> expectedPlaceholders =
          getPlaceholdersForEmailTemplates()
              .getOrDefault(document.getName(), Collections.emptyList());

      String content = (String) document.getData().getAdditionalProperties().get("content");
      List<String> presentPlaceholders = extractPlaceholders(content);

      List<String> missingPlaceholders =
          expectedPlaceholders.stream()
              .filter(expected -> !presentPlaceholders.contains(expected))
              .collect(Collectors.toList());

      boolean allPresent = missingPlaceholders.isEmpty();

      validationResponse.put(EMAIL_TEMPLATE_VALID, allPresent);
      if (!allPresent) {
        validationResponse.put(EMAIL_TEMPLATE_MISSING_PLACEHOLDERS, missingPlaceholders);
      }

    } catch (Exception e) {
      validationResponse.put("valid", false);
      LOG.error("Error validating email template: {}", e.getMessage());
    }

    return validationResponse;
  }

  private static List<String> extractPlaceholders(String content) {
    List<String> placeholders = new ArrayList<>();
    Pattern pattern = Pattern.compile("\\$\\{([^}]*)}");
    Matcher matcher = pattern.matcher(content);
    while (matcher.find()) {
      placeholders.add(matcher.group(1));
    }
    return placeholders;
  }

  public static String getTemplatePath() {
    SmtpSettings emailConfig =
        SettingsCache.getSetting(SettingsType.EMAIL_CONFIGURATION, SmtpSettings.class);

    return emailConfig.getTemplatePath();
  }
}
