package org.openmetadata.service.notifications.channels.email;

import java.util.HashMap;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.entity.events.NotificationTemplate;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.notifications.channels.ChannelRenderer;
import org.openmetadata.service.notifications.channels.HtmlSanitizer;
import org.openmetadata.service.notifications.channels.NotificationMessage;
import org.openmetadata.service.notifications.template.NotificationTemplateProcessor;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsNotificationTemplateProcessor;
import org.openmetadata.service.util.email.EmailUtil;
import org.openmetadata.service.util.resourcepath.ResourcePathResolver;
import org.openmetadata.service.util.resourcepath.providers.EmailEnvelopeResourcePathProvider;

@Slf4j
public class EmailHtmlRenderer implements ChannelRenderer {

  private final NotificationTemplate emailEnvelope;
  private final NotificationTemplateProcessor templateProcessor;

  public EmailHtmlRenderer() {
    this.emailEnvelope = loadEmailEnvelopeFromResources();
    this.templateProcessor = new HandlebarsNotificationTemplateProcessor();
  }

  @Override
  public NotificationMessage render(String templateContent, String templateSubject) {
    String htmlContent = templateContent == null ? "" : templateContent;
    String safeHtml = HtmlSanitizer.sanitize(htmlContent).trim();

    String subject = templateSubject == null ? "" : templateSubject.trim();

    // Apply email envelope decoration
    String decoratedHtml = applyEmailEnvelope(safeHtml);

    return EmailMessage.builder().subject(subject).htmlContent(decoratedHtml).build();
  }

  private String applyEmailEnvelope(String htmlContent) {
    // If no envelope available, return content as-is
    if (emailEnvelope == null) {
      LOG.warn("Email envelope is null, returning content without decoration");
      return htmlContent;
    }

    LOG.debug("Email envelope is available, applying decoration");

    Map<String, Object> envelopeContext = new HashMap<>();

    // Hardcode logo URL for OpenMetadata (can be overridden by commercial version)
    envelopeContext.put("content", htmlContent);

    // Get organization name from SMTP settings
    String organizationName = EmailUtil.getSmtpSettings().getEmailingEntity();
    envelopeContext.put("organizationName", organizationName);

    LOG.debug("Envelope context prepared with organizationName: {}", organizationName);

    // Process the envelope template with the content
    String decoratedContent =
        templateProcessor.process(emailEnvelope.getTemplateBody(), envelopeContext);
    LOG.debug(
        "Envelope decoration completed, decorated content size: {}",
        decoratedContent != null ? decoratedContent.length() : 0);

    return decoratedContent;
  }

  private NotificationTemplate loadEmailEnvelopeFromResources() {
    // Use SPI to determine the path for email envelope
    String envelopePath =
        ResourcePathResolver.getResourcePath(EmailEnvelopeResourcePathProvider.class);
    LOG.debug("Attempting to load email envelope from path: {}", envelopePath);

    try {
      // Load the specific envelope file (similar to how EntityRepository loads seed data)
      String json =
          CommonUtil.getResourceAsStream(EmailHtmlRenderer.class.getClassLoader(), envelopePath);

      LOG.debug(
          "Successfully loaded email envelope JSON, size: {} characters",
          json != null ? json.length() : 0);

      NotificationTemplate template = JsonUtils.readValue(json, NotificationTemplate.class);
      LOG.debug(
          "Successfully parsed email envelope template: {}",
          template != null ? template.getName() : "null");

      return template;
    } catch (Exception e) {
      LOG.warn(
          "Could not load email envelope from {}, emails will be sent without wrapper",
          envelopePath,
          e);
      return null;
    }
  }
}
