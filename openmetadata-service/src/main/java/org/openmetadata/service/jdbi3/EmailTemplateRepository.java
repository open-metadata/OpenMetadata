package org.openmetadata.service.jdbi3;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.IOException;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.auth.EmailTemplate;
import org.openmetadata.service.util.EmailTemplateTypeDefinition.EmailTemplateType;
import org.openmetadata.service.util.JsonUtils;

@Slf4j
public class EmailTemplateRepository {
  private static CollectionDAO dao;

  public EmailTemplateRepository(CollectionDAO dao) {
    EmailTemplateRepository.dao = dao;
  }

  public String readFileContent(String basePath, String fileName) throws IOException {
    File file = new File(basePath + fileName);
    StringBuilder fileContent = new StringBuilder();
    BufferedReader bufferedReader;
    String readLine;
    if (file.exists()) {
      bufferedReader = new BufferedReader(new FileReader(basePath + fileName));
    } else {
      file = new File("");
      String path = file.getAbsolutePath();
      String[] rootPath = path.split("openmetadata-dist/");
      bufferedReader =
          new BufferedReader(
              new FileReader(rootPath[0] + "/openmetadata-service/src/main/resources/emailTemplates/" + fileName));
    }
    while ((readLine = bufferedReader.readLine()) != null) {
      fileContent.append(readLine);
    }
    return fileContent.toString();
  }

  public void populateTemplateInDb(List<String> fileNames, String basePath) {
    for (String fileName : fileNames) {
      try {
        switch (fileName) {
          case "email-verification.ftl":
            String emailVerificationTemplate = readFileContent(basePath, fileName);
            storeEmailTemplate(
                String.valueOf(EmailTemplateType.EMAIL_VERIFICATION).toLowerCase(), emailVerificationTemplate);
            break;
          case "reset-link.ftl":
            String passwordResetTemplate = readFileContent(basePath, fileName);
            storeEmailTemplate(String.valueOf(EmailTemplateType.PASSWORD_RESET).toLowerCase(), passwordResetTemplate);
            break;
          case "account-activity-change.ftl":
            String accountStatusTemplate = readFileContent(basePath, fileName);
            storeEmailTemplate(String.valueOf(EmailTemplateType.ACCOUNT_STATUS).toLowerCase(), accountStatusTemplate);
            break;
          case "invite-randompwd.ftl":
            String inviteRandomPasswordTemplate = readFileContent(basePath, fileName);
            storeEmailTemplate(
                String.valueOf(EmailTemplateType.INVITE_RANDOM_PWD).toLowerCase(), inviteRandomPasswordTemplate);
            break;
          case "changeEvent.ftl":
            String changeEventTemplate = readFileContent(basePath, fileName);
            storeEmailTemplate(String.valueOf(EmailTemplateType.CHANGE_EVENT).toLowerCase(), changeEventTemplate);
            break;
          case "invite-createPassword.ftl":
            String inviteCreatePasswordTemplate = readFileContent(basePath, fileName);
            storeEmailTemplate(
                String.valueOf(EmailTemplateType.INVITE_CREATE_PWD).toLowerCase(), inviteCreatePasswordTemplate);
            break;
          case "taskAssignment.ftl":
            String taskNotificationTemplate = readFileContent(basePath, fileName);
            storeEmailTemplate(
                String.valueOf(EmailTemplateType.TASK_NOTIFICATION).toLowerCase(), taskNotificationTemplate);
            break;
          case "testResultStatus.ftl":
            String testNotificationTemplate = readFileContent(basePath, fileName);
            storeEmailTemplate(
                String.valueOf(EmailTemplateType.TEST_NOTIFICATION).toLowerCase(), testNotificationTemplate);
            break;
        }
      } catch (Exception exception) {
        LOG.warn(exception.getMessage());
      }
    }
  }

  public static EmailTemplate getEmailTemplate(String emailType) throws IOException {
    String json = dao.emailTemplateDAO().getTemplate(emailType);
    return JsonUtils.readValue(json, EmailTemplate.class);
  }

  public void storeEmailTemplate(String emailType, String emailContent) throws IOException {
    EmailTemplate emailTemplate = new EmailTemplate().withEmailType(emailType).withEmailContent(emailContent);
    dao.emailTemplateDAO().storeTemplate(emailType, emailContent, JsonUtils.pojoToJson(emailTemplate));
  }

  public void insertOrUpdateEmailTemplate(String emailType, String emailContent) throws IOException {
    emailContent = emailContent.replaceAll("\\\\", "");
    EmailTemplate emailTemplate = new EmailTemplate().withEmailType(emailType).withEmailContent(emailContent);
    dao.emailTemplateDAO().insertOrUpdateEmailTemplate(emailType, emailContent, JsonUtils.pojoToJson(emailTemplate));
  }
}
