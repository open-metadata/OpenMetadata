package org.openmetadata.service.util;

import java.util.HashMap;
import java.util.Map;
import org.openmetadata.schema.email.EmailTemplateConfig;
import org.openmetadata.schema.email.SmtpSettings;
import org.openmetadata.service.jdbi3.EmailTemplateRepository;

public class EmailTemplateUtil {

  public static void populateTemplateInDb(SmtpSettings emailConfig, EmailTemplateRepository emailTemplateRepository) {
    EmailTemplateConfig emailTemplateConfig = emailConfig.getEmailTemplate();
    String basePath = emailTemplateConfig.getEmailTemplateBasePath();
    Map<String, String> fileMap = new HashMap<>();
    fileMap.put(
        emailTemplateConfig.getEmailVerificationTemplate(),
        String.valueOf(EmailTemplateTypeDefinition.EmailTemplateType.EMAIL_VERIFICATION));
    fileMap.put(
        emailTemplateConfig.getPasswordResetTemplate(),
        String.valueOf(EmailTemplateTypeDefinition.EmailTemplateType.PASSWORD_RESET));
    fileMap.put(
        emailTemplateConfig.getAccountStatusTemplate(),
        String.valueOf(EmailTemplateTypeDefinition.EmailTemplateType.ACCOUNT_STATUS));
    fileMap.put(
        emailTemplateConfig.getInviteRandomPasswordTemplate(),
        String.valueOf(EmailTemplateTypeDefinition.EmailTemplateType.INVITE_RANDOM_PWD));
    fileMap.put(
        emailTemplateConfig.getChangeEventTemplate(),
        String.valueOf(EmailTemplateTypeDefinition.EmailTemplateType.CHANGE_EVENT));
    fileMap.put(
        emailTemplateConfig.getInviteCreatePasswordTemplate(),
        String.valueOf(EmailTemplateTypeDefinition.EmailTemplateType.INVITE_CREATE_PWD));
    fileMap.put(
        emailTemplateConfig.getTaskNotificationTemplate(),
        String.valueOf(EmailTemplateTypeDefinition.EmailTemplateType.TASK_NOTIFICATION));
    fileMap.put(
        emailTemplateConfig.getTestNotificationTemplate(),
        String.valueOf(EmailTemplateTypeDefinition.EmailTemplateType.TEST_NOTIFICATION));
    emailTemplateRepository.populateTemplateInDb(fileMap, basePath);
  }
}
