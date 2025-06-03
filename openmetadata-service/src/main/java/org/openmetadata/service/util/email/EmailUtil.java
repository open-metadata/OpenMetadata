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

package org.openmetadata.service.util.email;

import static org.openmetadata.service.util.email.TemplateConstants.ACCOUNT_ACTIVITY_CHANGE_TEMPLATE;
import static org.openmetadata.service.util.email.TemplateConstants.ACCOUNT_STATUS_SUBJECT;
import static org.openmetadata.service.util.email.TemplateConstants.ACTION_KEY;
import static org.openmetadata.service.util.email.TemplateConstants.ACTION_STATUS_KEY;
import static org.openmetadata.service.util.email.TemplateConstants.APPLICATION_LOGIN_LINK;
import static org.openmetadata.service.util.email.TemplateConstants.CHANGE_EVENT_TEMPLATE;
import static org.openmetadata.service.util.email.TemplateConstants.CHANGE_EVENT_UPDATE;
import static org.openmetadata.service.util.email.TemplateConstants.DEFAULT_EXPIRATION_TIME;
import static org.openmetadata.service.util.email.TemplateConstants.EMAIL_IGNORE_MSG;
import static org.openmetadata.service.util.email.TemplateConstants.EMAIL_VERIFICATION_LINKKEY;
import static org.openmetadata.service.util.email.TemplateConstants.EMAIL_VERIFICATION_SUBJECT;
import static org.openmetadata.service.util.email.TemplateConstants.EMAIL_VERIFICATION_TEMPLATE;
import static org.openmetadata.service.util.email.TemplateConstants.ENTITY;
import static org.openmetadata.service.util.email.TemplateConstants.EXPIRATION_TIME_KEY;
import static org.openmetadata.service.util.email.TemplateConstants.INVITE_RANDOM_PASSWORD_TEMPLATE;
import static org.openmetadata.service.util.email.TemplateConstants.INVITE_SUBJECT;
import static org.openmetadata.service.util.email.TemplateConstants.PASSWORD;
import static org.openmetadata.service.util.email.TemplateConstants.PASSWORD_RESET_LINKKEY;
import static org.openmetadata.service.util.email.TemplateConstants.PASSWORD_RESET_SUBJECT;
import static org.openmetadata.service.util.email.TemplateConstants.REPORT_SUBJECT;
import static org.openmetadata.service.util.email.TemplateConstants.SUPPORT_URL;
import static org.openmetadata.service.util.email.TemplateConstants.TASK_SUBJECT;
import static org.openmetadata.service.util.email.TemplateConstants.TEST_EMAIL_SUBJECT;
import static org.openmetadata.service.util.email.TemplateConstants.TEST_MAIL_TEMPLATE;
import static org.openmetadata.service.util.email.TemplateConstants.USERNAME;
import static org.simplejavamail.api.mailer.config.TransportStrategy.SMTP;
import static org.simplejavamail.api.mailer.config.TransportStrategy.SMTPS;
import static org.simplejavamail.api.mailer.config.TransportStrategy.SMTP_TLS;

import freemarker.template.Template;
import freemarker.template.TemplateException;
import java.io.IOException;
import java.io.StringWriter;
import java.text.SimpleDateFormat;
import java.util.Collections;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.api.configuration.OpenMetadataBaseUrlConfiguration;
import org.openmetadata.schema.email.SmtpSettings;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.service.apps.bundles.changeEvent.email.EmailMessage;
import org.openmetadata.service.events.scheduled.template.DataInsightDescriptionAndOwnerTemplate;
import org.openmetadata.service.events.scheduled.template.DataInsightTotalAssetTemplate;
import org.openmetadata.service.jdbi3.SystemRepository;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.simplejavamail.api.email.Email;
import org.simplejavamail.api.email.EmailPopulatingBuilder;
import org.simplejavamail.api.mailer.Mailer;
import org.simplejavamail.api.mailer.config.TransportStrategy;
import org.simplejavamail.email.EmailBuilder;
import org.simplejavamail.mailer.MailerBuilder;

@Slf4j
public class EmailUtil {
  private static Mailer mailer;
  private static SmtpSettings storedSmtpSettings;
  private static TemplateProvider templateProvider;

  static {
    getSmtpSettings();
    initializeTemplateProvider();
  }

  private static void initializeTemplateProvider() {
    templateProvider = new DefaultTemplateProvider();
  }

  private EmailUtil() {
    try {
      getSmtpSettings();
      initializeTemplateProvider();
      LOG.info("Email Util Cache is initialized");
    } catch (Exception ex) {
      LOG.warn("[MAILER] Smtp Configurations are missing : Reason {} ", ex.getMessage(), ex);
    }
  }

  private static Mailer createMailer(SmtpSettings smtpServerSettings) {
    if (Boolean.TRUE.equals(smtpServerSettings.getEnableSmtpServer())) {
      TransportStrategy strategy =
          switch (smtpServerSettings.getTransportationStrategy()) {
            case SMTPS -> SMTPS;
            case SMTP_TLS -> SMTP_TLS;
            default -> SMTP;
          };
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

  public static void sendAccountStatus(String userName, String email, String action, String status)
      throws IOException, TemplateException {

    if (Boolean.TRUE.equals(getSmtpSettings().getEnableSmtpServer())) {
      Map<String, Object> templatePopulator =
          new TemplatePopulatorBuilder()
              .add(ENTITY, getSmtpSettings().getEmailingEntity())
              .add(SUPPORT_URL, getSmtpSettings().getSupportUrl())
              .add(USERNAME, userName)
              .add(ACTION_KEY, action)
              .add(ACTION_STATUS_KEY, status)
              .build();

      sendMail(
          getAccountStatusChangeSubject(),
          templatePopulator,
          email,
          ACCOUNT_ACTIVITY_CHANGE_TEMPLATE,
          true);
    } else {
      LOG.warn(EMAIL_IGNORE_MSG, userName);
    }
  }

  public static void sendEmailVerification(String emailVerificationLink, User user)
      throws IOException, TemplateException {
    if (Boolean.TRUE.equals(getSmtpSettings().getEnableSmtpServer())) {

      Map<String, Object> templatePopulator =
          new TemplatePopulatorBuilder()
              .add(ENTITY, getSmtpSettings().getEmailingEntity())
              .add(SUPPORT_URL, getSmtpSettings().getSupportUrl())
              .add(USERNAME, user.getName())
              .add(EMAIL_VERIFICATION_LINKKEY, emailVerificationLink)
              .add(EXPIRATION_TIME_KEY, "24")
              .build();

      sendMail(
          getEmailVerificationSubject(),
          templatePopulator,
          user.getEmail(),
          EMAIL_VERIFICATION_TEMPLATE,
          true);
    } else {
      LOG.warn(EMAIL_IGNORE_MSG, user.getEmail());
    }
  }

  public static void sendPasswordResetLink(
      String passwordResetLink, User user, String subject, String templateFilePath)
      throws IOException, TemplateException {
    if (Boolean.TRUE.equals(getSmtpSettings().getEnableSmtpServer())) {

      Map<String, Object> templatePopulator =
          new TemplatePopulatorBuilder()
              .add(ENTITY, getSmtpSettings().getEmailingEntity())
              .add(SUPPORT_URL, getSmtpSettings().getSupportUrl())
              .add(USERNAME, user.getName())
              .add(PASSWORD_RESET_LINKKEY, passwordResetLink)
              .add(EXPIRATION_TIME_KEY, DEFAULT_EXPIRATION_TIME)
              .build();

      sendMail(subject, templatePopulator, user.getEmail(), templateFilePath, true);
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

      Map<String, Object> templatePopulator =
          new TemplatePopulatorBuilder()
              .add("assignee", assigneeName)
              .add("createdBy", thread.getCreatedBy())
              .add("taskName", thread.getMessage())
              .add("taskStatus", thread.getTask().getStatus().toString())
              .add("taskType", thread.getTask().getType().toString())
              .add("fieldOldValue", thread.getTask().getOldValue())
              .add("fieldNewValue", thread.getTask().getSuggestion())
              .add("taskLink", taskLink)
              .build();

      sendMail(subject, templatePopulator, email, templateFilePath, true);
    } else {
      LOG.warn(EMAIL_IGNORE_MSG, email);
    }
  }

  public static void sendMail(
      String subject, Map<String, Object> model, String to, String templateName, boolean async)
      throws IOException, TemplateException {
    if (Boolean.TRUE.equals(getSmtpSettings().getEnableSmtpServer())) {
      EmailPopulatingBuilder emailBuilder = EmailBuilder.startingBlank();
      emailBuilder.withSubject(subject);
      emailBuilder.to(to);
      emailBuilder.from(getSmtpSettings().getSenderMail());

      Template template = templateProvider.getTemplate(templateName);

      // write the freemarker output to a StringWriter
      StringWriter stringWriter = new StringWriter();
      template.process(model, stringWriter);
      String mailContent = stringWriter.toString();
      emailBuilder.withHTMLText(mailContent);
      sendMail(emailBuilder.buildEmail(), async);
    } else {
      LOG.warn(EMAIL_IGNORE_MSG, to);
    }
  }

  public static void sendMailToMultiple(
      String subject, Map<String, Object> model, Set<String> to, String templateName)
      throws IOException, TemplateException {
    if (Boolean.TRUE.equals(getSmtpSettings().getEnableSmtpServer())) {
      EmailPopulatingBuilder emailBuilder = EmailBuilder.startingBlank();
      emailBuilder.withSubject(subject);
      emailBuilder.toMultiple(to);
      emailBuilder.from(getSmtpSettings().getSenderMail());

      Template template = templateProvider.getTemplate(templateName);

      // write the freemarker output to a StringWriter
      StringWriter stringWriter = new StringWriter();
      template.process(model, stringWriter);
      String mailContent = stringWriter.toString();
      emailBuilder.withHTMLText(mailContent);
      sendMail(emailBuilder.buildEmail(), true);
    }
  }

  public static void sendMail(Email email, boolean async) {
    if (Boolean.TRUE.equals(getSmtpSettings().getEnableSmtpServer()) && mailer != null) {
      mailer.sendMail(email, async);
    } else {
      LOG.error("Mailer is not initialized or Smtp is not Enabled.");
    }
  }

  public static void sendInviteMailToAdmin(User user, String password) {
    if (Boolean.TRUE.equals(getSmtpSettings().getEnableSmtpServer())) {

      Map<String, Object> templatePopulator =
          new TemplatePopulatorBuilder()
              .add(ENTITY, getSmtpSettings().getEmailingEntity())
              .add(SUPPORT_URL, getSmtpSettings().getSupportUrl())
              .add(USERNAME, user.getName())
              .add(PASSWORD, password)
              .add(APPLICATION_LOGIN_LINK, getOMBaseURL())
              .build();

      try {
        EmailUtil.sendMail(
            EmailUtil.getEmailInviteSubject(),
            templatePopulator,
            user.getEmail(),
            INVITE_RANDOM_PASSWORD_TEMPLATE,
            true);
      } catch (Exception ex) {
        LOG.error(
            "Failed in sending Mail to user [{}]. Reason : {}", user.getEmail(), ex.getMessage());
      }
    } else {
      LOG.warn(EMAIL_IGNORE_MSG, user.getEmail());
    }
  }

  public static void sendChangeEventMail(
      String publisherName, String receiverMail, EmailMessage emailMessaged) {
    if (Boolean.TRUE.equals(getSmtpSettings().getEnableSmtpServer())) {

      StringBuilder buff = new StringBuilder();
      for (String cmessage : emailMessaged.getChangeMessage()) {
        buff.append(cmessage);
        buff.append("\n");
      }

      Map<String, Object> templatePopulator =
          new TemplatePopulatorBuilder()
              .add(USERNAME, receiverMail.split("@")[0])
              .add("updatedBy", emailMessaged.getUpdatedBy())
              .add("entityUrl", emailMessaged.getEntityUrl())
              .add("changeMessage", buff.toString())
              .build();

      try {
        EmailUtil.sendMail(
            EmailUtil.getChangeEventTemplate(publisherName),
            templatePopulator,
            receiverMail,
            CHANGE_EVENT_TEMPLATE,
            true);
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
      String startDate,
      String endDate,
      DataInsightTotalAssetTemplate totalAssetObj,
      DataInsightDescriptionAndOwnerTemplate descriptionObj,
      DataInsightDescriptionAndOwnerTemplate ownerShipObj,
      DataInsightDescriptionAndOwnerTemplate tierObj,
      String subject,
      String templateFilePath)
      throws IOException, TemplateException {
    if (Boolean.TRUE.equals(getSmtpSettings().getEnableSmtpServer())) {

      Map<String, Object> templatePopulator =
          new TemplatePopulatorBuilder()
              .add("startDate", startDate)
              .add("endDate", endDate)
              .add("totalAssetObj", totalAssetObj)
              .add("descriptionObj", descriptionObj)
              .add("ownershipObj", ownerShipObj)
              .add("tierObj", tierObj)
              .add("viewReportUrl", String.format("%s/data-insights/data-assets", getOMBaseURL()))
              .build();

      sendMailToMultiple(subject, templatePopulator, emails, templateFilePath);
    } else {
      LOG.warn(EMAIL_IGNORE_MSG, emails.toString());
    }
  }

  public static void sendTestEmail(String email, boolean async)
      throws IOException, TemplateException {
    if (Boolean.TRUE.equals(getSmtpSettings().getEnableSmtpServer())) {

      Map<String, Object> templatePopulator =
          new TemplatePopulatorBuilder()
              .add("userName", email.split("@")[0])
              .add("entity", getSmtpSettings().getEmailingEntity())
              .add("supportUrl", getSmtpSettings().getSupportUrl())
              .build();

      sendMail(getTestEmailSubject(), templatePopulator, email, TEST_MAIL_TEMPLATE, async);
    } else {
      LOG.warn(EMAIL_IGNORE_MSG, email);
    }
  }

  public static void testConnection() {
    if (Boolean.TRUE.equals(getSmtpSettings().getEnableSmtpServer()) && mailer != null) {
      mailer.testConnection();
    } else {
      LOG.error("Mailer is not initialized or Smtp is not Enabled.");
    }
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

  public static String getChangeEventTemplate(String publisherName) {
    return String.format(CHANGE_EVENT_UPDATE, publisherName, getSmtpSettings().getEmailingEntity());
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

  public static SmtpSettings getSmtpSettings() {
    SmtpSettings emailConfig =
        SettingsCache.getSetting(SettingsType.EMAIL_CONFIGURATION, SmtpSettings.class);
    if (!emailConfig.equals(storedSmtpSettings)) {
      storedSmtpSettings = emailConfig;
      mailer = createMailer(emailConfig);
    }
    return emailConfig;
  }

  public static Boolean isValidEmail(String email) {
    if (StringUtils.isBlank(email)) {
      return false;
    }
    return email.matches("^[\\w-\\.]+@([\\w-]+\\.)+[\\w-]{2,4}$");
  }

  public static String getOMBaseURL() {
    Settings setting =
        new SystemRepository()
            .getConfigWithKey(SettingsType.OPEN_METADATA_BASE_URL_CONFIGURATION.value());
    OpenMetadataBaseUrlConfiguration urlConfiguration =
        (OpenMetadataBaseUrlConfiguration) setting.getConfigValue();
    return urlConfiguration.getOpenMetadataUrl();
  }

  static class TemplatePopulatorBuilder {
    private final Map<String, Object> templatePopulator;

    public TemplatePopulatorBuilder() {
      this.templatePopulator = new HashMap<>();
    }

    public TemplatePopulatorBuilder add(String key, Object value) {
      templatePopulator.put(key, value);
      return this;
    }

    public Map<String, Object> build() {
      return Collections.unmodifiableMap(templatePopulator);
    }
  }
}
