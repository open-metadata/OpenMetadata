package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Constructor;
import java.lang.reflect.Method;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.security.auth.SamlAuthServletHandler;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
class EmailFirstIdentityIT {

  @Test
  void testEmailFirstUsersWithSameLocalPartStayUnique(TestNamespace ns) throws Exception {
    String localPart = ("user" + ns.uniqueShortId()).toLowerCase(Locale.ROOT);
    String firstEmail = localPart + "@x.test.om.org";
    String secondEmail = localPart + "@y.test.om.org";

    SamlAuthServletHandler handler = newEmailFirstSamlHandler();

    User firstUser = createEmailFirstSamlUser(handler, firstEmail, "First User");
    User secondUser = createEmailFirstSamlUser(handler, secondEmail, "Second User");

    assertNotNull(firstUser.getId());
    assertNotNull(secondUser.getId());
    assertEquals(firstEmail, firstUser.getEmail());
    assertEquals(secondEmail, secondUser.getEmail());
    assertEquals(localPart, firstUser.getName());
    assertNotEquals(firstUser.getName(), secondUser.getName());
    assertTrue(secondUser.getName().startsWith(localPart + "_"));
  }

  @Test
  void testEmailFirstUsersAreResolvedByExactEmail(TestNamespace ns) throws Exception {
    String localPart = ("user" + ns.uniqueShortId()).toLowerCase(Locale.ROOT);
    String firstEmail = localPart + "@x.test.om.org";
    String secondEmail = localPart + "@y.test.om.org";

    SamlAuthServletHandler handler = newEmailFirstSamlHandler();

    User firstUser = createEmailFirstSamlUser(handler, firstEmail, "First User");
    User secondUser = createEmailFirstSamlUser(handler, secondEmail, "Second User");
    User secondUserAgain = createEmailFirstSamlUser(handler, secondEmail, "Second User Updated");

    assertEquals(firstEmail, firstUser.getEmail());
    assertEquals(secondEmail, secondUser.getEmail());
    assertEquals(secondUser.getId(), secondUserAgain.getId());
    assertEquals(secondUser.getName(), secondUserAgain.getName());
    assertEquals(secondEmail, secondUserAgain.getEmail());
  }

  @Test
  void testDeactivatedUserCannotAuthenticateByEmail(TestNamespace ns) throws Exception {
    String localPart = ("gone" + ns.uniqueShortId()).toLowerCase(Locale.ROOT);
    String email = localPart + "@x.test.om.org";

    SamlAuthServletHandler handler = newEmailFirstSamlHandler();
    User user = createEmailFirstSamlUser(handler, email, "Gone User");

    org.openmetadata.service.Entity.getUserRepository().delete("admin", user.getId(), false, false);

    Exception exception =
        assertThrows(Exception.class, () -> createEmailFirstSamlUser(handler, email, "Gone User"));
    Throwable cause = exception.getCause() != null ? exception.getCause() : exception;
    assertTrue(
        cause.getMessage() != null && cause.getMessage().contains("deactivated"),
        "Expected deactivated-account rejection but got: " + cause);
  }

  @Test
  void testNewUserWithDeletedUsersLocalPartGetsSuffixedName(TestNamespace ns) throws Exception {
    String localPart = ("del" + ns.uniqueShortId()).toLowerCase(Locale.ROOT);
    String firstEmail = localPart + "@x.test.om.org";
    String secondEmail = localPart + "@y.test.om.org";

    SamlAuthServletHandler handler = newEmailFirstSamlHandler();
    User firstUser = createEmailFirstSamlUser(handler, firstEmail, "First");
    org.openmetadata.service.Entity.getUserRepository()
        .delete("admin", firstUser.getId(), false, false);

    User secondUser = createEmailFirstSamlUser(handler, secondEmail, "Second");

    assertNotNull(secondUser.getId());
    assertEquals(secondEmail, secondUser.getEmail());
    assertTrue(
        secondUser.getName().startsWith(localPart + "_"),
        "Expected suffixed username since the soft-deleted user still owns the base name, got: "
            + secondUser.getName());
  }

  private SamlAuthServletHandler newEmailFirstSamlHandler() throws Exception {
    AuthenticationConfiguration authConfig =
        new AuthenticationConfiguration().withEnableSelfSignup(true).withEmailClaim("email");
    AuthorizerConfiguration authorizerConfig =
        new AuthorizerConfiguration()
            .withAdminPrincipals(Set.of())
            .withAllowedDomains(new HashSet<>())
            .withAllowedEmailRegistrationDomains(Set.of("all"))
            .withPrincipalDomain("open-metadata.org")
            .withEnforcePrincipalDomain(false)
            .withEnableSecureSocketConnection(false);

    Constructor<SamlAuthServletHandler> constructor =
        SamlAuthServletHandler.class.getDeclaredConstructor(
            AuthenticationConfiguration.class, AuthorizerConfiguration.class);
    constructor.setAccessible(true);
    return constructor.newInstance(authConfig, authorizerConfig);
  }

  @SuppressWarnings("unchecked")
  private User createEmailFirstSamlUser(
      SamlAuthServletHandler handler, String email, String displayName) throws Exception {
    Method method =
        SamlAuthServletHandler.class.getDeclaredMethod(
            "getOrCreateEmailFirstSamlUser", String.class, String.class, List.class);
    method.setAccessible(true);
    return (User) method.invoke(handler, email, displayName, List.of());
  }
}
