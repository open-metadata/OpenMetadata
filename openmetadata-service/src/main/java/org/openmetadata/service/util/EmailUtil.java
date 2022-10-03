package org.openmetadata.service.util;

import static freemarker.template.Configuration.VERSION_2_3_28;
import static org.simplejavamail.api.mailer.config.TransportStrategy.SMTP;
import static org.simplejavamail.api.mailer.config.TransportStrategy.SMTPS;
import static org.simplejavamail.api.mailer.config.TransportStrategy.SMTP_TLS;

import freemarker.template.Configuration;
import freemarker.template.Template;
import freemarker.template.TemplateException;
import java.io.IOException;
import java.io.StringWriter;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.email.EmailRequest;
import org.openmetadata.schema.email.SmtpSettings;
import org.simplejavamail.api.email.Email;
import org.simplejavamail.api.email.EmailPopulatingBuilder;
import org.simplejavamail.api.mailer.Mailer;
import org.simplejavamail.api.mailer.config.TransportStrategy;
import org.simplejavamail.email.EmailBuilder;
import org.simplejavamail.mailer.MailerBuilder;

@Slf4j
public class EmailUtil {
  public static final String USERNAME = "userName";
  public static final String ENTITY = "entity";
  public static final String SUPPORT_URL = "supportUrl";
  public static final String EMAIL_TEMPLATE_BASEPATH = "/emailTemplates";
  // Email Verification
  private static final String EMAIL_VERIFICATION_SUBJECT = "%s: Verify your Email Address (Action Required)";
  public static final String EMAIL_VERIFICATION_LINKKEY = "userEmailTokenVerificationLink";
  public static final String EMAIL_VERIFICATION_TEMPLATE_PATH = "email-verification.ftl";
  // Password Reset Link
  private static final String PASSWORD_RESET_SUBJECT = "%s: Reset your Password";
  public static final String PASSWORD_RESET_LINKKEY = "userResetPasswordLink";
  public static final String EXPIRATION_TIME_KEY = "expirationTime";
  public static final String DEFAULT_EXPIRATION_TIME = "60";
  public static final String PASSWORD = "password";
  public static final String APPLICATION_LOGIN_LINK = "applicationLoginLink";

  public static final String PASSWORD_RESET_TEMPLATE_FILE = "reset-link.ftl";
  // Account Change Status
  private static final String ACCOUNT_STATUS_SUBJECT = "%s: Change in Account Status";
  public static final String ACTION_KEY = "action";
  public static final String ACTION_STATUS_KEY = "actionStatus";
  public static final String ACCOUNT_STATUS_TEMPLATE_FILE = "account-activity-change.ftl";

  private static final String INVITE_SUBJECT = "Welcome to %s";

  public static final String INVITE_RANDOM_PWD = "invite-randompwd.ftl";
  public static final String INVITE_CREATE_PWD = "invite-createPassword.ftl";

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
      LOG.error("Error in instantiating [MAILER] : Reason {} ", ex.getMessage());
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

  public void sendMail(
      String subject, Map<String, String> model, String to, String baseTemplatePackage, String templatePath)
      throws IOException, TemplateException {
    EmailPopulatingBuilder emailBuilder = EmailBuilder.startingBlank();
    emailBuilder.withSubject(subject);
    emailBuilder.to(to);
    emailBuilder.from(defaultSmtpSettings.getUsername());

    templateConfiguration.setClassForTemplateLoading(getClass(), baseTemplatePackage);
    Template template = templateConfiguration.getTemplate(templatePath);

    // write the freemarker output to a StringWriter
    StringWriter stringWriter = new StringWriter();
    template.process(model, stringWriter);
    String mailContent = stringWriter.toString();
    emailBuilder.withHTMLText(mailContent);
    sendMail(emailBuilder.buildEmail());
  }

  public void sendMail(Email email) {
    if (mailer != null) {
      mailer.sendMail(email, true);
    }
  }

  public void testConnection() {
    mailer.testConnection();
  }

  public void sendMailWithSmtp(Email email, SmtpSettings settings) {
    createMailer(settings).sendMail(email);
  }

  public static class EmailUtilBuilder {
    private EmailUtilBuilder() {}

    public static EmailUtil build(SmtpSettings smtpServerSettings) {
      if (INSTANCE == null) {
        INSTANCE = new EmailUtil(smtpServerSettings);
      }
      return INSTANCE;
    }
  }

  public String getEmailVerificationSubject() {
    return String.format(EMAIL_VERIFICATION_SUBJECT, defaultSmtpSettings.getEmailingEntity());
  }

  public String getPasswordResetSubject() {
    return String.format(PASSWORD_RESET_SUBJECT, defaultSmtpSettings.getEmailingEntity());
  }

  public String getAccountStatusChangeSubject() {
    return String.format(ACCOUNT_STATUS_SUBJECT, defaultSmtpSettings.getEmailingEntity());
  }

  public String getEmailInviteSubject() {
    return String.format(INVITE_SUBJECT, defaultSmtpSettings.getEmailingEntity());
  }

  public String getEmailingEntity() {
    return defaultSmtpSettings.getEmailingEntity();
  }

  public String getSupportUrl() {
    return defaultSmtpSettings.getSupportUrl();
  }

  public String getOMUrl() {
    return defaultSmtpSettings.getOpenMetadataUrl();
  }
}
