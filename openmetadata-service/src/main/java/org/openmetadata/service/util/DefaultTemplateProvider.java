package org.openmetadata.service.util;

import freemarker.template.Configuration;
import freemarker.template.Template;
import java.io.IOException;
import java.io.StringReader;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.email.EmailTemplate;
import org.openmetadata.schema.email.EmailTemplatePlaceholder;
import org.openmetadata.schema.email.TemplateValidationResponse;
import org.openmetadata.schema.entities.docStore.Document;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.DocumentRepository;

@Slf4j
public class DefaultTemplateProvider implements TemplateProvider {
  private final DocumentRepository documentRepository;
  public static final String ENTITY_TYPE_EMAIL_TEMPLATE = "EmailTemplate";

  public DefaultTemplateProvider() {
    this.documentRepository = (DocumentRepository) Entity.getEntityRepository(Entity.DOCUMENT);
  }

  @Override
  public Template getTemplate(String templateName) throws IOException {
    EmailTemplate emailTemplate = documentRepository.fetchEmailTemplateByName(templateName);
    String template = emailTemplate.getTemplate();
    if (template == null || template.isEmpty()) {
      throw new IOException("Template content not found for template: " + templateName);
    }

    return new Template(
        templateName, new StringReader(template), new Configuration(Configuration.VERSION_2_3_31));
  }

  public Map<String, Set<EmailTemplatePlaceholder>> getDocumentPlaceHolders() {
    List<Document> documents = documentRepository.fetchAllEmailTemplates();

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

  public Map<String, Set<String>> getPlaceholdersFromTemplate() {
    List<Document> listOfDocuments = documentRepository.fetchAllEmailTemplates();

    return listOfDocuments.stream()
        .collect(
            Collectors.toMap(
                Document::getName,
                document ->
                    extractPlaceholders(
                        JsonUtils.convertValue(document.getData(), EmailTemplate.class)
                            .getTemplate())));
  }

  @Override
  public TemplateValidationResponse validateEmailTemplate(String docName, String actualContent) {
    Set<String> expectedPlaceholders =
        documentRepository.fetchEmailTemplateByName(docName).getPlaceHolders().stream()
            .map(EmailTemplatePlaceholder::getName)
            .collect(Collectors.toSet());
    Set<String> actualPlaceholders = extractPlaceholders(actualContent);

    // Check if all required Placeholder are present
    Set<String> missingPlaceholders =
        expectedPlaceholders.stream()
            .filter(expected -> !actualPlaceholders.contains(expected))
            .collect(Collectors.toSet());

    // Check if there are additional Placeholder in the template (we cannot supply those values at
    // runtime!)
    Set<String> additionalPlaceholders =
        actualPlaceholders.stream()
            .filter(expected -> !expectedPlaceholders.contains(expected))
            .collect(Collectors.toSet());

    boolean isValid = additionalPlaceholders.isEmpty();

    return new TemplateValidationResponse()
        .withIsValid(isValid)
        .withMissingPlaceholder(missingPlaceholders)
        .withAdditionalPlaceholder(additionalPlaceholders)
        .withMessage(
            isValid
                ? "Email Template passed validations."
                : "Invalid Email Template. Please check the placeholders for additional Details.");
  }

  private static Set<String> extractPlaceholders(String content) {
    Set<String> placeholders = new HashSet<>();
    Pattern pattern = Pattern.compile("\\$\\{([^}]*)}");
    Matcher matcher = pattern.matcher(content);
    while (matcher.find()) {
      placeholders.add(matcher.group(1));
    }
    return placeholders;
  }
}
