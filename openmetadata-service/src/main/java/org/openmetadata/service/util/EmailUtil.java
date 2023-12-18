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
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.email.SmtpSettings;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.service.events.scheduled.template.DataInsightDescriptionAndOwnerTemplate;
import org.openmetadata.service.events.scheduled.template.DataInsightTotalAssetTemplate;
import org.openmetadata.service.events.subscription.email.EmailMessage;
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
  private static final String EMAIL_VERIFICATION_SUBJECT =
      "%s: Verify your Email Address (Action Required)";
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
  public static final String INVITE_RANDOM_PWD = "invite-randompwd.ftl";

  public static final String CHANGE_EVENT_TEMPLATE = "changeEvent.ftl";
  public static final String INVITE_CREATE_PWD = "invite-createPassword.ftl";
  public static final String TASK_NOTIFICATION_TEMPLATE = "taskAssignment.ftl";
  private static final String REPORT_SUBJECT = "%s: Data Insights Weekly - %s";
  public static final String DATA_INSIGHT_REPORT_TEMPLATE = "dataInsightReport.ftl";
  public static final String TEST_EMAIL_TEMPLATE = "testMail.ftl";
  public static final String TEST_EMAIL_SUBJECT = "%s : Test Email";
  private static SmtpSettings storedSmtpSettings;
  private static Mailer mailer;
  private static final Configuration templateConfiguration = new Configuration(VERSION_2_3_28);

  private static final String EMAIL_IGNORE_MSG =
      "Email was not sent to {} as SMTP setting is not enabled";

  private EmailUtil() {
    try {
      getSmtpSettings();
      LOG.info("Email Util cache is initialized");
    } catch (Exception ex) {
      LOG.warn("[MAILER] Smtp Configurations are missing : Reason {} ", ex.getMessage(), ex);
    }
  }

  private static Mailer createMailer(SmtpSettings smtpServerSettings) {
    if (Boolean.TRUE.equals(smtpServerSettings.getEnableSmtpServer())) {
      TransportStrategy strategy;
      switch (smtpServerSettings.getTransportationStrategy()) {
        case SMTPS:
          strategy = SMTPS;
          break;
        case SMTP_TLS:
          strategy = SMTP_TLS;
          break;
        default:
          strategy = SMTP;
          break;
      }
      String username =
          CommonUtil.nullOrEmpty(smtpServerSettings.getUsername())
              ? null
              : smtpServerSettings.getUsername();
      String password =
          CommonUtil.nullOrEmpty(smtpServerSettings.getPassword())
              ? null
              : smtpServerSettings.getPassword();
      return MailerBuilder.withSMTPServer(
              smtpServerSettings.getServerEndpoint(),
              smtpServerSettings.getServerPort(),
              username,
              password)
          .withTransportStrategy(strategy)
          .buildMailer();
    }
    return null;
  }

  public static void sendAccountStatus(User user, String action, String status)
      throws IOException, TemplateException {
    if (Boolean.TRUE.equals(getSmtpSettings().getEnableSmtpServer())) {
      Map<String, Object> templatePopulator = new HashMap<>();
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
    } else {
      LOG.warn(EMAIL_IGNORE_MSG, user.getEmail());
    }
  }

  public static void sendEmailVerification(String emailVerificationLink, User user)
      throws IOException, TemplateException {
    if (Boolean.TRUE.equals(getSmtpSettings().getEnableSmtpServer())) {
      Map<String, Object> templatePopulator = new HashMap<>();
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
    } else {
      LOG.warn(EMAIL_IGNORE_MSG, user.getEmail());
    }
  }

  public static void sendPasswordResetLink(
      String passwordResetLink, User user, String subject, String templateFilePath)
      throws IOException, TemplateException {
    if (Boolean.TRUE.equals(getSmtpSettings().getEnableSmtpServer())) {
      Map<String, Object> templatePopulator = new HashMap<>();
      templatePopulator.put(ENTITY, getEmailingEntity());
      templatePopulator.put(SUPPORT_URL, getSupportUrl());
      templatePopulator.put(USERNAME, user.getName());
      templatePopulator.put(PASSWORD_RESET_LINKKEY, passwordResetLink);
      templatePopulator.put(EXPIRATION_TIME_KEY, DEFAULT_EXPIRATION_TIME);

      sendMail(
          subject, templatePopulator, user.getEmail(), EMAIL_TEMPLATE_BASEPATH, templateFilePath);
    } else {
      LOG.warn(EMAIL_IGNORE_MSG, user.getEmail());
    }
  }

  public static void sendTaskAssignmentNotificationToUser(
      String assigneeName,
      String email,
      String taskLink,
      Thread thread,
      String subject,
      String templateFilePath)
      throws IOException, TemplateException {
    if (Boolean.TRUE.equals(getSmtpSettings().getEnableSmtpServer())) {
      Map<String, Object> templatePopulator = new HashMap<>();
      templatePopulator.put("assignee", assigneeName);
      templatePopulator.put("createdBy", thread.getCreatedBy());
      templatePopulator.put("taskName", thread.getMessage());
      templatePopulator.put("taskStatus", thread.getTask().getStatus().toString());
      templatePopulator.put("taskType", thread.getTask().getType().toString());
      templatePopulator.put("fieldOldValue", thread.getTask().getOldValue());
      templatePopulator.put("fieldNewValue", thread.getTask().getSuggestion());
      templatePopulator.put("taskLink", taskLink);

      sendMail(subject, templatePopulator, email, EMAIL_TEMPLATE_BASEPATH, templateFilePath);
    } else {
      LOG.warn(EMAIL_IGNORE_MSG, email);
    }
  }

  public static void sendMail(
      String subject,
      Map<String, Object> model,
      String to,
      String baseTemplatePackage,
      String templatePath)
      throws IOException, TemplateException {
    if (Boolean.TRUE.equals(getSmtpSettings().getEnableSmtpServer())) {
      EmailPopulatingBuilder emailBuilder = EmailBuilder.startingBlank();
      emailBuilder.withSubject(subject);
      emailBuilder.to(to);
      emailBuilder.from(getSmtpSettings().getSenderMail());

      templateConfiguration.setClassForTemplateLoading(EmailUtil.class, baseTemplatePackage);
      Template template = templateConfiguration.getTemplate(templatePath);

      // write the freemarker output to a StringWriter
      StringWriter stringWriter = new StringWriter();
      template.process(model, stringWriter);
      String mailContent = stringWriter.toString();
      emailBuilder.withHTMLText(mailContent);
      sendMail(emailBuilder.buildEmail());
    } else {
      LOG.warn(EMAIL_IGNORE_MSG, to);
    }
  }

  public static void sendMailToMultiple(
      String subject,
      Map<String, Object> model,
      Set<String> to,
      String baseTemplatePackage,
      String templatePath)
      throws IOException, TemplateException {
    if (Boolean.TRUE.equals(getSmtpSettings().getEnableSmtpServer())) {
      EmailPopulatingBuilder emailBuilder = EmailBuilder.startingBlank();
      emailBuilder.withSubject(subject);
      emailBuilder.toMultiple(to);
      emailBuilder.from(getSmtpSettings().getSenderMail());

      templateConfiguration.setClassForTemplateLoading(EmailUtil.class, baseTemplatePackage);
      Template template = templateConfiguration.getTemplate(templatePath);

      // write the freemarker output to a StringWriter
      StringWriter stringWriter = new StringWriter();
      template.process(model, stringWriter);
      String mailContent = stringWriter.toString();
      emailBuilder.withHTMLText(mailContent);
      sendMail(emailBuilder.buildEmail());
    }
  }

  public static void sendMail(Email email) {
    if (mailer != null && getSmtpSettings().getEnableSmtpServer()) {
      mailer.sendMail(email, true);
    }
  }

  public static void sendInviteMailToAdmin(User user, String pwd) {
    if (Boolean.TRUE.equals(getSmtpSettings().getEnableSmtpServer())) {
      Map<String, Object> templatePopulator = new HashMap<>();
      templatePopulator.put(EmailUtil.ENTITY, EmailUtil.getEmailingEntity());
      templatePopulator.put(EmailUtil.SUPPORT_URL, EmailUtil.getSupportUrl());
      templatePopulator.put(EmailUtil.USERNAME, user.getName());
      templatePopulator.put(EmailUtil.PASSWORD, pwd);
      templatePopulator.put(EmailUtil.APPLICATION_LOGIN_LINK, EmailUtil.getOMUrl());
      try {
        EmailUtil.sendMail(
            EmailUtil.getEmailInviteSubject(),
            templatePopulator,
            user.getEmail(),
            EmailUtil.EMAIL_TEMPLATE_BASEPATH,
            EmailUtil.INVITE_RANDOM_PWD);
      } catch (Exception ex) {
        LOG.error(
            "Failed in sending Mail to user [{}]. Reason : {}", user.getEmail(), ex.getMessage());
      }
    } else {
      LOG.warn(EMAIL_IGNORE_MSG, user.getEmail());
    }
  }

  public static void sendChangeEventMail(String receiverMail, EmailMessage emailMessaged) {
    if (Boolean.TRUE.equals(getSmtpSettings().getEnableSmtpServer())) {
      Map<String, Object> templatePopulator = new HashMap<>();
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
        EmailUtil.sendMail(
            EmailUtil.getChangeEventTemplate(),
            templatePopulator,
            receiverMail,
            EmailUtil.EMAIL_TEMPLATE_BASEPATH,
            EmailUtil.CHANGE_EVENT_TEMPLATE);
      } catch (Exception ex) {
        LOG.error(
            "Failed in sending Mail to user [{}]. Reason : {}", receiverMail, ex.getMessage());
      }
    } else {
      LOG.warn(EMAIL_IGNORE_MSG, receiverMail);
    }
  }

  public static void sendDataInsightEmailNotificationToUser(
      Set<String> emails,
      DataInsightTotalAssetTemplate totalAssetObj,
      DataInsightDescriptionAndOwnerTemplate descriptionObj,
      DataInsightDescriptionAndOwnerTemplate ownerShipObj,
      DataInsightDescriptionAndOwnerTemplate tierObj,
      String subject,
      String templateFilePath)
      throws IOException, TemplateException {
    if (Boolean.TRUE.equals(getSmtpSettings().getEnableSmtpServer())) {
      Map<String, Object> templatePopulator = new HashMap<>();
      templatePopulator.put("totalAssetObj", totalAssetObj);
      templatePopulator.put("descriptionObj", descriptionObj);
      templatePopulator.put("ownershipObj", ownerShipObj);
      templatePopulator.put("tierObj", tierObj);
      sendMailToMultiple(
          subject, templatePopulator, emails, EMAIL_TEMPLATE_BASEPATH, templateFilePath);
    } else {
      LOG.warn(EMAIL_IGNORE_MSG, emails.toString());
    }
  }

  public static void sendTestEmail(String email) throws IOException, TemplateException {
    if (Boolean.TRUE.equals(getSmtpSettings().getEnableSmtpServer())) {
      Map<String, Object> templatePopulator = new HashMap<>();
      templatePopulator.put("userName", email.split("@")[0]);
      templatePopulator.put("entity", getSmtpSettings().getEmailingEntity());
      templatePopulator.put("supportUrl", getSmtpSettings().getSupportUrl());
      sendMail(
          getTestEmailSubject(),
          templatePopulator,
          email,
          EMAIL_TEMPLATE_BASEPATH,
          TEST_EMAIL_TEMPLATE);
    } else {
      LOG.warn(EMAIL_IGNORE_MSG, email);
    }
  }

  public static void testConnection() {
    mailer.testConnection();
  }

  private static String getEmailVerificationSubject() {
    return String.format(EMAIL_VERIFICATION_SUBJECT, getSmtpSettings().getEmailingEntity());
  }

  public static String getPasswordResetSubject() {
    return String.format(PASSWORD_RESET_SUBJECT, getSmtpSettings().getEmailingEntity());
  }

  private static String getAccountStatusChangeSubject() {
    return String.format(ACCOUNT_STATUS_SUBJECT, getSmtpSettings().getEmailingEntity());
  }

  public static String getEmailInviteSubject() {
    return String.format(INVITE_SUBJECT, getSmtpSettings().getEmailingEntity());
  }

  public static String getChangeEventTemplate() {
    return String.format(CHANGE_EVENT_UPDATE, getSmtpSettings().getEmailingEntity());
  }

  public static String getTaskAssignmentSubject() {
    return String.format(TASK_SUBJECT, getSmtpSettings().getEmailingEntity());
  }

  public static String getTestEmailSubject() {
    return String.format(TEST_EMAIL_SUBJECT, getSmtpSettings().getEmailingEntity());
  }

  public static String getDataInsightReportSubject() {
    return String.format(
        REPORT_SUBJECT,
        getSmtpSettings().getEmailingEntity(),
        new SimpleDateFormat("dd-MM-yy").format(new Date()));
  }

  public static String getEmailingEntity() {
    return getSmtpSettings().getEmailingEntity();
  }

  public static String getSupportUrl() {
    return getSmtpSettings().getSupportUrl();
  }

  public static String getOMUrl() {
    return getSmtpSettings().getOpenMetadataUrl();
  }

  public static SmtpSettings getSmtpSettings() {
    SmtpSettings emailConfig =
        SettingsCache.getSetting(SettingsType.EMAIL_CONFIGURATION, SmtpSettings.class);
    if (!emailConfig.equals(storedSmtpSettings)) {
      storedSmtpSettings = emailConfig;
      mailer = createMailer(emailConfig);
    }
    return emailConfig;
  }
}
