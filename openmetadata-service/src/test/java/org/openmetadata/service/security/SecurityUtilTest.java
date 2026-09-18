package org.openmetadata.service.security;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.interfaces.Claim;
import jakarta.servlet.ServletOutputStream;
import jakarta.servlet.WriteListener;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.ws.rs.client.Invocation;
import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.configuration.LoginConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.exception.CustomExceptionMessage;
import org.openmetadata.service.exception.EntityNotFoundException;
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
    assertTrue(invalidDomainException.getMessage().contains("principal domain"));
    assertTrue(invalidDomainException.getMessage().contains("other.com"));
    assertTrue(invalidDomainException.getMessage().contains("example.com"));
  }

  @Test
  void testValidateDomainEnforcementIsCaseInsensitive() {
    Map<String, String> mapping = Map.of("username", "preferred_username", "email", "email_claim");

    assertDoesNotThrow(
        () ->
            SecurityUtil.validateDomainEnforcement(
                mapping,
                List.of("email_claim"),
                Map.of("email_claim", stringClaim("alice@BCPCorp.OnMicrosoft.com")),
                "BCPCorp.net",
                Set.of("bcpcorp.net", "bcpcorp.onmicrosoft.com"),
                true));

    assertDoesNotThrow(
        () ->
            SecurityUtil.validateDomainEnforcement(
                mapping,
                List.of("email_claim"),
                Map.of("email_claim", stringClaim("alice@BCPCorp.net")),
                "bcpcorp.net",
                Set.of(),
                true));
  }

  @Test
  void testIsOpenMetadataIssuedTokenRequiresMatchingIssuerAndKeyId() {
    Map<String, Claim> claims = Map.of(SecurityUtil.ISSUER_CLAIM, stringClaim("open-metadata.org"));

    assertTrue(
        SecurityUtil.isOpenMetadataIssuedToken(claims, "om-key", "open-metadata.org", "om-key"));

    assertFalse(
        SecurityUtil.isOpenMetadataIssuedToken(
            claims, "attacker-key", "open-metadata.org", "om-key"));

    assertFalse(
        SecurityUtil.isOpenMetadataIssuedToken(
            Map.of(SecurityUtil.ISSUER_CLAIM, stringClaim("evil.com")),
            "om-key",
            "open-metadata.org",
            "om-key"));

    assertFalse(
        SecurityUtil.isOpenMetadataIssuedToken(Map.of(), "om-key", "open-metadata.org", "om-key"));
  }

  @Test
  void testIsOpenMetadataIssuedTokenFalseWhenServerHasNoSigningIdentity() {
    Map<String, Claim> spoofed =
        Map.of(SecurityUtil.ISSUER_CLAIM, stringClaim("open-metadata.org"));

    assertFalse(SecurityUtil.isOpenMetadataIssuedToken(spoofed, "om-key", null, "om-key"));
    assertFalse(
        SecurityUtil.isOpenMetadataIssuedToken(spoofed, "om-key", "open-metadata.org", null));
    assertFalse(SecurityUtil.isOpenMetadataIssuedToken(spoofed, "om-key", "", ""));
  }

  @Test
  void testWriteJsonResponseSetsBodyHeadersAndStatus() throws IOException {
    HttpServletResponse response = mock(HttpServletResponse.class);
    RecordingServletOutputStream outputStream = new RecordingServletOutputStream();
    when(response.getOutputStream()).thenReturn(outputStream);

    SecurityUtil.writeJsonResponse(response, "{\"ok\":true}");

    verify(response).setContentType("application/json");
    verify(response).setCharacterEncoding("UTF-8");
    assertEquals("{\"ok\":true}", outputStream.content());
  }

  @Test
  void testWriteFailureResponseMapsMissingUserToUnauthorized() throws IOException {
    HttpServletResponse response = mock(HttpServletResponse.class);
    RecordingServletOutputStream outputStream = new RecordingServletOutputStream();
    when(response.getOutputStream()).thenReturn(outputStream);

    SecurityUtil.writeFailureResponse(response, new EntityNotFoundException("user not found"));

    verify(response).setStatus(HttpServletResponse.SC_UNAUTHORIZED);
    assertTrue(outputStream.content().contains("Invalid credentials"));
  }

  @Test
  void testWriteFailureResponseKeepsStatusOfRejectedCredentials() throws IOException {
    HttpServletResponse response = mock(HttpServletResponse.class);
    RecordingServletOutputStream outputStream = new RecordingServletOutputStream();
    when(response.getOutputStream()).thenReturn(outputStream);

    // What BasicAuthenticator throws for a bad password: carries a 401 Response but is not a
    // WebApplicationException, so it used to fall through to a 500.
    SecurityUtil.writeFailureResponse(
        response, new AuthenticationException("You have entered an invalid username or password."));

    verify(response).setStatus(HttpServletResponse.SC_UNAUTHORIZED);
  }

  @Test
  void testWriteFailureResponseKeepsStatusOfCustomExceptionMessage() throws IOException {
    HttpServletResponse response = mock(HttpServletResponse.class);
    RecordingServletOutputStream outputStream = new RecordingServletOutputStream();
    when(response.getOutputStream()).thenReturn(outputStream);

    // What a login for a soft-deleted user actually reaches this method as: CustomExceptionMessage
    // extends the SDK's WebServiceException, which is a plain RuntimeException — so without an
    // explicit branch its 4xx was reported as a 500.
    SecurityUtil.writeFailureResponse(
        response,
        new CustomExceptionMessage(
            Response.Status.BAD_REQUEST,
            "INVALID_USER_OR_PASSWORD",
            "You have entered an invalid username or password."));

    verify(response).setStatus(HttpServletResponse.SC_BAD_REQUEST);
    assertTrue(outputStream.content().contains("invalid username or password"));
  }

  @Test
  void testWriteFailureResponseFallsBackToServerError() throws IOException {
    HttpServletResponse response = mock(HttpServletResponse.class);
    RecordingServletOutputStream outputStream = new RecordingServletOutputStream();
    when(response.getOutputStream()).thenReturn(outputStream);

    SecurityUtil.writeFailureResponse(response, new IllegalStateException("boom"));

    verify(response).setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
    // The exception text is an internal detail: callers log it, the client gets a generic message.
    assertFalse(outputStream.content().contains("boom"));
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

  @Test
  void validateRedirectUri_allowsExactTrustedRedirect() {
    String redirect =
        SecurityUtil.validateRedirectUri(
            "https://app.example.com/auth/callback",
            Set.of("https://app.example.com/auth/callback"));

    assertEquals("https://app.example.com/auth/callback", redirect);
  }

  @Test
  void validateRedirectUri_allowsRootRelativeTrustedRedirect() {
    String redirect =
        SecurityUtil.validateRedirectUri(
            "/auth/callback", Set.of("https://app.example.com/auth/callback"));

    assertEquals("https://app.example.com/auth/callback", redirect);
  }

  @Test
  void validateRedirectUri_returnsConfiguredTrustedRedirect() {
    String redirect =
        SecurityUtil.validateRedirectUri(
            "https://app.example.com:443/auth/callback",
            Set.of("https://app.example.com/auth/callback"));

    assertEquals("https://app.example.com/auth/callback", redirect);
  }

  @Test
  void validateRedirectUri_allowsRootRelativeRedirectMatchingAnyTrustedRedirect() {
    String redirect =
        SecurityUtil.validateRedirectUri(
            "/auth/callback",
            List.of(
                "https://admin.example.com/admin/callback",
                "https://app.example.com/auth/callback"));

    assertEquals("https://app.example.com/auth/callback", redirect);
  }

  @Test
  void validateRedirectUri_rejectsDifferentPathOnTrustedOrigin() {
    IllegalArgumentException exception =
        assertThrows(
            IllegalArgumentException.class,
            () ->
                SecurityUtil.validateRedirectUri(
                    "https://app.example.com/evil",
                    Set.of("https://app.example.com/auth/callback")));

    assertEquals("Redirect URI must exactly match a trusted redirect URI", exception.getMessage());
  }

  @Test
  void buildRedirectWithToken_usesFragmentNotQueryString() {
    String redirectUrl =
        SecurityUtil.buildRedirectWithToken(
            "https://app.example.com/callback", "token-value", "user@example.com", "Jane & John");

    java.net.URI uri = java.net.URI.create(redirectUrl);
    assertNull(uri.getRawQuery(), "Token must be in fragment, not query string");

    String fragment = uri.getRawFragment();
    assertNotNull(fragment, "Fragment should contain token parameters");
    assertEquals(3, fragment.split("&").length);
    assertTrue(fragment.contains("id_token="));
    assertTrue(fragment.contains("email="));
    assertTrue(fragment.contains("name="));
    assertTrue(fragment.contains("%26"));
  }

  @Test
  void testExtractEmailFromClaim_withValidEmail() {
    Map<String, Object> claims = new HashMap<>();
    claims.put("email", "john.doe@company.com");

    String email = SecurityUtil.extractEmailFromClaim(claims, "email");

    assertEquals("john.doe@company.com", email);
  }

  @Test
  void testExtractEmailFromClaim_lowercasesEmail() {
    Map<String, Object> claims = new HashMap<>();
    claims.put("email", "John.Doe@Company.COM");

    String email = SecurityUtil.extractEmailFromClaim(claims, "email");

    assertEquals("john.doe@company.com", email);
  }

  @Test
  void testExtractEmailFromClaim_missingClaim() {
    Map<String, Object> claims = new HashMap<>();

    AuthenticationException ex =
        assertThrows(
            AuthenticationException.class,
            () -> SecurityUtil.extractEmailFromClaim(claims, "email"));

    assertTrue(ex.getMessage().contains("email claim 'email' not found"));
  }

  @Test
  void testExtractEmailFromClaim_invalidEmailFormat() {
    Map<String, Object> claims = new HashMap<>();
    claims.put("email", "not-an-email");

    AuthenticationException ex =
        assertThrows(
            AuthenticationException.class,
            () -> SecurityUtil.extractEmailFromClaim(claims, "email"));

    assertTrue(ex.getMessage().contains("invalid email format"));
  }

  @Test
  void testExtractEmailFromClaim_withEmptyString() {
    Map<String, Object> claims = new HashMap<>();
    claims.put("email", "");

    AuthenticationException ex =
        assertThrows(
            AuthenticationException.class,
            () -> SecurityUtil.extractEmailFromClaim(claims, "email"));

    assertTrue(ex.getMessage().contains("email claim 'email' not found"));
  }

  @Test
  void testExtractEmailFromClaim_withCustomClaimName() {
    Map<String, Object> claims = new HashMap<>();
    claims.put("preferred_email", "user@domain.org");

    String email = SecurityUtil.extractEmailFromClaim(claims, "preferred_email");

    assertEquals("user@domain.org", email);
  }

  @Test
  void testExtractDisplayNameFromClaim_withValidName() {
    Map<String, Object> claims = new HashMap<>();
    claims.put("name", "John Doe");

    String displayName = SecurityUtil.extractDisplayNameFromClaim(claims, "name");

    assertEquals("John Doe", displayName);
  }

  @Test
  void testExtractDisplayNameFromClaim_returnsNullWhenNoClaims() {
    Map<String, Object> claims = new HashMap<>();

    String displayName = SecurityUtil.extractDisplayNameFromClaim(claims, "name");

    assertNull(displayName);
  }

  @Test
  void testExtractDisplayNameFromClaim_emptyClaim_returnsNull() {
    Map<String, Object> claims = new HashMap<>();
    claims.put("name", "");

    String displayName = SecurityUtil.extractDisplayNameFromClaim(claims, "name");

    assertNull(displayName);
  }

  @Test
  void testIsEmailRegistrationDomainAllowed() {
    assertTrue(SecurityUtil.isEmailRegistrationDomainAllowed("a@x.com", null));
    assertTrue(SecurityUtil.isEmailRegistrationDomainAllowed("a@x.com", Set.of()));
    assertTrue(SecurityUtil.isEmailRegistrationDomainAllowed("a@x.com", Set.of("all")));
    assertTrue(SecurityUtil.isEmailRegistrationDomainAllowed("a@x.com", Set.of("X.COM")));
    assertFalse(SecurityUtil.isEmailRegistrationDomainAllowed("a@x.com", Set.of("y.com")));
    assertFalse(SecurityUtil.isEmailRegistrationDomainAllowed(null, Set.of("y.com")));
    assertFalse(SecurityUtil.isEmailRegistrationDomainAllowed("no-at-sign", Set.of("y.com")));
  }

  @Test
  void testExtractDisplayNameFromClaims_withNameClaim() {
    Map<String, Object> claims = new HashMap<>();
    claims.put("name", "John Doe");

    assertEquals("John Doe", SecurityUtil.extractDisplayNameFromClaims(claims));
  }

  @Test
  void testExtractDisplayNameFromClaims_withGivenAndFamilyName() {
    Map<String, Object> claims = new HashMap<>();
    claims.put("given_name", "John");
    claims.put("family_name", "Doe");

    assertEquals("John Doe", SecurityUtil.extractDisplayNameFromClaims(claims));
  }

  @Test
  void testValidateEmailDomain_allowedDomain() {
    List<String> allowedDomains = List.of("company.com", "subsidiary.com");

    // Should not throw
    SecurityUtil.validateEmailDomain("john@company.com", allowedDomains);
    SecurityUtil.validateEmailDomain("jane@subsidiary.com", allowedDomains);
  }

  @Test
  void testValidateEmailDomain_disallowedDomain() {
    List<String> allowedDomains = List.of("company.com");

    AuthenticationException ex =
        assertThrows(
            AuthenticationException.class,
            () -> SecurityUtil.validateEmailDomain("john@other.com", allowedDomains));

    assertTrue(ex.getMessage().contains("domain 'other.com' not in allowed list"));
  }

  @Test
  void testValidateEmailDomain_emptyAllowedList_allowsAll() {
    List<String> allowedDomains = List.of();

    // Should not throw - empty list means all domains allowed
    SecurityUtil.validateEmailDomain("john@any-domain.com", allowedDomains);
  }

  @Test
  void testValidateEmailDomain_caseInsensitive() {
    List<String> allowedDomains = List.of("Company.COM");

    // Should not throw - case insensitive comparison
    SecurityUtil.validateEmailDomain("john@company.com", allowedDomains);
  }

  @Test
  void testValidateEmailDomain_nullAllowedList_allowsAll() {
    // Should not throw - null list means all domains allowed
    assertDoesNotThrow(() -> SecurityUtil.validateEmailDomain("john@any-domain.com", null));
  }

  @Test
  void testValidateEmailDomain_nullEmail_throwsAuthenticationException() {
    List<String> allowedDomains = List.of("company.com");

    // An unusable email on the auth path is an authentication failure (401), not a server fault.
    AuthenticationException ex =
        assertThrows(
            AuthenticationException.class,
            () -> SecurityUtil.validateEmailDomain(null, allowedDomains));

    assertTrue(ex.getMessage().contains("not a valid email address"));
  }

  @Test
  void testValidateEmailDomain_emailWithoutAtSymbol_throwsAuthenticationException() {
    List<String> allowedDomains = List.of("company.com");

    AuthenticationException ex =
        assertThrows(
            AuthenticationException.class,
            () -> SecurityUtil.validateEmailDomain("invalid-email", allowedDomains));

    assertTrue(ex.getMessage().contains("not a valid email address"));
  }

  @Test
  void testValidateConfiguredEmailDomain_usesPrincipalDomainFallback() {
    assertDoesNotThrow(
        () ->
            SecurityUtil.validateConfiguredEmailDomain(
                "john@company.com", List.of(), "company.com", Collections.emptySet(), true));
  }

  @Test
  void testValidateConfiguredEmailDomain_usesAllowedDomainsFallback() {
    assertDoesNotThrow(
        () ->
            SecurityUtil.validateConfiguredEmailDomain(
                "john@company.com",
                List.of(),
                "other.com",
                Set.of("company.com", "subsidiary.com"),
                true));
  }

  @Test
  void testValidateConfiguredEmailDomain_prioritizesAllowedEmailDomains() {
    AuthenticationException ex =
        assertThrows(
            AuthenticationException.class,
            () ->
                SecurityUtil.validateConfiguredEmailDomain(
                    "john@company.com",
                    List.of("approved.com"),
                    "company.com",
                    Set.of("company.com"),
                    true));

    assertTrue(ex.getMessage().contains("domain 'company.com' not in allowed list"));
  }

  @Test
  void testResolvePrincipalDomain_usesPrincipalDomainWhenSet() {
    assertEquals(
        "principal.com",
        SecurityUtil.resolvePrincipalDomain(
            "principal.com", Set.of("email.com"), Set.of("allowed.com")));
  }

  @Test
  void testResolvePrincipalDomain_fallsBackToAllowedEmailDomains() {
    assertEquals(
        "email.com",
        SecurityUtil.resolvePrincipalDomain(null, Set.of("email.com"), Set.of("allowed.com")));
  }

  @Test
  void testResolvePrincipalDomain_fallsBackToAllowedDomains() {
    assertEquals(
        "allowed.com", SecurityUtil.resolvePrincipalDomain(null, null, Set.of("allowed.com")));
  }

  @Test
  void testResolvePrincipalDomain_returnsNullWhenNothingConfigured() {
    assertNull(SecurityUtil.resolvePrincipalDomain(null, null, null));
    assertNull(SecurityUtil.resolvePrincipalDomain("", Set.of(), Set.of()));
  }

  @Test
  void testResolvePrincipalDomain_skipsEmptyPrincipalDomain() {
    assertEquals("email.com", SecurityUtil.resolvePrincipalDomain("", Set.of("email.com"), null));
  }

  @Test
  void testFindEmailFromClaims_claimWithAtSign_returnsDirectly() {
    Map<String, Object> claims = new HashMap<>();
    claims.put("email", "john@company.com");

    String email =
        SecurityUtil.findEmailFromClaims(Map.of(), List.of("email"), claims, "other.com");

    assertEquals("john@company.com", email);
  }

  @Test
  void testFindEmailFromClaims_claimWithoutAtSign_appendsDomain() {
    Map<String, Object> claims = new HashMap<>();
    claims.put("sub", "john123");

    String email =
        SecurityUtil.findEmailFromClaims(Map.of(), List.of("sub"), claims, "company.com");

    assertEquals("john123@company.com", email);
  }

  @Test
  void testFindEmailFromClaims_claimWithoutAtSign_noDomain_throwsError() {
    Map<String, Object> claims = new HashMap<>();
    claims.put("sub", "john123");

    AuthenticationException ex =
        assertThrows(
            AuthenticationException.class,
            () -> SecurityUtil.findEmailFromClaims(Map.of(), List.of("sub"), claims, null));

    assertTrue(ex.getMessage().contains("john123"));
    assertTrue(ex.getMessage().contains("not an email address"));
    assertTrue(ex.getMessage().contains("emailClaim"));
  }

  @Test
  void testFindEmailFromClaims_claimWithoutAtSign_emptyDomain_throwsError() {
    Map<String, Object> claims = new HashMap<>();
    claims.put("sub", "john123");

    AuthenticationException ex =
        assertThrows(
            AuthenticationException.class,
            () -> SecurityUtil.findEmailFromClaims(Map.of(), List.of("sub"), claims, ""));

    assertTrue(ex.getMessage().contains("not an email address"));
  }

  @Test
  void testFindEmailFromClaims_lowercasesResult() {
    Map<String, Object> claims = new HashMap<>();
    claims.put("email", "John.Doe@Company.COM");

    String email =
        SecurityUtil.findEmailFromClaims(Map.of(), List.of("email"), claims, "other.com");

    assertEquals("john.doe@company.com", email);
  }

  @Test
  void testExtractEmailFromNonStringClaimFailsAuthenticationRatherThanCrashing() {
    // A boolean/array claim makes Claim.asString() return null; treating that as a string used to
    // throw NullPointerException, surfacing as a 500 instead of an authentication failure.
    Map<String, Claim> booleanClaim = jwtClaims(Map.of("email", true));

    AuthenticationException exception =
        assertThrows(
            AuthenticationException.class,
            () -> SecurityUtil.extractEmailFromClaim(booleanClaim, "email"));

    assertTrue(
        exception.getMessage().contains("not found"),
        "Expected a clean authentication failure but got: " + exception.getMessage());
  }

  @Test
  void testExtractEmailFromArrayClaimFailsAuthenticationRatherThanCrashing() {
    Map<String, Claim> arrayClaim = jwtClaims(Map.of("email", List.of("a@b.com")));

    assertThrows(
        AuthenticationException.class,
        () -> SecurityUtil.extractEmailFromClaim(arrayClaim, "email"));
  }

  @Test
  void testEmailNormalizationIsLocaleIndependent() {
    // Turkish maps 'I' to a dotless 'i' under the default locale, which would corrupt an address
    // that is now the identity key.
    Locale previous = Locale.getDefault();
    try {
      Locale.setDefault(new Locale("tr", "TR"));
      assertEquals(
          "istanbul@example.com",
          SecurityUtil.extractEmailFromClaim(
              jwtClaims(Map.of("email", "ISTANBUL@EXAMPLE.COM")), "email"));
    } finally {
      Locale.setDefault(previous);
    }
  }

  private static Map<String, Claim> jwtClaims(Map<String, Object> values) {
    String token = JWT.create().withPayload(values).sign(Algorithm.none());
    return JWT.decode(token).getClaims();
  }
}
