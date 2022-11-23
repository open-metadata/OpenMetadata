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
import java.util.HashMap;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.email.SmtpSettings;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.OpenMetadataApplicationConfig;
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

  private static EmailUtil INSTANCE;
  private static SmtpSettings DEFAULT_SMTP_SETTINGS;
  private static Mailer MAILER;
  private static Configuration TEMPLATE_CONFIGURATION;
  private static volatile boolean INITIALIZED = false;

  public static void initialize(OpenMetadataApplicationConfig config) {
    if (!INITIALIZED) {
      if (config.getSmtpSettings() != null && config.getSmtpSettings().getEnableSmtpServer()) {
        try {
          DEFAULT_SMTP_SETTINGS = config.getSmtpSettings();
          MAILER = createMailer(DEFAULT_SMTP_SETTINGS);
          TEMPLATE_CONFIGURATION = new Configuration(VERSION_2_3_28);
          LOG.info("Email Util cache is initialized");
        } catch (Exception ex) {
          LOG.warn("[MAILER] Smtp Configurations are missing : Reason {} ", ex.getMessage(), ex);
        }
      } else {
        DEFAULT_SMTP_SETTINGS = new SmtpSettings();
      }
      INSTANCE = new EmailUtil();
      INITIALIZED = true;
    } else {
      INITIALIZED = false;
      LOG.info("Email Util is already initialized");
    }
  }

  private static Mailer createMailer(SmtpSettings smtpServerSettings) {
    TransportStrategy strategy = SMTP;
    switch (smtpServerSettings.getTransportationStrategy()) {
      case SMTP:
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

  public static void sendInviteMailToAdmin(User user, String pwd) {
    if (DEFAULT_SMTP_SETTINGS.getEnableSmtpServer()) {
      Map<String, String> templatePopulator = new HashMap<>();
      templatePopulator.put(EmailUtil.ENTITY, EmailUtil.getInstance().getEmailingEntity());
      templatePopulator.put(EmailUtil.SUPPORT_URL, EmailUtil.getInstance().getSupportUrl());
      templatePopulator.put(EmailUtil.USERNAME, user.getName());
      templatePopulator.put(EmailUtil.PASSWORD, pwd);
      templatePopulator.put(EmailUtil.APPLICATION_LOGIN_LINK, EmailUtil.getInstance().getOMUrl());
      try {
        EmailUtil.getInstance()
            .sendMail(
                EmailUtil.getInstance().getEmailInviteSubject(),
                templatePopulator,
                user.getEmail(),
                EmailUtil.EMAIL_TEMPLATE_BASEPATH,
                EmailUtil.INVITE_RANDOM_PWD);
      } catch (Exception ex) {
        LOG.error("Failed in sending Mail to user [{}]. Reason : {}", user.getEmail(), ex.getMessage());
      }
    }
  }

  public void sendMail(
      String subject, Map<String, String> model, String to, String baseTemplatePackage, String templatePath)
      throws IOException, TemplateException {
    EmailPopulatingBuilder emailBuilder = EmailBuilder.startingBlank();
    emailBuilder.withSubject(subject);
    emailBuilder.to(to);
    emailBuilder.from(DEFAULT_SMTP_SETTINGS.getSenderMail());

    TEMPLATE_CONFIGURATION.setClassForTemplateLoading(getClass(), baseTemplatePackage);
    Template template = TEMPLATE_CONFIGURATION.getTemplate(templatePath);

    // write the freemarker output to a StringWriter
    StringWriter stringWriter = new StringWriter();
    template.process(model, stringWriter);
    String mailContent = stringWriter.toString();
    emailBuilder.withHTMLText(mailContent);
    sendMail(emailBuilder.buildEmail());
  }

  public void sendMail(Email email) {
    if (MAILER != null && DEFAULT_SMTP_SETTINGS.getEnableSmtpServer()) {
      MAILER.sendMail(email, true);
    }
  }

  public void testConnection() {
    MAILER.testConnection();
  }

  public String getEmailVerificationSubject() {
    return String.format(EMAIL_VERIFICATION_SUBJECT, DEFAULT_SMTP_SETTINGS.getEmailingEntity());
  }

  public String getPasswordResetSubject() {
    return String.format(PASSWORD_RESET_SUBJECT, DEFAULT_SMTP_SETTINGS.getEmailingEntity());
  }

  public String getAccountStatusChangeSubject() {
    return String.format(ACCOUNT_STATUS_SUBJECT, DEFAULT_SMTP_SETTINGS.getEmailingEntity());
  }

  public String getEmailInviteSubject() {
    return String.format(INVITE_SUBJECT, DEFAULT_SMTP_SETTINGS.getEmailingEntity());
  }

  public String getEmailingEntity() {
    return DEFAULT_SMTP_SETTINGS.getEmailingEntity();
  }

  public String getSupportUrl() {
    return DEFAULT_SMTP_SETTINGS.getSupportUrl();
  }

  public String getOMUrl() {
    return DEFAULT_SMTP_SETTINGS.getOpenMetadataUrl();
  }
}
