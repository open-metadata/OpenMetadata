package org.openmetadata.service.security;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.auth0.jwt.interfaces.Claim;
import jakarta.servlet.ServletOutputStream;
import jakarta.servlet.WriteListener;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.ws.rs.client.Invocation;
import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.SecurityContext;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.configuration.LoginConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.security.auth.CatalogSecurityContext;

class SecurityUtilTest {

  @Test
  void testValidatePrincipalClaimsMapping_WithBothUsernameAndEmail() {
    // Valid mapping with both username and email
    Map<String, String> validMapping = new HashMap<>();
    validMapping.put("username", "preferred_username");
    validMapping.put("email", "email");

    assertDoesNotThrow(() -> SecurityUtil.validatePrincipalClaimsMapping(validMapping));
  }

  @Test
  void testValidatePrincipalClaimsMapping_WithEmptyMapping() {
    // Empty mapping should not throw an exception
    Map<String, String> emptyMapping = new HashMap<>();

    assertDoesNotThrow(() -> SecurityUtil.validatePrincipalClaimsMapping(emptyMapping));
  }

  @Test
  void testValidatePrincipalClaimsMapping_WithNullMapping() {
    // Null mapping should not throw an exception
    assertDoesNotThrow(() -> SecurityUtil.validatePrincipalClaimsMapping(null));
  }

  @Test
  void testValidatePrincipalClaimsMapping_MissingUsername() {
    // Missing username should throw exception
    Map<String, String> mappingWithoutUsername = new HashMap<>();
    mappingWithoutUsername.put("email", "email");

    IllegalArgumentException exception =
        assertThrows(
            IllegalArgumentException.class,
            () -> SecurityUtil.validatePrincipalClaimsMapping(mappingWithoutUsername));

    assertEquals(
        "Invalid JWT Principal Claims Mapping. Both username and email should be present",
        exception.getMessage());
  }

  @Test
  void testValidatePrincipalClaimsMapping_MissingEmail() {
    // Missing email should throw exception
    Map<String, String> mappingWithoutEmail = new HashMap<>();
    mappingWithoutEmail.put("username", "preferred_username");

    IllegalArgumentException exception =
        assertThrows(
            IllegalArgumentException.class,
            () -> SecurityUtil.validatePrincipalClaimsMapping(mappingWithoutEmail));

    assertEquals(
        "Invalid JWT Principal Claims Mapping. Both username and email should be present",
        exception.getMessage());
  }

  @Test
  void testValidatePrincipalClaimsMapping_WithInvalidKey() {
    // Mapping with an invalid key (other than username and email) should throw exception
    Map<String, String> mappingWithInvalidKey = new HashMap<>();
    mappingWithInvalidKey.put("username", "preferred_username");
    mappingWithInvalidKey.put("email", "email");
    mappingWithInvalidKey.put("name", "full_name"); // Invalid key

    IllegalArgumentException exception =
        assertThrows(
            IllegalArgumentException.class,
            () -> SecurityUtil.validatePrincipalClaimsMapping(mappingWithInvalidKey));

    assertEquals(
        "Invalid JWT Principal Claims Mapping. Only username and email keys are allowed, but found: name",
        exception.getMessage());
  }

  @Test
  void testValidatePrincipalClaimsMapping_WithOnlyInvalidKey() {
    // Mapping with only an invalid key should throw exception about missing username and email
    Map<String, String> mappingWithOnlyInvalidKey = new HashMap<>();
    mappingWithOnlyInvalidKey.put("firstName", "given_name");

    IllegalArgumentException exception =
        assertThrows(
            IllegalArgumentException.class,
            () -> SecurityUtil.validatePrincipalClaimsMapping(mappingWithOnlyInvalidKey));

    // Should fail on missing username/email first before checking for invalid keys
    assertEquals(
        "Invalid JWT Principal Claims Mapping. Both username and email should be present",
        exception.getMessage());
  }

  @Test
  void testGetClaimAsList_WithListValue() {
    List<String> inputList = Arrays.asList("Engineering", "DevOps", "Platform");
    List<String> result = SecurityUtil.getClaimAsList(inputList);

    assertEquals(3, result.size());
    assertTrue(result.contains("Engineering"));
    assertTrue(result.contains("DevOps"));
    assertTrue(result.contains("Platform"));
  }

  @Test
  void testGetClaimAsList_WithSingleString() {
    String singleValue = "Engineering";
    List<String> result = SecurityUtil.getClaimAsList(singleValue);

    assertEquals(1, result.size());
    assertEquals("Engineering", result.get(0));
  }

  @Test
  void testGetClaimAsList_WithNullValue() {
    List<String> result = SecurityUtil.getClaimAsList(null);

    assertTrue(result.isEmpty());
  }

  @Test
  void testFindTeamsFromClaims_WithArrayClaim() {
    Map<String, Object> claims = new HashMap<>();
    claims.put("groups", Arrays.asList("Engineering", "DevOps"));

    List<String> teams = SecurityUtil.findTeamsFromClaims("groups", claims);

    assertEquals(2, teams.size());
    assertTrue(teams.contains("Engineering"));
    assertTrue(teams.contains("DevOps"));
  }

  @Test
  void testFindTeamsFromClaims_WithMissingClaim() {
    Map<String, Object> claims = new HashMap<>();
    claims.put("other", "value");

    List<String> teams = SecurityUtil.findTeamsFromClaims("groups", claims);

    assertTrue(teams.isEmpty());
  }

  @Test
  void testGetUserNameAndImpersonatedByUser() {
    CatalogSecurityContext impersonatedContext =
        new CatalogSecurityContext(
            () -> "alice@example.com", "https", "openid", Set.of(), false, "admin");

    assertEquals("alice", SecurityUtil.getUserName(impersonatedContext));
    assertEquals("alice", SecurityUtil.getImpersonatedByUser(impersonatedContext));

    CatalogSecurityContext directContext =
        new CatalogSecurityContext(
            () -> "service-account/openmetadata", "https", "openid", Set.of());

    assertEquals("service-account", SecurityUtil.getUserName(directContext));
    assertNull(SecurityUtil.getImpersonatedByUser(directContext));

    SecurityContext anonymous = mock(SecurityContext.class);
    when(anonymous.getUserPrincipal()).thenReturn(null);

    assertNull(SecurityUtil.getUserName(anonymous));
    assertNull(SecurityUtil.getImpersonatedByUser(anonymous));
  }

  @Test
  void testGetLoginConfigurationUsesSettingsCache() {
    LoginConfiguration loginConfiguration = new LoginConfiguration();

    try (MockedStatic<SettingsCache> settingsCache = mockStatic(SettingsCache.class)) {
      settingsCache
          .when(
              () ->
                  SettingsCache.getSetting(
                      org.openmetadata.schema.settings.SettingsType.LOGIN_CONFIGURATION,
                      LoginConfiguration.class))
          .thenReturn(loginConfiguration);

      assertSame(loginConfiguration, SecurityUtil.getLoginConfiguration());
    }
  }

  @Test
  void testAuthHeaderHelpersAndPrincipalExtraction() {
    Map<String, String> headers = SecurityUtil.authHeaders("alice@example.com");

    assertEquals(
        "alice@example.com",
        headers.get(CatalogOpenIdAuthorizationRequestFilter.X_AUTH_PARAMS_EMAIL_HEADER));
    assertTrue(SecurityUtil.authHeaders(null).isEmpty());

    assertEquals("alice", SecurityUtil.getPrincipalName(headers));
    assertNull(SecurityUtil.getPrincipalName(Map.of()));
    assertNull(SecurityUtil.getPrincipalName(null));

    assertEquals(
        "alice@example.com",
        SecurityUtil.authHeadersMM("alice@example.com")
            .getFirst(CatalogOpenIdAuthorizationRequestFilter.X_AUTH_PARAMS_EMAIL_HEADER));
  }

  @Test
  void testGetDomainUsesConfiguredOrDefaultPrincipalDomain() {
    OpenMetadataApplicationConfig config = new OpenMetadataApplicationConfig();
    AuthorizerConfiguration authorizerConfiguration = new AuthorizerConfiguration();
    config.setAuthorizerConfiguration(authorizerConfiguration);

    assertEquals(SecurityUtil.DEFAULT_PRINCIPAL_DOMAIN, SecurityUtil.getDomain(config));

    authorizerConfiguration.setPrincipalDomain("acme.io");

    assertEquals("acme.io", SecurityUtil.getDomain(config));
  }

  @Test
  void testAddHeadersBuildsRequestWithAndWithoutPrincipalHeader() {
    WebTarget target = mock(WebTarget.class);
    Invocation.Builder requestBuilder = mock(Invocation.Builder.class);
    Invocation.Builder headerBuilder = mock(Invocation.Builder.class);
    when(target.request()).thenReturn(requestBuilder);
    when(requestBuilder.header(
            CatalogOpenIdAuthorizationRequestFilter.X_AUTH_PARAMS_EMAIL_HEADER,
            "alice@example.com"))
        .thenReturn(headerBuilder);

    assertSame(
        headerBuilder,
        SecurityUtil.addHeaders(
            target,
            Map.of(
                CatalogOpenIdAuthorizationRequestFilter.X_AUTH_PARAMS_EMAIL_HEADER,
                "alice@example.com")));
    assertSame(requestBuilder, SecurityUtil.addHeaders(target, null));
  }

  @Test
  void testFindUserNameFromClaimsUsesMappingAndBotFallback() {
    Map<String, String> mapping = Map.of("username", "preferred_username", "email", "email_claim");
    List<String> order = List.of("preferred_username", "email_claim");
    Map<String, Object> mappedClaims = Map.of("preferred_username", "Alice@Example.com");

    assertEquals("alice", SecurityUtil.findUserNameFromClaims(mapping, order, mappedClaims));

    Map<String, Object> botClaims = new HashMap<>();
    botClaims.put("isBot", booleanClaim(true));
    botClaims.put("preferred_username", "BotUser");

    assertEquals("botuser", SecurityUtil.findUserNameFromClaims(mapping, order, botClaims));
  }

  @Test
  void testFindUserNameFromClaimsRejectsMissingMappedUsername() {
    Map<String, String> mapping = Map.of("username", "preferred_username", "email", "email_claim");

    AuthenticationException exception =
        assertThrows(
            AuthenticationException.class,
            () ->
                SecurityUtil.findUserNameFromClaims(
                    mapping, List.of("preferred_username"), Map.of()));

    assertTrue(exception.getMessage().contains("'username' claim is not present"));
  }

  @Test
  void testFindEmailFromClaimsUsesMappingAndDefaultDomainFallback() {
    Map<String, String> mapping = Map.of("username", "preferred_username", "email", "email_claim");

    assertEquals(
        "alice@example.com",
        SecurityUtil.findEmailFromClaims(
            mapping,
            List.of("preferred_username"),
            Map.of("email_claim", stringClaim("Alice@Example.com")),
            "ignored.example"));

    assertEquals(
        "service-account@openmetadata.org",
        SecurityUtil.findEmailFromClaims(
            Map.of(),
            List.of("preferred_username"),
            Map.of("preferred_username", "Service-Account"),
            "openmetadata.org"));
  }

  @Test
  void testFindEmailFromClaimsRejectsInvalidMappedEmail() {
    Map<String, String> mapping = Map.of("username", "preferred_username", "email", "email_claim");

    AuthenticationException exception =
        assertThrows(
            AuthenticationException.class,
            () ->
                SecurityUtil.findEmailFromClaims(
                    mapping,
                    List.of("preferred_username"),
                    Map.of("email_claim", stringClaim("alice")),
                    "openmetadata.org"));

    assertTrue(exception.getMessage().contains("'email' claim is not present or invalid"));
  }

  @Test
  void testClaimHelpersHandleClaimsStringsArraysAndMissingValues() {
    Claim teamClaim = mock(Claim.class);
    when(teamClaim.asList(String.class)).thenReturn(List.of("Engineering", "Platform"));

    Claim fallbackClaim = mock(Claim.class);
    when(fallbackClaim.asList(String.class)).thenReturn(List.of());
    when(fallbackClaim.asString()).thenReturn("Data");

    assertEquals("value", SecurityUtil.getClaimOrObject("value"));
    assertEquals("claimed", SecurityUtil.getClaimOrObject(stringClaim("claimed")));
    assertEquals("", SecurityUtil.getClaimOrObject(42));

    assertEquals(List.of("Engineering", "Platform"), SecurityUtil.getClaimAsList(teamClaim));
    assertEquals(List.of("Data"), SecurityUtil.getClaimAsList(fallbackClaim));
    assertEquals(
        List.of("ops", "analytics"),
        SecurityUtil.getClaimAsList(new Object[] {"ops", "analytics"}));

    assertEquals(
        List.of("Engineering", "Platform"),
        SecurityUtil.findTeamsFromClaims("groups", Map.of("groups", teamClaim)));
    assertTrue(SecurityUtil.findTeamsFromClaims(null, Map.of("groups", teamClaim)).isEmpty());
  }

  @Test
  void testGetFirstMatchJwtClaimReturnsFirstConfiguredClaimOrThrows() {
    assertEquals(
        "first@example.com",
        SecurityUtil.getFirstMatchJwtClaim(
            List.of("email", "preferred_username"),
            Map.of(
                "email", stringClaim("first@example.com"),
                "preferred_username", stringClaim("second"))));

    AuthenticationException exception =
        assertThrows(
            AuthenticationException.class,
            () -> SecurityUtil.getFirstMatchJwtClaim(List.of("email"), Map.of("sub", "1234")));

    assertTrue(exception.getMessage().contains("none of the following claims are present"));
  }

  @Test
  void testValidateDomainEnforcementCoversPrincipalDomainAllowedDomainsAndBotBypass() {
    Map<String, String> mapping = Map.of("username", "preferred_username", "email", "email_claim");

    assertDoesNotThrow(
        () ->
            SecurityUtil.validateDomainEnforcement(
                mapping,
                List.of("email_claim"),
                Map.of("email_claim", stringClaim("alice@example.com")),
                "example.com",
                Set.of(),
                true));

    assertDoesNotThrow(
        () ->
            SecurityUtil.validateDomainEnforcement(
                Map.of(),
                List.of("email"),
                Map.of("email", stringClaim("alice@allowed.com")),
                "example.com",
                Set.of("allowed.com"),
                true));

    assertDoesNotThrow(
        () ->
            SecurityUtil.validateDomainEnforcement(
                mapping,
                List.of("email_claim"),
                Map.of("isBot", booleanClaim(true), "email_claim", stringClaim("bot@other.com")),
                "example.com",
                Set.of(),
                true));
  }

  @Test
  void testValidateDomainEnforcementRejectsInvalidClaimsAndDomains() {
    Map<String, String> mapping = Map.of("username", "preferred_username", "email", "email_claim");

    AuthenticationException missingEmailException =
        assertThrows(
            AuthenticationException.class,
            () ->
                SecurityUtil.validateDomainEnforcement(
                    mapping, List.of("email_claim"), Map.of(), "example.com", Set.of(), true));
    assertTrue(missingEmailException.getMessage().contains("'email' claim is not present"));

    AuthenticationException invalidDomainException =
        assertThrows(
            AuthenticationException.class,
            () ->
                SecurityUtil.validateDomainEnforcement(
                    mapping,
                    List.of("email_claim"),
                    Map.of("email_claim", stringClaim("alice@other.com")),
                    "example.com",
                    Set.of(),
                    true));
    assertTrue(invalidDomainException.getMessage().contains("principal domain example.com"));
  }

  @Test
  void testWriteJsonResponseSetsBodyHeadersAndStatus() throws IOException {
    HttpServletResponse response = mock(HttpServletResponse.class);
    RecordingServletOutputStream outputStream = new RecordingServletOutputStream();
    when(response.getOutputStream()).thenReturn(outputStream);

    SecurityUtil.writeJsonResponse(response, "{\"ok\":true}");

    verify(response).setContentType("application/json");
    verify(response).setCharacterEncoding("UTF-8");
    verify(response).setStatus(HttpServletResponse.SC_OK);
    assertEquals("{\"ok\":true}", outputStream.content());
  }

  @Test
  void testIsBotHelpersReadBooleanClaimValues() {
    assertTrue(SecurityUtil.isBot(Map.of("isBot", booleanClaim(true))));
    assertFalse(SecurityUtil.isBot(Map.of("isBot", booleanClaim(false))));
    assertTrue(SecurityUtil.isBotW(Map.of("isBot", booleanClaim(true))));
    assertFalse(SecurityUtil.isBotW(Map.of("isBot", booleanClaim(false))));
  }

  @Test
  void testExtractDisplayNameFromClaims_WithNullClaims() {
    // Null claims should return null
    String displayName = SecurityUtil.extractDisplayNameFromClaims(null);

    assertNull(displayName);
  }

  @Test
  void testExtractDisplayNameFromClaims_WithEmptyClaims() {
    // Empty claims map should return null
    Map<String, Object> claims = new HashMap<>();

    String displayName = SecurityUtil.extractDisplayNameFromClaims(claims);

    assertNull(displayName);
  }

  @Test
  void testExtractDisplayNameFromClaims_WithDirectNameClaim() {
    // Direct 'name' claim should be returned with priority
    Map<String, Object> claims = new HashMap<>();
    claims.put("name", "John Doe");

    String displayName = SecurityUtil.extractDisplayNameFromClaims(claims);

    assertEquals("John Doe", displayName);
  }

  @Test
  void testExtractDisplayNameFromClaims_WithCamelCaseDisplayNameClaim() {
    Map<String, Object> claims = new HashMap<>();
    claims.put("displayName", "Jane Doe");

    String displayName = SecurityUtil.extractDisplayNameFromClaims(claims);

    assertEquals("Jane Doe", displayName);
  }

  @Test
  void testExtractDisplayNameFromClaims_WithNameClaimAndGivenFamilyNames() {
    // Direct 'name' claim should be prioritized over given_name + family_name
    Map<String, Object> claims = new HashMap<>();
    claims.put("name", "John Doe");
    claims.put("given_name", "Jane");
    claims.put("family_name", "Smith");

    String displayName = SecurityUtil.extractDisplayNameFromClaims(claims);

    assertEquals("John Doe", displayName);
  }

  @Test
  void testExtractDisplayNameFromClaims_WithBothGivenAndFamilyNames() {
    // Should combine given_name and family_name when name claim is absent
    Map<String, Object> claims = new HashMap<>();
    claims.put("given_name", "Jane");
    claims.put("family_name", "Smith");

    String displayName = SecurityUtil.extractDisplayNameFromClaims(claims);

    assertEquals("Jane Smith", displayName);
  }

  @Test
  void testExtractDisplayNameFromClaims_WithOnlyGivenName() {
    // Should return only given_name when family_name is absent
    Map<String, Object> claims = new HashMap<>();
    claims.put("given_name", "Jane");

    String displayName = SecurityUtil.extractDisplayNameFromClaims(claims);

    assertEquals("Jane", displayName);
  }

  @Test
  void testExtractDisplayNameFromClaims_WithOnlyFamilyName() {
    // Should return only family_name when given_name is absent
    Map<String, Object> claims = new HashMap<>();
    claims.put("family_name", "Smith");

    String displayName = SecurityUtil.extractDisplayNameFromClaims(claims);

    assertEquals("Smith", displayName);
  }

  @Test
  void testExtractDisplayNameFromClaims_WithWhitespace() {
    // Should trim whitespace from all claims
    Map<String, Object> claims = new HashMap<>();
    claims.put("given_name", "  Jane  ");
    claims.put("family_name", "  Smith  ");

    String displayName = SecurityUtil.extractDisplayNameFromClaims(claims);

    assertEquals("Jane Smith", displayName);
  }

  @Test
  void testExtractDisplayNameFromClaims_WithWhitespaceInNameClaim() {
    // Should trim whitespace from direct name claim
    Map<String, Object> claims = new HashMap<>();
    claims.put("name", "  John Doe  ");

    String displayName = SecurityUtil.extractDisplayNameFromClaims(claims);

    assertEquals("John Doe", displayName);
  }

  @Test
  void testExtractDisplayNameFromClaims_WithEmptyStrings() {
    // Empty strings should be treated as no value
    Map<String, Object> claims = new HashMap<>();
    claims.put("given_name", "");
    claims.put("family_name", "");

    String displayName = SecurityUtil.extractDisplayNameFromClaims(claims);

    assertNull(displayName);
  }

  @Test
  void testExtractDisplayNameFromClaims_WithNoSuitableClaims() {
    // Claims without name, given_name, or family_name should return null
    Map<String, Object> claims = new HashMap<>();
    claims.put("email", "john.doe@example.com");
    claims.put("sub", "123456");

    String displayName = SecurityUtil.extractDisplayNameFromClaims(claims);

    assertNull(displayName);
  }

  @Test
  void testExtractDisplayNameFromClaims_UsesLegacyGivenAndFamilyNameFallbacks() {
    Map<String, Object> claims = new HashMap<>();
    claims.put("firstname", "Jane");
    claims.put("lastname", "Smith");

    String displayName = SecurityUtil.extractDisplayNameFromClaims(claims);

    assertEquals("Jane Smith", displayName);
  }

  private static Claim stringClaim(String value) {
    Claim claim = mock(Claim.class);
    when(claim.asString()).thenReturn(value);
    return claim;
  }

  private static Claim booleanClaim(boolean value) {
    Claim claim = mock(Claim.class);
    when(claim.asBoolean()).thenReturn(value);
    return claim;
  }

  private static class RecordingServletOutputStream extends ServletOutputStream {
    private final ByteArrayOutputStream delegate = new ByteArrayOutputStream();

    @Override
    public void write(int b) {
      delegate.write(b);
    }

    @Override
    public boolean isReady() {
      return true;
    }

    @Override
    public void setWriteListener(WriteListener writeListener) {
      // no-op for tests
    }

    private String content() {
      return delegate.toString(StandardCharsets.UTF_8);
    }
  }
}
