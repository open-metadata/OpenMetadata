package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.CreateBot;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.JWTTokenExpiry;
import org.openmetadata.schema.entity.Bot;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.entity.teams.User;

/**
 * Integration tests covering the behavior exercised by OpenMetadataOperations commands, in
 * particular the regenerate-bot-tokens operation.
 *
 * <p>The ops command works directly against the database (it must, because after JWT key rotation
 * all tokens are invalid). These tests verify the same logical flow through the REST API: create
 * bots with JWT auth, generate tokens, regenerate with different expiry, and verify correctness.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class OpenMetadataOperationsIT {

  @Test
  void test_regenerateBotToken_producesNewToken(TestNamespace ns) {
    Bot bot = createBotWithJwtUser(ns, "regen");

    JWTAuthMechanism firstToken =
        SdkClients.adminClient()
            .users()
            .generateToken(bot.getBotUser().getId(), JWTTokenExpiry.Unlimited);
    assertNotNull(firstToken.getJWTToken());

    JWTAuthMechanism secondToken =
        SdkClients.adminClient()
            .users()
            .generateToken(bot.getBotUser().getId(), JWTTokenExpiry.Seven);
    assertNotNull(secondToken.getJWTToken());

    assertNotEquals(
        firstToken.getJWTToken(),
        secondToken.getJWTToken(),
        "Regenerated token with different expiry must differ from the original");
  }

  @Test
  void test_regenerateBotToken_respectsExpiry(TestNamespace ns) {
    Bot bot = createBotWithJwtUser(ns, "expiry");

    JWTAuthMechanism unlimitedToken =
        SdkClients.adminClient()
            .users()
            .generateToken(bot.getBotUser().getId(), JWTTokenExpiry.Unlimited);
    assertNotNull(unlimitedToken.getJWTToken());
    assertEquals(JWTTokenExpiry.Unlimited, unlimitedToken.getJWTTokenExpiry());

    JWTAuthMechanism sevenDayToken =
        SdkClients.adminClient()
            .users()
            .generateToken(bot.getBotUser().getId(), JWTTokenExpiry.Seven);
    assertNotNull(sevenDayToken.getJWTToken());
    assertEquals(JWTTokenExpiry.Seven, sevenDayToken.getJWTTokenExpiry());
    assertNotNull(sevenDayToken.getJWTTokenExpiresAt(), "Bounded token must have an expiry date");
  }

  @Test
  void test_regenerateMultipleBotTokens(TestNamespace ns) {
    Bot bot1 = createBotWithJwtUser(ns, "multi1");
    Bot bot2 = createBotWithJwtUser(ns, "multi2");

    JWTAuthMechanism token1 =
        SdkClients.adminClient()
            .users()
            .generateToken(bot1.getBotUser().getId(), JWTTokenExpiry.Unlimited);
    JWTAuthMechanism token2 =
        SdkClients.adminClient()
            .users()
            .generateToken(bot2.getBotUser().getId(), JWTTokenExpiry.Unlimited);

    assertNotNull(token1.getJWTToken());
    assertNotNull(token2.getJWTToken());
    assertNotEquals(token1.getJWTToken(), token2.getJWTToken());
  }

  private Bot createBotWithJwtUser(TestNamespace ns, String suffix) {
    String uniqueId = UUID.randomUUID().toString().substring(0, 8);
    String userName = ns.prefix("botuser_" + suffix + "_" + uniqueId);
    String email = "botuser" + suffix + uniqueId + "@test.com";

    AuthenticationMechanism authMechanism =
        new AuthenticationMechanism()
            .withAuthType(AuthenticationMechanism.AuthType.JWT)
            .withConfig(new JWTAuthMechanism().withJWTTokenExpiry(JWTTokenExpiry.Unlimited));

    CreateUser userRequest =
        new CreateUser()
            .withName(userName)
            .withEmail(email)
            .withIsBot(true)
            .withAuthenticationMechanism(authMechanism);

    User botUser = SdkClients.adminClient().users().create(userRequest);

    CreateBot botRequest =
        new CreateBot()
            .withName(ns.prefix("bot_" + suffix + "_" + uniqueId))
            .withDescription("Bot for regenerate-bot-tokens test")
            .withBotUser(botUser.getName());

    return SdkClients.adminClient().bots().create(botRequest);
  }
}
