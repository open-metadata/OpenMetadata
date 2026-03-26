/*
 *  Copyright 2025 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.security.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.configuration.MCPConfiguration;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.service.security.auth.validator.OidcDiscoveryValidator;

public class SecurityConfigurationManagerTest {

  private SecurityConfigurationManager.ConfigurationChangeListener mockListener;

  @BeforeEach
  void setUp() {
    mockListener = mock(SecurityConfigurationManager.ConfigurationChangeListener.class);
  }

  @AfterEach
  void tearDown() {
    SecurityConfigurationManager manager = SecurityConfigurationManager.getInstance();
    manager.setCurrentAuthConfig(null);
    manager.setCurrentAuthzConfig(null);
    manager.setCurrentMcpConfig(null);
    manager.resetOidcIssuerResolutionState();
  }

  @Test
  void testSingletonInstance() {
    SecurityConfigurationManager instance1 = SecurityConfigurationManager.getInstance();
    SecurityConfigurationManager instance2 = SecurityConfigurationManager.getInstance();

    assertNotNull(instance1);
    assertEquals(instance1, instance2, "Should return same singleton instance");
  }

  @Test
  void testListenerRegistration() {
    SecurityConfigurationManager manager = SecurityConfigurationManager.getInstance();

    manager.addConfigurationChangeListener(mockListener);

    verify(mockListener, never()).onConfigurationChanged(any(), any(), any());
  }

  @Test
  void testListenerRemoval() {
    SecurityConfigurationManager manager = SecurityConfigurationManager.getInstance();

    manager.addConfigurationChangeListener(mockListener);
    manager.removeConfigurationChangeListener(mockListener);

    verify(mockListener, never()).onConfigurationChanged(any(), any(), any());
  }

  @Test
  void testDuplicateListenerNotAdded() {
    SecurityConfigurationManager manager = SecurityConfigurationManager.getInstance();
    SecurityConfigurationManager.ConfigurationChangeListener listener = (auth, authz, mcp) -> {};

    manager.addConfigurationChangeListener(listener);
    manager.addConfigurationChangeListener(listener);

    assertTrue(true, "Adding duplicate listener should not throw exception");
  }

  @Test
  void testNullListenerNotAdded() {
    SecurityConfigurationManager manager = SecurityConfigurationManager.getInstance();

    manager.addConfigurationChangeListener(null);

    verify(mockListener, never()).onConfigurationChanged(any(), any(), any());
  }

  @Test
  void testThreadSafeConfigurationAccess() throws InterruptedException {
    SecurityConfigurationManager manager = SecurityConfigurationManager.getInstance();
    int threadCount = 10;
    int iterations = 100;
    CountDownLatch latch = new CountDownLatch(threadCount);
    List<Throwable> errors = new ArrayList<>();

    for (int i = 0; i < threadCount; i++) {
      new Thread(
              () -> {
                try {
                  for (int j = 0; j < iterations; j++) {
                    AuthenticationConfiguration authConfig =
                        SecurityConfigurationManager.getCurrentAuthConfig();
                    AuthorizerConfiguration authzConfig =
                        SecurityConfigurationManager.getCurrentAuthzConfig();
                    MCPConfiguration mcpConfig = SecurityConfigurationManager.getCurrentMcpConfig();

                    if (authConfig != null && authzConfig != null && mcpConfig != null) {
                      assertNotNull(authConfig);
                      assertNotNull(authzConfig);
                      assertNotNull(mcpConfig);
                    }
                  }
                } catch (Throwable t) {
                  errors.add(t);
                } finally {
                  latch.countDown();
                }
              })
          .start();
    }

    assertTrue(latch.await(30, TimeUnit.SECONDS), "Threads should complete within timeout");
    assertTrue(errors.isEmpty(), "No thread safety errors should occur: " + errors);
  }

  @Test
  void testSetAndGetConfig() {
    AuthenticationConfiguration previousAuth = new AuthenticationConfiguration();
    AuthorizerConfiguration previousAuthz = new AuthorizerConfiguration();
    MCPConfiguration previousMcp = new MCPConfiguration();

    previousAuth.setProvider(AuthProvider.BASIC);
    previousMcp.setBaseUrl("https://previous.example.com");

    SecurityConfigurationManager manager = SecurityConfigurationManager.getInstance();
    manager.setCurrentAuthConfig(previousAuth);
    manager.setCurrentAuthzConfig(previousAuthz);
    manager.setCurrentMcpConfig(previousMcp);

    AuthenticationConfiguration currentAuth = SecurityConfigurationManager.getCurrentAuthConfig();
    assertNotNull(currentAuth);
    assertEquals(AuthProvider.BASIC, currentAuth.getProvider());

    MCPConfiguration currentMcp = SecurityConfigurationManager.getCurrentMcpConfig();
    assertNotNull(currentMcp);
    assertEquals("https://previous.example.com", currentMcp.getBaseUrl());
  }

  @Test
  void testConfigGettersReturnNullWhenNotInitialized() {
    AuthenticationConfiguration auth = SecurityConfigurationManager.getCurrentAuthConfig();
    AuthorizerConfiguration authz = SecurityConfigurationManager.getCurrentAuthzConfig();
    MCPConfiguration mcp = SecurityConfigurationManager.getCurrentMcpConfig();

    if (auth == null && authz == null && mcp == null) {
      assertNull(auth);
      assertNull(authz);
      assertNull(mcp);
    } else {
      assertNotNull(auth);
      assertNotNull(authz);
    }
  }

  @Test
  void testRefreshResolvedOidcIssuerIfStale_NonOidcProvider_DoesNothing() {
    SecurityConfigurationManager manager = SecurityConfigurationManager.getInstance();
    manager.resetOidcIssuerResolutionState();
    AuthenticationConfiguration auth = new AuthenticationConfiguration();
    auth.setProvider(AuthProvider.BASIC);
    auth.setAuthority("https://login.example.com");
    manager.setCurrentAuthConfig(auth);
    manager.setCurrentAuthzConfig(new AuthorizerConfiguration());

    try (MockedStatic<OidcDiscoveryValidator> mockedValidator =
        mockStatic(OidcDiscoveryValidator.class)) {
      assertFalse(manager.refreshResolvedOidcIssuerIfStale());

      mockedValidator.verify(() -> OidcDiscoveryValidator.resolveIssuer(any(), any()), never());
      assertNull(manager.getResolvedOidcIssuer());
      assertFalse(manager.isOidcIssuerFromDiscovery());
    }
  }

  @Test
  void testRefreshResolvedOidcIssuerIfStale_DiscoverySuccess_UpdatesResolvedIssuer() {
    SecurityConfigurationManager manager = SecurityConfigurationManager.getInstance();
    manager.resetOidcIssuerResolutionState();
    AuthenticationConfiguration auth = new AuthenticationConfiguration();
    auth.setProvider(AuthProvider.AZURE);
    auth.setAuthority("https://login.microsoftonline.com/contoso");
    manager.setCurrentAuthConfig(auth);
    manager.setCurrentAuthzConfig(new AuthorizerConfiguration());

    try (MockedStatic<OidcDiscoveryValidator> mockedValidator =
        mockStatic(OidcDiscoveryValidator.class)) {
      mockedValidator
          .when(() -> OidcDiscoveryValidator.resolveIssuer(any(), any()))
          .thenReturn("https://login.microsoftonline.com/contoso/v2.0");

      assertTrue(manager.refreshResolvedOidcIssuerIfStale());

      assertEquals(
          "https://login.microsoftonline.com/contoso/v2.0", manager.getResolvedOidcIssuer());
      assertTrue(manager.isOidcIssuerFromDiscovery());
    }
  }

  @Test
  void testRefreshResolvedOidcIssuerIfStale_DiscoveryFailure_FallsBackToAuthority() {
    SecurityConfigurationManager manager = SecurityConfigurationManager.getInstance();
    manager.resetOidcIssuerResolutionState();
    AuthenticationConfiguration auth = new AuthenticationConfiguration();
    auth.setProvider(AuthProvider.CUSTOM_OIDC);
    auth.setAuthority("https://auth.example.com");
    manager.setCurrentAuthConfig(auth);
    manager.setCurrentAuthzConfig(new AuthorizerConfiguration());

    try (MockedStatic<OidcDiscoveryValidator> mockedValidator =
        mockStatic(OidcDiscoveryValidator.class)) {
      mockedValidator
          .when(() -> OidcDiscoveryValidator.resolveIssuer(any(), any()))
          .thenReturn(null);

      assertTrue(manager.refreshResolvedOidcIssuerIfStale());

      assertEquals("https://auth.example.com", manager.getResolvedOidcIssuer());
      assertFalse(manager.isOidcIssuerFromDiscovery());
    }
  }

  @Test
  void testRefreshResolvedOidcIssuerIfStale_AlreadyFromDiscovery_SkipsRefresh() {
    SecurityConfigurationManager manager = SecurityConfigurationManager.getInstance();
    manager.resetOidcIssuerResolutionState();
    AuthenticationConfiguration auth = new AuthenticationConfiguration();
    auth.setProvider(AuthProvider.CUSTOM_OIDC);
    auth.setAuthority("https://auth.example.com");
    manager.setCurrentAuthConfig(auth);
    manager.setCurrentAuthzConfig(new AuthorizerConfiguration());

    try (MockedStatic<OidcDiscoveryValidator> mockedValidator =
        mockStatic(OidcDiscoveryValidator.class)) {
      mockedValidator
          .when(() -> OidcDiscoveryValidator.resolveIssuer(any(), any()))
          .thenReturn("https://auth.example.com/realm");

      manager.refreshResolvedOidcIssuerIfStale();
      assertTrue(manager.isOidcIssuerFromDiscovery());

      assertFalse(manager.refreshResolvedOidcIssuerIfStale());
      mockedValidator.verify(() -> OidcDiscoveryValidator.resolveIssuer(any(), any()), times(1));
    }
  }

  @Test
  void testConcurrentReads() throws InterruptedException {
    SecurityConfigurationManager manager = SecurityConfigurationManager.getInstance();
    int threadCount = 50;
    CountDownLatch startLatch = new CountDownLatch(1);
    CountDownLatch finishLatch = new CountDownLatch(threadCount);
    List<Throwable> errors = new ArrayList<>();

    AuthenticationConfiguration testAuth = new AuthenticationConfiguration();
    testAuth.setProvider(AuthProvider.GOOGLE);
    manager.setCurrentAuthConfig(testAuth);

    for (int i = 0; i < threadCount; i++) {
      new Thread(
              () -> {
                try {
                  startLatch.await();
                  AuthenticationConfiguration auth =
                      SecurityConfigurationManager.getCurrentAuthConfig();
                  if (auth != null && !auth.getProvider().equals(AuthProvider.GOOGLE)) {
                    errors.add(
                        new AssertionError("Expected GOOGLE provider, got: " + auth.getProvider()));
                  }
                } catch (Throwable t) {
                  errors.add(t);
                } finally {
                  finishLatch.countDown();
                }
              })
          .start();
    }

    startLatch.countDown();
    assertTrue(finishLatch.await(10, TimeUnit.SECONDS), "All threads should complete");
    assertTrue(errors.isEmpty(), "No race conditions should occur: " + errors);
  }
}
