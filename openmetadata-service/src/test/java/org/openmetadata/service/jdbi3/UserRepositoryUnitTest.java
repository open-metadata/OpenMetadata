package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.mock;

import jakarta.json.Json;
import jakarta.json.JsonPatch;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.JWTTokenExpiry;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.utils.JsonUtils;

class UserRepositoryUnitTest {

  @Test
  void test_taskCleanupRetryDelayBacksOffExponentially() {
    assertEquals(100L, UserRepository.getTaskCleanupRetryDelayMillis(1));
    assertEquals(200L, UserRepository.getTaskCleanupRetryDelayMillis(2));
    assertEquals(400L, UserRepository.getTaskCleanupRetryDelayMillis(3));
  }

  @Test
  void test_taskCleanupRetryDelayIsCapped() {
    assertEquals(1000L, UserRepository.getTaskCleanupRetryDelayMillis(5));
    assertEquals(1000L, UserRepository.getTaskCleanupRetryDelayMillis(8));
  }

  /**
   * A PATCH cannot replace a user's authentication mechanism: {@code preparePatched} ends in
   * {@code restorePatchAttributes}, which puts the stored mechanism back before the updater runs,
   * so the token a patch carries is never stored and the stored token stays the current one.
   */
  @Test
  void test_restorePatchAttributes_keepsTheStoredAuthenticationMechanism() {
    UserRepository repository = mock(UserRepository.class, CALLS_REAL_METHODS);
    User original = bot("stored-token");
    User patched = JsonUtils.applyPatch(original, replaceMechanism("patched-token"), User.class);
    assertEquals("patched-token", jwtTokenOf(patched));

    repository.restorePatchAttributes(original, patched);

    assertEquals("stored-token", jwtTokenOf(patched));
  }

  private static User bot(String jwtToken) {
    return new User()
        .withId(UUID.randomUUID())
        .withName("bot")
        .withFullyQualifiedName("bot")
        .withEmail("bot@test.com")
        .withIsBot(true)
        .withAuthenticationMechanism(jwtMechanism(jwtToken));
  }

  private static AuthenticationMechanism jwtMechanism(String jwtToken) {
    return new AuthenticationMechanism()
        .withAuthType(AuthenticationMechanism.AuthType.JWT)
        .withConfig(
            new JWTAuthMechanism().withJWTToken(jwtToken).withJWTTokenExpiry(JWTTokenExpiry.Seven));
  }

  /** The same single operation {@code UserResourceIT} sends. */
  private static JsonPatch replaceMechanism(String jwtToken) {
    return Json.createPatchBuilder()
        .replace("/authenticationMechanism", JsonUtils.getJsonStructure(jwtMechanism(jwtToken)))
        .build();
  }

  private static String jwtTokenOf(User user) {
    return JsonUtils.convertValue(
            user.getAuthenticationMechanism().getConfig(), JWTAuthMechanism.class)
        .getJWTToken();
  }
}
