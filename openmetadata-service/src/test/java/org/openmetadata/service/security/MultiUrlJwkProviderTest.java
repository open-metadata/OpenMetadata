package org.openmetadata.service.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockConstruction;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import com.auth0.jwk.Jwk;
import com.auth0.jwk.SigningKeyNotFoundException;
import com.auth0.jwk.UrlJwkProvider;
import java.lang.reflect.Field;
import java.math.BigInteger;
import java.net.URL;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyPairGenerator;
import java.security.interfaces.RSAPublicKey;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.MockedConstruction;
import org.mockito.MockedStatic;
import org.openmetadata.service.security.jwt.JWKSKey;
import org.openmetadata.service.security.jwt.JWKSResponse;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;

class MultiUrlJwkProviderTest {

  private static final String LOCAL_KID = "local-key-id";
  private static final String EXTERNAL_KID = "external-key-id";
  private static final String UNKNOWN_KID = "unknown-key-id";

  @BeforeEach
  void setUp() {
    // Reset JWTTokenGenerator singleton before each test
    try {
      Field instance = JWTTokenGenerator.class.getDeclaredField("INSTANCE");
      instance.setAccessible(true);
      instance.set(null, null);
    } catch (Exception e) {
      // Ignore if field doesn't exist
    }
  }

  @Test
  void testLocalJwkProviderReturnsKeyForMatchingKid() {
    // Setup mock JWTTokenGenerator
    JWKSKey jwksKey = mock(JWKSKey.class);
    when(jwksKey.getKid()).thenReturn(LOCAL_KID);
    when(jwksKey.getKty()).thenReturn("RSA");
    when(jwksKey.getN()).thenReturn("test-n");
    when(jwksKey.getE()).thenReturn("AQAB");

    JWKSResponse jwksResponse = mock(JWKSResponse.class);
    when(jwksResponse.getJwsKeys()).thenReturn(List.of(jwksKey));

    try (MockedStatic<JWTTokenGenerator> mockedStatic = mockStatic(JWTTokenGenerator.class)) {
      JWTTokenGenerator mockGenerator = mock(JWTTokenGenerator.class);
      when(mockGenerator.getJWKSResponse()).thenReturn(jwksResponse);
      mockedStatic.when(JWTTokenGenerator::getInstance).thenReturn(mockGenerator);

      // Create provider with empty URLs to test local provider
      MultiUrlJwkProvider provider = new MultiUrlJwkProvider(List.of());

      // Test: Should return key when kid matches
      Jwk result = provider.get(LOCAL_KID);
      assertNotNull(result);
      assertEquals(LOCAL_KID, result.getId());
    }
  }

  @Test
  void testLocalJwkProviderThrowsExceptionForNonMatchingKid() {
    JWKSKey jwksKey = mock(JWKSKey.class);
    when(jwksKey.getKid()).thenReturn(LOCAL_KID);
    when(jwksKey.getKty()).thenReturn("RSA");
    when(jwksKey.getN()).thenReturn("test-n");
    when(jwksKey.getE()).thenReturn("AQAB");

    JWKSResponse jwksResponse = mock(JWKSResponse.class);
    when(jwksResponse.getJwsKeys()).thenReturn(List.of(jwksKey));

    try (MockedStatic<JWTTokenGenerator> mockedStatic = mockStatic(JWTTokenGenerator.class)) {
      JWTTokenGenerator mockGenerator = mock(JWTTokenGenerator.class);
      when(mockGenerator.getJWKSResponse()).thenReturn(jwksResponse);
      mockedStatic.when(JWTTokenGenerator::getInstance).thenReturn(mockGenerator);
      MultiUrlJwkProvider provider = new MultiUrlJwkProvider(List.of());
      // An unknown key id is an authentication failure (401), not a 500, and it
      // must chain the underlying cause so server logs keep the real reason.
      AuthenticationException ex =
          assertThrows(AuthenticationException.class, () -> provider.get(UNKNOWN_KID));
      assertInstanceOf(SigningKeyNotFoundException.class, ex.getCause());
    }
  }

  @Test
  void testFallbackToExternalProviderWhenLocalFails() throws Exception {
    JWKSKey jwksKey = mock(JWKSKey.class);
    when(jwksKey.getKid()).thenReturn(LOCAL_KID);
    when(jwksKey.getKty()).thenReturn("RSA");
    when(jwksKey.getN()).thenReturn("test-n");
    when(jwksKey.getE()).thenReturn("AQAB");

    JWKSResponse jwksResponse = mock(JWKSResponse.class);
    when(jwksResponse.getJwsKeys()).thenReturn(List.of(jwksKey));
    Jwk externalJwk = mock(Jwk.class);
    when(externalJwk.getId()).thenReturn(EXTERNAL_KID);

    try (MockedStatic<JWTTokenGenerator> mockedStatic = mockStatic(JWTTokenGenerator.class);
        MockedConstruction<UrlJwkProvider> mockedConstruction =
            mockConstruction(
                UrlJwkProvider.class,
                (mock, context) -> {
                  when(mock.get(EXTERNAL_KID)).thenReturn(externalJwk);
                  when(mock.get(UNKNOWN_KID))
                      .thenThrow(new SigningKeyNotFoundException("Not found", null));
                })) {

      JWTTokenGenerator mockGenerator = mock(JWTTokenGenerator.class);
      when(mockGenerator.getJWKSResponse()).thenReturn(jwksResponse);
      mockedStatic.when(JWTTokenGenerator::getInstance).thenReturn(mockGenerator);

      MultiUrlJwkProvider provider =
          new MultiUrlJwkProvider(List.of(new URL("https://external.example.com/jwks")));

      Jwk localResult = provider.get(LOCAL_KID);
      assertNotNull(localResult);
      assertEquals(LOCAL_KID, localResult.getId());
      Jwk externalResult = provider.get(EXTERNAL_KID);
      assertNotNull(externalResult);
      assertEquals(EXTERNAL_KID, externalResult.getId());
      assertThrows(AuthenticationException.class, () -> provider.get(UNKNOWN_KID));
    }
  }

  @Test
  void testMultipleExternalProvidersAreTriedInOrder() throws Exception {
    JWKSKey jwksKey = mock(JWKSKey.class);
    when(jwksKey.getKid()).thenReturn(LOCAL_KID);
    when(jwksKey.getKty()).thenReturn("RSA");
    when(jwksKey.getN()).thenReturn("test-n");
    when(jwksKey.getE()).thenReturn("AQAB");

    JWKSResponse jwksResponse = mock(JWKSResponse.class);
    when(jwksResponse.getJwsKeys()).thenReturn(List.of(jwksKey));

    Jwk externalJwk1 = mock(Jwk.class);
    when(externalJwk1.getId()).thenReturn("external-1");

    Jwk externalJwk2 = mock(Jwk.class);
    when(externalJwk2.getId()).thenReturn("external-2");

    try (MockedStatic<JWTTokenGenerator> mockedStatic = mockStatic(JWTTokenGenerator.class);
        MockedConstruction<UrlJwkProvider> mockedConstruction =
            mockConstruction(
                UrlJwkProvider.class,
                (mock, context) -> {
                  URL url = (URL) context.arguments().get(0);
                  if (url.toString().contains("provider1")) {
                    when(mock.get("external-1")).thenReturn(externalJwk1);
                    when(mock.get("external-2"))
                        .thenThrow(new SigningKeyNotFoundException("Not in provider1", null));
                  } else if (url.toString().contains("provider2")) {
                    when(mock.get("external-1"))
                        .thenThrow(new SigningKeyNotFoundException("Not in provider2", null));
                    when(mock.get("external-2")).thenReturn(externalJwk2);
                  }
                })) {

      JWTTokenGenerator mockGenerator = mock(JWTTokenGenerator.class);
      when(mockGenerator.getJWKSResponse()).thenReturn(jwksResponse);
      mockedStatic.when(JWTTokenGenerator::getInstance).thenReturn(mockGenerator);

      MultiUrlJwkProvider provider =
          new MultiUrlJwkProvider(
              Arrays.asList(
                  new URL("https://provider1.example.com/jwks"),
                  new URL("https://provider2.example.com/jwks")));

      Jwk result1 = provider.get("external-1");
      assertEquals("external-1", result1.getId());

      Jwk result2 = provider.get("external-2");
      assertEquals("external-2", result2.getId());
    }
  }

  @Test
  void testCachingBehavior() {
    JWKSKey jwksKey = mock(JWKSKey.class);
    when(jwksKey.getKid()).thenReturn(LOCAL_KID);
    when(jwksKey.getKty()).thenReturn("RSA");
    when(jwksKey.getN()).thenReturn("test-n");
    when(jwksKey.getE()).thenReturn("AQAB");

    JWKSResponse jwksResponse = mock(JWKSResponse.class);
    when(jwksResponse.getJwsKeys()).thenReturn(List.of(jwksKey));

    try (MockedStatic<JWTTokenGenerator> mockedStatic = mockStatic(JWTTokenGenerator.class)) {
      JWTTokenGenerator mockGenerator = mock(JWTTokenGenerator.class);
      when(mockGenerator.getJWKSResponse()).thenReturn(jwksResponse);
      mockedStatic.when(JWTTokenGenerator::getInstance).thenReturn(mockGenerator);

      MultiUrlJwkProvider provider = new MultiUrlJwkProvider(List.of());
      Jwk result1 = provider.get(LOCAL_KID);
      assertNotNull(result1);
      Jwk result2 = provider.get(LOCAL_KID);
      assertNotNull(result2);
      assertEquals(result1.getId(), result2.getId());
    }
  }

  @Test
  void testExternalProviderUsedWhenLocalDoesNotHaveKey() throws Exception {
    // This test specifically verifies that when LocalJwkProvider doesn't have the requested kid,
    // the system correctly falls back to external providers without throwing an exception

    // Setup local provider with a specific kid
    JWKSKey jwksKey = mock(JWKSKey.class);
    when(jwksKey.getKid()).thenReturn(LOCAL_KID);
    when(jwksKey.getKty()).thenReturn("RSA");
    when(jwksKey.getN()).thenReturn("test-n");
    when(jwksKey.getE()).thenReturn("AQAB");

    JWKSResponse jwksResponse = mock(JWKSResponse.class);
    when(jwksResponse.getJwsKeys()).thenReturn(List.of(jwksKey));

    // Create external Jwk with a different kid that local provider doesn't have
    Jwk externalJwk = mock(Jwk.class);
    when(externalJwk.getId()).thenReturn(EXTERNAL_KID);

    try (MockedStatic<JWTTokenGenerator> mockedStatic = mockStatic(JWTTokenGenerator.class);
        MockedConstruction<UrlJwkProvider> mockedConstruction =
            mockConstruction(
                UrlJwkProvider.class,
                (mock, context) -> {
                  when(mock.get(EXTERNAL_KID)).thenReturn(externalJwk);
                  when(mock.get(LOCAL_KID))
                      .thenThrow(new SigningKeyNotFoundException("Not found in external", null));
                })) {

      JWTTokenGenerator mockGenerator = mock(JWTTokenGenerator.class);
      when(mockGenerator.getJWKSResponse()).thenReturn(jwksResponse);
      mockedStatic.when(JWTTokenGenerator::getInstance).thenReturn(mockGenerator);

      MultiUrlJwkProvider provider =
          new MultiUrlJwkProvider(List.of(new URL("https://external.example.com/jwks")));

      // Test: When requesting EXTERNAL_KID (which local doesn't have),
      // it should successfully return from external provider
      Jwk result = provider.get(EXTERNAL_KID);
      assertNotNull(result);
      assertEquals(EXTERNAL_KID, result.getId());
    }
  }

  /**
   * A deployment configured only through the environment never had the provider's key set written
   * into publicKeyUrls, yet its users now present the provider's ID tokens.
   */
  @Test
  void providerKeySetIsTriedWhenNoConfiguredUrlHasTheKey(@TempDir Path directory) throws Exception {
    KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
    generator.initialize(2048);
    RSAPublicKey providerKey = (RSAPublicKey) generator.generateKeyPair().getPublic();
    Path keySet =
        Files.writeString(directory.resolve("jwks.json"), keySetJson("provider-key", providerKey));
    URL keySetUrl = keySet.toUri().toURL();

    try (MockedStatic<JWTTokenGenerator> mockedStatic = mockStatic(JWTTokenGenerator.class)) {
      mockLocalSigningKey(mockedStatic);
      MultiUrlJwkProvider provider = new MultiUrlJwkProvider(List.of(), () -> List.of(keySetUrl));

      RSAPublicKey resolved = (RSAPublicKey) provider.get("provider-key").getPublicKey();
      assertEquals(providerKey.getModulus(), resolved.getModulus());
    }
  }

  private static void mockLocalSigningKey(MockedStatic<JWTTokenGenerator> mockedStatic) {
    JWKSKey localKey = mock(JWKSKey.class);
    when(localKey.getKid()).thenReturn(LOCAL_KID);
    when(localKey.getKty()).thenReturn("RSA");
    when(localKey.getN()).thenReturn("test-n");
    when(localKey.getE()).thenReturn("AQAB");
    JWKSResponse localKeySet = mock(JWKSResponse.class);
    when(localKeySet.getJwsKeys()).thenReturn(List.of(localKey));
    JWTTokenGenerator localGenerator = mock(JWTTokenGenerator.class);
    when(localGenerator.getJWKSResponse()).thenReturn(localKeySet);
    mockedStatic.when(JWTTokenGenerator::getInstance).thenReturn(localGenerator);
  }

  private static String keySetJson(String keyId, RSAPublicKey key) {
    return String.format(
        "{\"keys\":[{\"kty\":\"RSA\",\"kid\":\"%s\",\"use\":\"sig\",\"alg\":\"RS256\","
            + "\"n\":\"%s\",\"e\":\"%s\"}]}",
        keyId, base64Url(key.getModulus()), base64Url(key.getPublicExponent()));
  }

  private static String base64Url(BigInteger value) {
    byte[] bytes = value.toByteArray();
    byte[] unsigned = bytes[0] == 0 ? Arrays.copyOfRange(bytes, 1, bytes.length) : bytes;
    return Base64.getUrlEncoder().withoutPadding().encodeToString(unsigned);
  }
}
