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
import org.openmetadata.service.jdbi3.EmailTemplateRepository;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.simplejavamail.api.email.Email;
import org.simplejavamail.api.email.EmailPopulatingBuilder;
import org.simplejavamail.api.mailer.Mailer;
import org.simplejavamail.api.mailer.config.TransportStrategy;
import org.simplejavamail.email.EmailBuilder;
import org.simplejavamail.mailer.MailerBuilder;

@Slf4j
public class EmailUtil {
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
    if (smtpServerSettings.getEnableSmtpServer()) {
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
    return null;
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
      templatePopulator.put(EmailContentProvider.ENTITY, getEmailingEntity());
      templatePopulator.put(EmailContentProvider.SUPPORT_URL, getSupportUrl());
      templatePopulator.put(EmailContentProvider.USERNAME, user.getName());
      templatePopulator.put(EmailContentProvider.ACTION_KEY, action);
      templatePopulator.put(EmailContentProvider.ACTION_STATUS_KEY, status);
      sendMail(
          getAccountStatusChangeSubject(),
          templatePopulator,
          user.getEmail(),
          EmailTemplateTypeDefinition.EmailTemplateType.ACCOUNT_STATUS.toString());
    }
  }

  public void sendEmailVerification(String emailVerificationLink, User user) throws IOException, TemplateException {
    if (getSmtpSettings().getEnableSmtpServer()) {
      Map<String, String> templatePopulator = new HashMap<>();
      templatePopulator.put(EmailContentProvider.ENTITY, getEmailingEntity());
      templatePopulator.put(EmailContentProvider.SUPPORT_URL, getSupportUrl());
      templatePopulator.put(EmailContentProvider.USERNAME, user.getName());
      templatePopulator.put(EmailContentProvider.EMAIL_VERIFICATION_LINK_KEY, emailVerificationLink);
      templatePopulator.put(EmailContentProvider.EXPIRATION_TIME_KEY, "24");
      sendMail(
          getEmailVerificationSubject(),
          templatePopulator,
          user.getEmail(),
          EmailTemplateTypeDefinition.EmailTemplateType.EMAIL_VERIFICATION.toString());
    }
  }

  public void sendPasswordResetLink(String passwordResetLink, User user, String subject, String templateFilePath)
      throws IOException, TemplateException {
    if (getSmtpSettings().getEnableSmtpServer()) {
      Map<String, String> templatePopulator = new HashMap<>();
      templatePopulator.put(EmailContentProvider.ENTITY, getEmailingEntity());
      templatePopulator.put(EmailContentProvider.SUPPORT_URL, getSupportUrl());
      templatePopulator.put(EmailContentProvider.USERNAME, user.getName());
      templatePopulator.put(EmailContentProvider.PASSWORD_RESET_LINK_KEY, passwordResetLink);
      templatePopulator.put(EmailContentProvider.EXPIRATION_TIME_KEY, EmailContentProvider.DEFAULT_EXPIRATION_TIME);

      sendMail(subject, templatePopulator, user.getEmail(), templateFilePath);
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

      sendMail(subject, templatePopulator, email, templateFilePath);
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

      sendMail(subject, templatePopulator, email, templateFilePath);
    }
  }

  public void sendMail(String subject, Map<String, String> model, String to, String templatePath)
      throws IOException, TemplateException {
    if (getSmtpSettings().getEnableSmtpServer()) {
      EmailPopulatingBuilder emailBuilder = EmailBuilder.startingBlank();
      emailBuilder.withSubject(subject);
      emailBuilder.to(to);
      emailBuilder.from(getSmtpSettings().getSenderMail());

      Template template = new Template(templatePath, getEmailTemplate(templatePath), TEMPLATE_CONFIGURATION);

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
      templatePopulator.put(EmailContentProvider.ENTITY, EmailUtil.getInstance().getEmailingEntity());
      templatePopulator.put(EmailContentProvider.SUPPORT_URL, EmailUtil.getInstance().getSupportUrl());
      templatePopulator.put(EmailContentProvider.USERNAME, user.getName());
      templatePopulator.put(EmailContentProvider.PASSWORD, pwd);
      templatePopulator.put(EmailContentProvider.APPLICATION_LOGIN_LINK, EmailUtil.getInstance().getOMUrl());
      try {
        EmailUtil.getInstance()
            .sendMail(
                EmailUtil.getInstance().getEmailInviteSubject(),
                templatePopulator,
                user.getEmail(),
                EmailTemplateTypeDefinition.EmailTemplateType.INVITE_RANDOM_PWD.toString());
      } catch (Exception ex) {
        LOG.error("Failed in sending Mail to user [{}]. Reason : {}", user.getEmail(), ex.getMessage());
      }
    }
  }

  public static void sendChangeEventMail(String receiverMail, EmailMessage emailMessaged) {
    if (getSmtpSettings().getEnableSmtpServer()) {
      Map<String, String> templatePopulator = new HashMap<>();
      templatePopulator.put(EmailContentProvider.USERNAME, receiverMail.split("@")[0]);
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
                EmailTemplateTypeDefinition.EmailTemplateType.CHANGE_EVENT.toString());
      } catch (Exception ex) {
        LOG.error("Failed in sending Mail to user [{}]. Reason : {}", receiverMail, ex.getMessage());
      }
    }
  }

  public void testConnection() {
    MAILER.testConnection();
  }

  private String getEmailVerificationSubject() {
    return String.format(EmailContentProvider.getEmailVerificationSubject(), getSmtpSettings().getEmailingEntity());
  }

  public String getPasswordResetSubject() {
    return String.format(EmailContentProvider.getPasswordResetSubject(), getSmtpSettings().getEmailingEntity());
  }

  private String getAccountStatusChangeSubject() {
    return String.format(EmailContentProvider.getAccountStatusSubject(), getSmtpSettings().getEmailingEntity());
  }

  public String getEmailInviteSubject() {
    return String.format(EmailContentProvider.getInviteSubject(), getSmtpSettings().getEmailingEntity());
  }

  public String getChangeEventTemplate() {
    return String.format(EmailContentProvider.getChangeEventUpdate(), getSmtpSettings().getEmailingEntity());
  }

  public String getTaskAssignmentSubject() {
    return String.format(EmailContentProvider.getTaskSubject(), getSmtpSettings().getEmailingEntity());
  }

  public String getTestResultSubject() {
    return String.format(EmailContentProvider.getTestSubject(), getSmtpSettings().getEmailingEntity());
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

  public static String getEmailTemplate(String templateType) throws IOException {
    return EmailTemplateRepository.getEmailTemplate(templateType).getEmailContent();
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
