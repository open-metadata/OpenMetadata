package org.openmetadata.service.util.email;

public class TemplateConstants {
  public static final String USERNAME = "userName";
  public static final String ENTITY = "entity";
  public static final String SUPPORT_URL = "supportUrl";

  // templates
  public static final String ACCOUNT_ACTIVITY_CHANGE_TEMPLATE = "account-activity-change";
  public static final String CHANGE_EVENT_TEMPLATE = "changeEvent";
  public static final String DATA_INSIGHT_REPORT_TEMPLATE = "dataInsightReport";
  public static final String EMAIL_VERIFICATION_TEMPLATE = "email-verification";
  public static final String INVITE_CREATE_PASSWORD_TEMPLATE = "invite-createPassword";
  public static final String INVITE_RANDOM_PASSWORD_TEMPLATE = "invite-randompwd";
  public static final String RESET_LINK_TEMPLATE = "reset-link";
  public static final String TASK_ASSIGNMENT_TEMPLATE = "taskAssignment";
  public static final String TEST_MAIL_TEMPLATE = "testMail";
  public static final String TEST_RESULT_STATUS_TEMPLATE = "testResultStatusTemplate";

  // Email Verification
  public static final String EMAIL_VERIFICATION_SUBJECT =
      "%s: Verify your Email Address (Action Required)";
  public static final String EMAIL_VERIFICATION_LINKKEY = "userEmailTokenVerificationLink";

  // Password Reset Link
  public static final String PASSWORD_RESET_SUBJECT = "%s: Reset your Password";
  public static final String PASSWORD_RESET_LINKKEY = "userResetPasswordLink";
  public static final String EXPIRATION_TIME_KEY = "expirationTime";
  public static final String DEFAULT_EXPIRATION_TIME = "60";
  public static final String PASSWORD = "password";
  public static final String APPLICATION_LOGIN_LINK = "applicationLoginLink";

  // Account Change Status
  public static final String ACCOUNT_STATUS_SUBJECT = "%s: Change in Account Status";
  public static final String ACTION_KEY = "action";
  public static final String ACTION_STATUS_KEY = "actionStatus";
  public static final String INVITE_SUBJECT = "Welcome to %s";
  public static final String CHANGE_EVENT_UPDATE = "[%s] - Change Event Update from %s";

  public static final String TASK_SUBJECT = "%s : Task Assignment Notification";

  public static final String REPORT_SUBJECT = "%s: Data Insights Weekly - %s";
  public static final String TEST_EMAIL_SUBJECT = "%s : Test Email";
  public static final String EMAIL_IGNORE_MSG =
      "Email was not sent to {} as SMTP setting is not enabled";
}
