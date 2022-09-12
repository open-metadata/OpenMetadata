package org.openmetadata.catalog.email;

import static freemarker.template.Configuration.VERSION_2_3_28;
import static org.simplejavamail.api.mailer.config.TransportStrategy.SMTP;
import static org.simplejavamail.api.mailer.config.TransportStrategy.SMTPS;
import static org.simplejavamail.api.mailer.config.TransportStrategy.SMTP_TLS;

import freemarker.template.Configuration;
import freemarker.template.Template;
import freemarker.template.TemplateException;
import java.io.IOException;
import java.io.StringWriter;
import java.util.HashMap;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.simplejavamail.api.email.Email;
import org.simplejavamail.api.email.EmailPopulatingBuilder;
import org.simplejavamail.api.mailer.Mailer;
import org.simplejavamail.api.mailer.config.TransportStrategy;
import org.simplejavamail.email.EmailBuilder;
import org.simplejavamail.mailer.MailerBuilder;

@Slf4j
public class EmailUtil {
  private static EmailUtil INSTANCE = null;
  private SmtpSettings defaultSmtpSettings = null;
  private Mailer mailer = null;
  private Configuration templateConfiguration = null;

  private EmailUtil(SmtpSettings smtpServerSettings) {
    try {
      this.defaultSmtpSettings = smtpServerSettings;
      this.mailer = this.createMailer(smtpServerSettings);
      this.templateConfiguration = new Configuration(VERSION_2_3_28);
    } catch (Exception ex) {
      LOG.error("Error in instantialting [MAILER] : Reason {} ", ex.getMessage());
    }
  }

  private Mailer createMailer(SmtpSettings smtpServerSettings) {
    TransportStrategy strategy = SMTP;
    switch (smtpServerSettings.getTransportationStrategy()) {
      case SMTP:
        strategy = SMTP;
        break;
      case SMPTS:
        strategy = SMTPS;
        break;
      case SMTP_TLS:
        strategy = SMTP_TLS;
        break;
    }
    return MailerBuilder.withSMTPServer(
            smtpServerSettings.getServerEndpoint(),
            smtpServerSettings.getServerPort(),
            smtpServerSettings.getUsername(),
            smtpServerSettings.getPassword())
        .withTransportStrategy(strategy)
        .buildMailer();
  }

  public static EmailUtil getInstance() {
    return INSTANCE;
  }

  public Email buildEmailWithSender(EmailRequest request) {
    EmailPopulatingBuilder emailBuilder = EmailBuilder.startingBlank();
    if (request.getSenderMail() != null
        && !request.getSenderMail().equals("")
        && request.getRecipientMails() != null
        && request.getRecipientMails().size() != 0
        && request.getSubject() != null
        && !request.getSubject().equals("")) {
      // Sender Details
      if (request.getSenderName() != null && !request.getSenderName().equals("")) {
        emailBuilder.from(request.getSenderName(), request.getSenderMail());
      } else {
        emailBuilder.from(request.getSenderMail());
      }

      // Recipient
      request
          .getRecipientMails()
          .forEach(
              (pair) -> {
                if (pair.getName() != null && !pair.getName().equals("")) {
                  emailBuilder.to(pair.getName(), pair.getEmail());
                } else {
                  emailBuilder.to(pair.getEmail());
                }
              });

      // CC
      if (request.getCcMails() != null) {
        request
            .getCcMails()
            .forEach(
                (pair) -> {
                  if (pair.getName() != null && !pair.getName().equals("")) {
                    emailBuilder.cc(pair.getName(), pair.getEmail());
                  } else {
                    emailBuilder.cc(pair.getEmail());
                  }
                });
      }

      // BCC
      if (request.getBccMails() != null) {
        request
            .getBccMails()
            .forEach(
                (pair) -> {
                  if (pair.getName() != null && !pair.getName().equals("")) {
                    emailBuilder.bcc(pair.getName(), pair.getEmail());
                  } else {
                    emailBuilder.bcc(pair.getEmail());
                  }
                });
      }

      // Subject
      if (request.getSubject() != null) {
        emailBuilder.withSubject(request.getSubject());
      }

      if (request.getContent() != null) {
        if (request.getContentType() == EmailRequest.ContentType.HTML) {
          emailBuilder.withHTMLText(request.getContent());
        } else {
          emailBuilder.withPlainText(request.getContent());
        }
      }

    } else {
      throw new RuntimeException("Email Request is missing Required Details");
    }
    return emailBuilder.buildEmail();
  }

  public Email buildEmailWithDefaultSender(EmailRequest request) {
    EmailPopulatingBuilder emailBuilder = EmailBuilder.startingBlank();
    if (request.getRecipientMails() != null
        && request.getRecipientMails().size() != 0
        && request.getSubject() != null
        && !request.getSubject().equals("")) {
      // Sender Details
      emailBuilder.from(defaultSmtpSettings.getUsername());

      // Recipient
      request
          .getRecipientMails()
          .forEach(
              (pair) -> {
                if (pair.getName() != null && !pair.getName().equals("")) {
                  emailBuilder.to(pair.getName(), pair.getEmail());
                } else {
                  emailBuilder.to(pair.getEmail());
                }
              });

      // CC
      if (request.getCcMails() != null) {
        request
            .getCcMails()
            .forEach(
                (pair) -> {
                  if (pair.getName() != null && !pair.getName().equals("")) {
                    emailBuilder.cc(pair.getName(), pair.getEmail());
                  } else {
                    emailBuilder.cc(pair.getEmail());
                  }
                });
      }

      // BCC
      if (request.getBccMails() != null) {
        request
            .getBccMails()
            .forEach(
                (pair) -> {
                  if (pair.getName() != null && !pair.getName().equals("")) {
                    emailBuilder.bcc(pair.getName(), pair.getEmail());
                  } else {
                    emailBuilder.bcc(pair.getEmail());
                  }
                });
      }

      // Subject
      if (request.getSubject() != null) {
        emailBuilder.withSubject(request.getSubject());
      }

      if (request.getContent() != null) {
        if (request.getContentType() == EmailRequest.ContentType.HTML) {
          emailBuilder.withHTMLText(request.getContent());
        } else {
          emailBuilder.withPlainText(request.getContent());
        }
      }
    } else {
      throw new RuntimeException("Email Request is missing Required Details");
    }
    return emailBuilder.buildEmail();
  }

  public void sendEmailVerification(String emailVerificationUrl, String to) throws TemplateException, IOException {
    EmailPopulatingBuilder emailBuilder = EmailBuilder.startingBlank();
    emailBuilder.withSubject("Email Verification[OpenMetadata]");
    emailBuilder.to(to);
    emailBuilder.from(defaultSmtpSettings.getUsername());

    Map<String, String> templatePopulator = new HashMap<>();
    templatePopulator.put("userName", to);
    templatePopulator.put("userEmailTokenVerificationLink", emailVerificationUrl);

    templateConfiguration.setClassForTemplateLoading(getClass(), "/emailTemplates");
    Template template = templateConfiguration.getTemplate("email-verification.ftl");

    // write the freemarker output to a StringWriter
    StringWriter stringWriter = new StringWriter();
    template.process(templatePopulator, stringWriter);
    String mailContent = stringWriter.toString();
    emailBuilder.withHTMLText(mailContent);

    sendMail(emailBuilder.buildEmail());
  }

  public void sendResetPasswordLink(String resetPasswordLink, String to) throws TemplateException, IOException {
    EmailPopulatingBuilder emailBuilder = EmailBuilder.startingBlank();
    emailBuilder.withSubject("Password Reset Link[OpenMetadata]");
    emailBuilder.to(to);
    emailBuilder.from(defaultSmtpSettings.getUsername());

    Map<String, String> templatePopulator = new HashMap<>();
    templatePopulator.put("userName", to);
    templatePopulator.put("userResetPasswordLink", resetPasswordLink);
    templatePopulator.put("expirationTime", "60");

    templateConfiguration.setClassForTemplateLoading(getClass(), "/emailTemplates");
    Template template = templateConfiguration.getTemplate("reset-link.ftl");

    // write the freemarker output to a StringWriter
    StringWriter stringWriter = new StringWriter();
    template.process(templatePopulator, stringWriter);
    String mailContent = stringWriter.toString();
    emailBuilder.withHTMLText(mailContent);
    sendMail(emailBuilder.buildEmail());
  }

  public void sendAccountChangeEmail(String action, String actionStatus, String to)
      throws IOException, TemplateException {
    EmailPopulatingBuilder emailBuilder = EmailBuilder.startingBlank();
    emailBuilder.withSubject("Account Status Change[OpenMetadata]");
    emailBuilder.to(to);
    emailBuilder.from(defaultSmtpSettings.getUsername());

    Map<String, String> templatePopulator = new HashMap<>();
    templatePopulator.put("userName", to);
    templatePopulator.put("action", action);
    templatePopulator.put("actionStatus", actionStatus);

    templateConfiguration.setClassForTemplateLoading(getClass(), "/emailTemplates");
    Template template = templateConfiguration.getTemplate("account-activity-change.ftl");

    // write the freemarker output to a StringWriter
    StringWriter stringWriter = new StringWriter();
    template.process(templatePopulator, stringWriter);
    String mailContent = stringWriter.toString();
    emailBuilder.withHTMLText(mailContent);
    sendMail(emailBuilder.buildEmail());
  }

  public void sendMail(Email email) {
    if (mailer != null) {
      mailer.sendMail(email);
    }
  }

  public void testConnection() {
    mailer.testConnection();
  }

  public void sendMailWithSmtp(Email email, SmtpSettings settings) {
    createMailer(settings).sendMail(email);
  }

  public static class EmailUtilBuilder {
    public static EmailUtil build(SmtpSettings smtpServerSettings) {
      if (INSTANCE == null) {
        INSTANCE = new EmailUtil(smtpServerSettings);
      }
      return INSTANCE;
    }
  }
}
