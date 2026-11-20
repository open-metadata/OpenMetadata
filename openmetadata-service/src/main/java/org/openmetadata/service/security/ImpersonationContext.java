package org.openmetadata.service.security;

import java.util.function.Supplier;

/**
 * Thread-local record of which bot an action is attributed to, so writes can be stamped with
 * {@code impersonatedBy} in change events and audit trails.
 *
 * <p>This is attribution, not authorization. It is set by {@link JwtFilter} for an {@code
 * X-Impersonate-User} request, but also by the MCP server on every other tool call to name its own
 * bot - where no impersonation grant is involved and none was checked. A non-null value therefore
 * does not mean "this request is an authorized impersonation session", and must not be read as one.
 *
 * <p>To gate behaviour on a real impersonation session, use {@code
 * CatalogSecurityContext.impersonatedUser()}, which is request-scoped and set only after {@link
 * ImpersonationAuthorizer} has approved the swap - see {@link ImpersonationRestrictionFilter}.
 */
public class ImpersonationContext {
  private static final ThreadLocal<String> impersonatedBy = new ThreadLocal<>();

  /**
   * {@code "<bot>-><target>"} of an impersonation already checked by {@link DefaultAuthorizer}.
   * Subject resolution re-checks impersonation on every call and a single request resolves the
   * subject many times, so this keeps the bot lookup and policy evaluation to once per request.
   */
  private static final ThreadLocal<String> validatedImpersonation = new ThreadLocal<>();

  public static void setImpersonatedBy(String username) {
    impersonatedBy.set(username);
  }

  public static String getImpersonatedBy() {
    return impersonatedBy.get();
  }

  /**
   * Runs {@code task} with the bot of the thread that submits it. A task on a worker thread does not
   * see that bot, so the writes it makes would be stamped as nobody's; the bot is captured here and
   * cleared from the worker when the task ends.
   */
  public static Runnable propagate(Runnable task) {
    return runAs(getImpersonatedBy(), task);
  }

  /** {@link #propagate(Runnable)} for a task that returns a result. */
  public static <T> Supplier<T> propagateResult(Supplier<T> task) {
    String submitter = getImpersonatedBy();
    return () -> {
      setImpersonatedBy(submitter);
      try {
        return task.get();
      } finally {
        clear();
      }
    };
  }

  /** Runs {@code task} with {@code bot} as its thread's bot, and clears it when the task ends. */
  public static Runnable runAs(String bot, Runnable task) {
    return () -> {
      setImpersonatedBy(bot);
      try {
        task.run();
      } finally {
        clear();
      }
    };
  }

  public static boolean isValidated(String botName, String targetUser) {
    return validationKey(botName, targetUser).equals(validatedImpersonation.get());
  }

  public static void markValidated(String botName, String targetUser) {
    validatedImpersonation.set(validationKey(botName, targetUser));
  }

  private static String validationKey(String botName, String targetUser) {
    return botName + "->" + targetUser;
  }

  public static void clear() {
    impersonatedBy.remove();
    validatedImpersonation.remove();
  }
}
