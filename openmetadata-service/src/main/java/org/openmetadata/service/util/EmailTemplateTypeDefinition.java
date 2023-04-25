package org.openmetadata.service.util;

public class EmailTemplateTypeDefinition {
  public enum EmailTemplateType {
    EMAIL_VERIFICATION,
    PASSWORD_RESET,
    ACCOUNT_STATUS,
    INVITE_RANDOM_PWD,
    CHANGE_EVENT,
    INVITE_CREATE_PWD,
    TASK_NOTIFICATION,
    TEST_NOTIFICATION
  }
}
