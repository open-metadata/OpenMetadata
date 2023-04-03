/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

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
import java.net.URI;
import java.util.HashMap;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.email.SmtpSettings;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.service.events.subscription.emailAlert.EmailMessage;
import org.openmetadata.service.resources.settings.SettingsCache;
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
  private static final String CHANGE_EVENT_UPDATE = "Change Event Update from %s";

  private static final String TASK_SUBJECT = "%s : Task Assignment Notification";
  private static final String TEST_SUBJECT = "%s : Test Result Notification";
  public static final String INVITE_RANDOM_PWD = "invite-randompwd.ftl";

  public static final String CHANGE_EVENT_TEMPLATE = "changeEvent.ftl";
  public static final String INVITE_CREATE_PWD = "invite-createPassword.ftl";
  public static final String TASK_NOTIFICATION_TEMPLATE = "taskAssignment.ftl";
  public static final String TEST_NOTIFICATION_TEMPLATE = "testResultStatus.ftl";
  private static EmailUtil INSTANCE;
  private static SmtpSettings STORED_SMTP_SETTINGS;
  private static Mailer MAILER;
  private static Configuration TEMPLATE_CONFIGURATION;

  private EmailUtil() {
    try {
      STORED_SMTP_SETTINGS = getSmtpSettings();
      MAILER = createMailer(STORED_SMTP_SETTINGS);
      TEMPLATE_CONFIGURATION = new Configuration(VERSION_2_3_28);
      LOG.info("Email Util cache is initialized");
    } catch (Exception ex) {
      LOG.warn("[MAILER] Smtp Configurations are missing : Reason {} ", ex.getMessage(), ex);
    }
  }

  private static Mailer createMailer(SmtpSettings smtpServerSettings) {
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
    if (INSTANCE == null) {
      INSTANCE = new EmailUtil();
    }
    return INSTANCE;
  }

  public void sendAccountStatus(User user, String action, String status) throws IOException, TemplateException {
    if (getSmtpSettings().getEnableSmtpServer()) {
      Map<String, String> templatePopulator = new HashMap<>();
      templatePopulator.put(ENTITY, getEmailingEntity());
      templatePopulator.put(SUPPORT_URL, getSupportUrl());
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
    if (getSmtpSettings().getEnableSmtpServer()) {
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
    if (getSmtpSettings().getEnableSmtpServer()) {
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
    if (getSmtpSettings().getEnableSmtpServer()) {
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
    if (getSmtpSettings().getEnableSmtpServer()) {
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

  public void sendMail(
      String subject, Map<String, String> model, String to, String baseTemplatePackage, String templatePath)
      throws IOException, TemplateException {
    if (getSmtpSettings().getEnableSmtpServer()) {
      EmailPopulatingBuilder emailBuilder = EmailBuilder.startingBlank();
      emailBuilder.withSubject(subject);
      emailBuilder.to(to);
      emailBuilder.from(getSmtpSettings().getSenderMail());

      TEMPLATE_CONFIGURATION.setClassForTemplateLoading(getClass(), baseTemplatePackage);
      Template template = TEMPLATE_CONFIGURATION.getTemplate(templatePath);

      // write the freemarker output to a StringWriter
      StringWriter stringWriter = new StringWriter();
      template.process(model, stringWriter);
      String mailContent = stringWriter.toString();
      emailBuilder.withHTMLText(mailContent);
      sendMail(emailBuilder.buildEmail());
    }
  }

  public void sendMail(Email email) {
    if (MAILER != null && getSmtpSettings().getEnableSmtpServer()) {
      MAILER.sendMail(email, true);
    }
  }

  public String buildBaseUrl(URI uri) {
    try {
      if (CommonUtil.nullOrEmpty(getSmtpSettings().getOpenMetadataUrl())) {
        return String.format("%s://%s", uri.getScheme(), uri.getHost());
      } else {
        URI serverUrl = new URI(getSmtpSettings().getOpenMetadataUrl());
        return String.format("%s://%s", serverUrl.getScheme(), serverUrl.getHost());
      }
    } catch (Exception ex) {
      throw new IllegalArgumentException("Missing URI info from URI and SMTP settings.");
    }
  }

  public static void sendInviteMailToAdmin(User user, String pwd) {
    if (getSmtpSettings().getEnableSmtpServer()) {
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

  public static void sendChangeEventMail(String receiverMail, EmailMessage emailMessaged) {
    if (getSmtpSettings().getEnableSmtpServer()) {
      Map<String, String> templatePopulator = new HashMap<>();
      templatePopulator.put(EmailUtil.USERNAME, receiverMail.split("@")[0]);
      templatePopulator.put("updatedBy", emailMessaged.getUpdatedBy());
      templatePopulator.put("entityUrl", emailMessaged.getEntityUrl());
      StringBuilder buff = new StringBuilder();
      for (String cmessage : emailMessaged.getChangeMessage()) {
        buff.append(cmessage);
        buff.append("\n");
      }
      templatePopulator.put("changeMessage", buff.toString());
      try {
        EmailUtil.getInstance()
            .sendMail(
                EmailUtil.getInstance().getChangeEventTemplate(),
                templatePopulator,
                receiverMail,
                EmailUtil.EMAIL_TEMPLATE_BASEPATH,
                EmailUtil.CHANGE_EVENT_TEMPLATE);
      } catch (Exception ex) {
        LOG.error("Failed in sending Mail to user [{}]. Reason : {}", receiverMail, ex.getMessage());
      }
    }
  }

  public void testConnection() {
    MAILER.testConnection();
  }

  private String getEmailVerificationSubject() {
    return String.format(EMAIL_VERIFICATION_SUBJECT, getSmtpSettings().getEmailingEntity());
  }

  public String getPasswordResetSubject() {
    return String.format(PASSWORD_RESET_SUBJECT, getSmtpSettings().getEmailingEntity());
  }

  private String getAccountStatusChangeSubject() {
    return String.format(ACCOUNT_STATUS_SUBJECT, getSmtpSettings().getEmailingEntity());
  }

  public String getEmailInviteSubject() {
    return String.format(INVITE_SUBJECT, getSmtpSettings().getEmailingEntity());
  }

  public String getChangeEventTemplate() {
    return String.format(CHANGE_EVENT_UPDATE, getSmtpSettings().getEmailingEntity());
  }

  public String getTaskAssignmentSubject() {
    return String.format(TASK_SUBJECT, getSmtpSettings().getEmailingEntity());
  }

  public String getTestResultSubject() {
    return String.format(TEST_SUBJECT, getSmtpSettings().getEmailingEntity());
  }

  public String getEmailingEntity() {
    return getSmtpSettings().getEmailingEntity();
  }

  public String getSupportUrl() {
    return getSmtpSettings().getSupportUrl();
  }

  public String getOMUrl() {
    return getSmtpSettings().getOpenMetadataUrl();
  }

  private static SmtpSettings getSmtpSettings() {
    SmtpSettings emailConfig =
        SettingsCache.getInstance().getSetting(SettingsType.EMAIL_CONFIGURATION, SmtpSettings.class);
    if (!emailConfig.equals(STORED_SMTP_SETTINGS)) {
      STORED_SMTP_SETTINGS = emailConfig;
      MAILER = createMailer(emailConfig);
    }
    return emailConfig;
  }
}
