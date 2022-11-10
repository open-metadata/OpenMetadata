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
import org.openmetadata.schema.email.EmailRequest;
import org.openmetadata.schema.email.SmtpSettings;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.tests.type.TestCaseResult;
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
  private static final String TASK_SUBJECT = "%s : Task Assignment Notification";
  private static final String TEST_SUBJECT = "%s : Test Result Notification";
  public static final String INVITE_RANDOM_PWD = "invite-randompwd.ftl";
  public static final String INVITE_CREATE_PWD = "invite-createPassword.ftl";
  public static final String TASK_NOTIFICATION_TEMPLATE = "taskAssignment.ftl";
  public static final String TEST_NOTIFICATION_TEMPLATE = "testResultStatus.ftl";
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
      LOG.warn("[MAILER] Smtp Configurations are missing : Reason {} ", ex.getMessage(), ex);
    }
  }

  private Mailer createMailer(SmtpSettings smtpServerSettings) {
    TransportStrategy strategy;
    switch (smtpServerSettings.getTransportationStrategy()) {
      case SMPTS:
        strategy = SMTPS;
        break;
      case SMTP_TLS:
        strategy = SMTP_TLS;
        break;
      default:
        strategy = SMTP;
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

  public void sendAccountStatus(User user, String action, String status) throws IOException, TemplateException {
    if (defaultSmtpSettings.getEnableSmtpServer()) {
      Map<String, String> templatePopulator = new HashMap<>();
      templatePopulator.put(ENTITY, EmailUtil.getInstance().getEmailingEntity());
      templatePopulator.put(SUPPORT_URL, EmailUtil.getInstance().getSupportUrl());
      templatePopulator.put(USERNAME, user.getName());
      templatePopulator.put(ACTION_KEY, action);
      templatePopulator.put(ACTION_STATUS_KEY, status);
      sendMail(
          getAccountStatusChangeSubject(),
          templatePopulator,
          user.getEmail(),
          EMAIL_TEMPLATE_BASEPATH,
          ACCOUNT_STATUS_TEMPLATE_FILE);
    }
  }

  public void sendEmailVerification(String emailVerificationLink, User user) throws IOException, TemplateException {
    if (defaultSmtpSettings.getEnableSmtpServer()) {
      Map<String, String> templatePopulator = new HashMap<>();
      templatePopulator.put(ENTITY, getEmailingEntity());
      templatePopulator.put(SUPPORT_URL, getSupportUrl());
      templatePopulator.put(USERNAME, user.getName());
      templatePopulator.put(EMAIL_VERIFICATION_LINKKEY, emailVerificationLink);
      templatePopulator.put(EXPIRATION_TIME_KEY, "24");
      sendMail(
          getEmailVerificationSubject(),
          templatePopulator,
          user.getEmail(),
          EMAIL_TEMPLATE_BASEPATH,
          EMAIL_VERIFICATION_TEMPLATE_PATH);
    }
  }

  public void sendPasswordResetLink(String passwordResetLink, User user, String subject, String templateFilePath)
      throws IOException, TemplateException {
    if (defaultSmtpSettings.getEnableSmtpServer()) {
      Map<String, String> templatePopulator = new HashMap<>();
      templatePopulator.put(ENTITY, getEmailingEntity());
      templatePopulator.put(SUPPORT_URL, getSupportUrl());
      templatePopulator.put(USERNAME, user.getName());
      templatePopulator.put(PASSWORD_RESET_LINKKEY, passwordResetLink);
      templatePopulator.put(EXPIRATION_TIME_KEY, DEFAULT_EXPIRATION_TIME);

      sendMail(subject, templatePopulator, user.getEmail(), EMAIL_TEMPLATE_BASEPATH, templateFilePath);
    }
  }

  public void sendTaskAssignmentNotificationToUser(
      String assigneeName, String email, String taskLink, Thread thread, String subject, String templateFilePath)
      throws IOException, TemplateException {
    if (defaultSmtpSettings.getEnableSmtpServer()) {
      Map<String, String> templatePopulator = new HashMap<>();
      templatePopulator.put("assignee", assigneeName);
      templatePopulator.put("createdBy", thread.getCreatedBy());
      templatePopulator.put("taskName", thread.getMessage());
      templatePopulator.put("taskStatus", thread.getTask().getStatus().toString());
      templatePopulator.put("taskType", thread.getTask().getType().toString());
      templatePopulator.put("fieldOldValue", thread.getTask().getOldValue());
      templatePopulator.put("fieldNewValue", thread.getTask().getSuggestion());
      templatePopulator.put("taskLink", taskLink);

      sendMail(subject, templatePopulator, email, EMAIL_TEMPLATE_BASEPATH, templateFilePath);
    }
  }

  public void sendTestResultEmailNotificationToUser(
      String email,
      String testResultLink,
      String testCaseName,
      TestCaseResult result,
      String subject,
      String templateFilePath)
      throws IOException, TemplateException {
    if (defaultSmtpSettings.getEnableSmtpServer()) {
      Map<String, String> templatePopulator = new HashMap<>();
      templatePopulator.put("receiverName", email.split("@")[0]);
      templatePopulator.put("testResultName", testCaseName);
      templatePopulator.put("testResultDescription", result.getResult());
      templatePopulator.put("testResultStatus", result.getTestCaseStatus().toString());
      templatePopulator.put("testResultTimestamp", result.getTimestamp().toString());
      templatePopulator.put("testResultLink", testResultLink);

      sendMail(subject, templatePopulator, email, EMAIL_TEMPLATE_BASEPATH, templateFilePath);
    }
  }

  public Email buildEmailWithDefaultSender(EmailRequest request) {
    EmailPopulatingBuilder emailBuilder = EmailBuilder.startingBlank();
    if (request.getRecipientMails() != null
        && request.getRecipientMails().size() != 0
        && request.getSubject() != null
        && !request.getSubject().equals("")) {
      // Sender Details
      emailBuilder.from(defaultSmtpSettings.getSenderMail());

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
    if (defaultSmtpSettings.getEnableSmtpServer()) {
      EmailPopulatingBuilder emailBuilder = EmailBuilder.startingBlank();
      emailBuilder.withSubject(subject);
      emailBuilder.to(to);
      emailBuilder.from(defaultSmtpSettings.getSenderMail());

      templateConfiguration.setClassForTemplateLoading(getClass(), baseTemplatePackage);
      Template template = templateConfiguration.getTemplate(templatePath);

      // write the freemarker output to a StringWriter
      StringWriter stringWriter = new StringWriter();
      template.process(model, stringWriter);
      String mailContent = stringWriter.toString();
      emailBuilder.withHTMLText(mailContent);
      sendMail(emailBuilder.buildEmail());
    }
  }

  public void sendMail(Email email) {
    if (mailer != null && defaultSmtpSettings.getEnableSmtpServer()) {
      mailer.sendMail(email, true);
    }
  }

  public void testConnection() {
    mailer.testConnection();
  }

  public static class EmailUtilBuilder {
    private EmailUtilBuilder() {}

    public static void build(SmtpSettings smtpServerSettings) {
      if (INSTANCE == null) {
        INSTANCE = new EmailUtil(smtpServerSettings);
      }
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

  public String getTaskAssignmentSubject() {
    return String.format(TASK_SUBJECT, defaultSmtpSettings.getEmailingEntity());
  }

  public String getTestResultSubject() {
    return String.format(TEST_SUBJECT, defaultSmtpSettings.getEmailingEntity());
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
