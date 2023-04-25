package org.openmetadata.service.util;

public class EmailContentProvider {
  public static final String USERNAME = "userName";
  public static final String ENTITY = "entity";
  public static final String SUPPORT_URL = "supportUrl";
  // Email Verification
  public static final String EMAIL_VERIFICATION_LINK_KEY = "userEmailTokenVerificationLink";
  // Password Reset Link
  public static final String PASSWORD_RESET_LINK_KEY = "userResetPasswordLink";
  public static final String EXPIRATION_TIME_KEY = "expirationTime";
  public static final String DEFAULT_EXPIRATION_TIME = "60";
  public static final String PASSWORD = "password";
  public static final String APPLICATION_LOGIN_LINK = "applicationLoginLink";
  // Account Change Status
  public static final String ACTION_KEY = "action";
  public static final String ACTION_STATUS_KEY = "actionStatus";
  private static final String EMAIL_VERIFICATION_SUBJECT = "%s: Verify your Email Address (Action Required)";
  private static final String PASSWORD_RESET_SUBJECT = "%s: Reset your Password";
  private static final String ACCOUNT_STATUS_SUBJECT = "%s: Change in Account Status";
  private static final String INVITE_SUBJECT = "Welcome to %s";
  private static final String CHANGE_EVENT_UPDATE = "Change Event Update from %s";
  private static final String TASK_SUBJECT = "%s : Task Assignment Notification";
  private static final String TEST_SUBJECT = "%s : Test Result Notification";

  public static String getEmailVerificationSubject() {
    return EMAIL_VERIFICATION_SUBJECT;
  }

  public static String getPasswordResetSubject() {
    return PASSWORD_RESET_SUBJECT;
  }

  public static String getAccountStatusSubject() {
    return ACCOUNT_STATUS_SUBJECT;
  }

  public static String getInviteSubject() {
    return INVITE_SUBJECT;
  }

  public static String getChangeEventUpdate() {
    return CHANGE_EVENT_UPDATE;
  }

  public static String getTaskSubject() {
    return TASK_SUBJECT;
  }

  public static String getTestSubject() {
    return TEST_SUBJECT;
  }
}
