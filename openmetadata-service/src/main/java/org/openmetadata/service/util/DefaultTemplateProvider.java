package org.openmetadata.service.util;

import static freemarker.template.Configuration.VERSION_2_3_28;

import com.fasterxml.jackson.core.type.TypeReference;
import freemarker.template.Configuration;
import freemarker.template.Template;
import java.io.IOException;
import java.io.StringReader;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.email.EmailTemplate;
import org.openmetadata.schema.email.EmailTemplatePlaceholder;
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
  public static final String ENTITY_TYPE_EMAIL_TEMPLATE = "EmailTemplate";
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
    List<String> documents = documentRepository.fetchAllEmailTemplatesFromDocStore();
    return documents.stream().map(json -> JsonUtils.readValue(json, Document.class)).toList();
  }

  @Override
  public Template getTemplate(String templateName) throws IOException {
    return templateConfiguration.getTemplate(templateName);
  }

  @Override
  public Template fetchTemplateFromDocStore(String templateName) throws IOException {
    Document document = documentRepository.findByName(templateName, Include.NON_DELETED);
    EmailTemplate emailTemplate = JsonUtils.convertValue(document.getData(), EmailTemplate.class);
    String template = emailTemplate.getTemplate();
    if (template == null || template.isEmpty()) {
      throw new IOException("Template content not found for template: " + templateName);
    }

    return new Template(
        templateName, new StringReader(template), new Configuration(Configuration.VERSION_2_3_31));
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
                        JsonUtils.convertValue(document.getData(), EmailTemplate.class)
                            .getTemplate())));
  }

  public Map<String, List<EmailTemplatePlaceholder>> getPlaceholders() {
    List<Document> documents = loadEmailTemplatesFromDocStore();

    return documents.stream()
        .collect(
            Collectors.toMap(
                Document::getName,
                document -> {
                  EmailTemplate emailTemplate =
                      JsonUtils.convertValue(document.getData(), EmailTemplate.class);
                  return emailTemplate.getPlaceHolders();
                }));
  }

  public List<EmailTemplatePlaceholder> getPlaceholdersByDocument(String documentName) {
    return Optional.ofNullable(
            documentRepository.fetchEmailTemplateFromDocStoreByName(documentName))
        .map(json -> JsonUtils.readValue(json, Document.class))
        .map(
            document ->
                JsonUtils.convertValue(document.getData(), EmailTemplate.class).getPlaceHolders())
        .map(
            placeholder ->
                JsonUtils.convertValue(
                    placeholder, new TypeReference<List<EmailTemplatePlaceholder>>() {}))
        .orElseThrow(
            () -> new IllegalArgumentException("Invalid document or placeholders not found"));
  }

  @Override
  public Map<String, Object> validateEmailTemplate(Document document) {
    Map<String, Object> validationResponse = new HashMap<>();

    try {
      List<String> expectedPlaceholders =
          getPlaceholdersForEmailTemplates()
              .getOrDefault(document.getName(), Collections.emptyList());

      String content =
          JsonUtils.convertValue(document.getData(), EmailTemplate.class).getTemplate();
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
