package org.openmetadata.it.util;

import org.openmetadata.schema.api.CreateBot;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.JWTTokenExpiry;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.config.OpenMetadataConfig;

/**
 * A client whose requests a bot makes on another user's behalf through {@code X-Impersonate-User},
 * for tests of rules that apply only to impersonated requests ({@code isImpersonated()}).
 */
public final class ImpersonatingClients {
  private static final String IMPERSONATE_HEADER = "X-Impersonate-User";

  private ImpersonatingClients() {}

  /** Creates a bot allowed to impersonate and returns its client acting as {@code targetUser}. */
  public static OpenMetadataClient actingAs(TestNamespace ns, String targetUserName) {
    OpenMetadataClient admin = SdkClients.adminClient();
    // JwtFilter names a bot after its email's local part, so the stored name must be that part.
    String botName = "impbot" + ns.shortPrefix();
    User botUser =
        admin
            .users()
            .create(
                new CreateUser()
                    .withName(botName)
                    .withEmail(botName + "@test.com")
                    .withIsBot(true)
                    .withAuthenticationMechanism(
                        new AuthenticationMechanism()
                            .withAuthType(AuthenticationMechanism.AuthType.JWT)
                            .withConfig(
                                new JWTAuthMechanism()
                                    .withJWTTokenExpiry(JWTTokenExpiry.Unlimited))));
    admin
        .bots()
        .create(
            new CreateBot()
                .withName(botName + "_bot")
                .withBotUser(botUser.getName())
                .withAllowImpersonation(true));
    String token = admin.users().generateToken(botUser.getId(), JWTTokenExpiry.Seven).getJWTToken();
    return new OpenMetadataClient(
        OpenMetadataConfig.builder()
            .serverUrl(SdkClients.baseUrl())
            .accessToken(token)
            .header(IMPERSONATE_HEADER, targetUserName)
            .readTimeout(300000)
            .writeTimeout(300000)
            .build());
  }
}
