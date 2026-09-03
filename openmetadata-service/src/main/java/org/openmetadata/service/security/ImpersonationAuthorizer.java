package org.openmetadata.service.security;

import static org.openmetadata.schema.type.Include.ALL;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.PolicyEvaluator;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/**
 * Authorization for {@code X-Impersonate-User}: the calling bot must hold the admin-only {@code
 * allowImpersonation} grant, and its policies must permit the {@code Impersonate} operation against
 * the target user.
 *
 * <p>{@link JwtFilter} enforces this where the principal is swapped rather than leaving it to
 * {@link Authorizer#authorize}, because endpoints that never reach an authorizer - personal access
 * token issuance and every {@code authorizeAdmin}-only route - would otherwise accept the swapped
 * principal unchecked.
 */
@Slf4j
public final class ImpersonationAuthorizer {
  private static final String BOT_FIELDS = "id,name,isBot,allowImpersonation";

  private ImpersonationAuthorizer() {}

  /**
   * Memoized per request, so the bot lookup and policy evaluation run once however many times the
   * swap is re-checked - the filter gate and every authorizer entry point share the result.
   */
  public static void authorize(String botName, User targetUser) {
    if (ImpersonationContext.isValidated(botName, targetUser.getName())) {
      return;
    }
    User bot = getImpersonatingBot(botName);
    if (!Boolean.TRUE.equals(bot.getIsBot()) || !Boolean.TRUE.equals(bot.getAllowImpersonation())) {
      LOG.warn(
          "Impersonation denied: bot={} does not have allowImpersonation enabled", bot.getName());
      throw new AuthorizationException(
          "Bot " + bot.getName() + " does not have impersonation enabled");
    }
    authorizeTarget(bot.getName(), targetUser);
    ImpersonationContext.markValidated(botName, targetUser.getName());
  }

  private static User getImpersonatingBot(String botName) {
    User bot;
    try {
      bot = Entity.getEntityByName(Entity.USER, botName, BOT_FIELDS, ALL);
    } catch (Exception e) { // deliberately broad: any failure to resolve the bot denies the swap
      LOG.error("Failed to get bot user: {}", botName, e);
      throw new AuthorizationException("Bot user not found: " + botName);
    }
    if (bot == null) {
      LOG.warn("Impersonation denied: bot user {} was not found", botName);
      throw new AuthorizationException("Bot user not found: " + botName);
    }
    return bot;
  }

  /**
   * Evaluates the bot's policies for the {@code Impersonate} operation with the target user as the
   * resource. Policies scope who can be impersonated - for example, a deny rule with the {@code
   * isAdminUser()} condition blocks impersonating admins.
   */
  private static void authorizeTarget(String botName, User targetUser) {
    SubjectContext botSubjectContext = SubjectContext.getSubjectContext(botName);
    OperationContext operationContext =
        new OperationContext(Entity.USER, MetadataOperation.IMPERSONATE);
    try {
      PolicyEvaluator.hasPermission(
          botSubjectContext, targetUserResourceContext(targetUser), operationContext);
    } catch (AuthorizationException e) {
      LOG.warn(
          "Impersonation denied: bot={} is not authorized to impersonate user={}",
          botName,
          targetUser.getName());
      throw new AuthorizationException(
          "Bot " + botName + " is not authorized to impersonate user " + targetUser.getName());
    }
  }

  @SuppressWarnings("unchecked")
  private static ResourceContextInterface targetUserResourceContext(User targetUser) {
    EntityRepository<User> userRepository =
        (EntityRepository<User>) Entity.getEntityRepository(Entity.USER);
    return new ResourceContext<>(Entity.USER, targetUser, userRepository);
  }
}
