package org.openmetadata.service.jdbi3;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.IOException;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.auth.EmailTemplate;
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

  public void populateTemplateInDb(Map<String, String> fileMap, String basePath) {
    for (Map.Entry<String, String> fileName : fileMap.entrySet()) {
      try {
        String emailVerificationTemplate = readFileContent(basePath, fileName.getKey());
        storeEmailTemplate(fileName.getValue().toLowerCase(), emailVerificationTemplate);
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
