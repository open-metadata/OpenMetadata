/*
 *  Copyright 2026 Collate
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

package org.openmetadata.service.resources;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.lang.reflect.Constructor;
import org.jdbi.v3.core.Jdbi;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.AuthenticatorHandler;

class CollectionRegistryTest {
  @Test
  void resolvesKnownConstructorSignaturesInExistingPrecedenceOrder() throws Exception {
    assertSignature(AllSignaturesResource.class, OpenMetadataApplicationConfig.class, Limits.class);
    assertSignature(AuthorizerSignaturesResource.class, Authorizer.class, Limits.class);
    assertSignature(AuthorizerOnlyResource.class, Authorizer.class);
    assertSignature(
        AuthorizerAndFallbackSignaturesResource.class,
        Authorizer.class,
        Limits.class,
        AuthenticatorHandler.class);
    assertSignature(JdbiAndFallbackSignaturesResource.class, Jdbi.class, Authorizer.class);
    assertSignature(LimitsAndNoArgsResource.class, Limits.class);
    assertSignature(NoArgsResource.class);
  }

  @Test
  void rejectsUnknownAndNonPublicNoArgsConstructors() {
    assertThrows(
        NoSuchMethodException.class,
        () -> CollectionRegistry.resolveConstructor(UnknownSignatureResource.class));
    assertThrows(
        NoSuchMethodException.class,
        () -> CollectionRegistry.resolveConstructor(NonPublicNoArgsResource.class));
  }

  private static void assertSignature(Class<?> resourceClass, Class<?>... parameterTypes)
      throws Exception {
    Constructor<?> constructor = CollectionRegistry.resolveConstructor(resourceClass);
    assertArrayEquals(parameterTypes, constructor.getParameterTypes());
  }

  private static class AllSignaturesResource {
    public AllSignaturesResource() {}

    AllSignaturesResource(OpenMetadataApplicationConfig config, Limits limits) {}

    AllSignaturesResource(Authorizer authorizer, Limits limits) {}

    AllSignaturesResource(Authorizer authorizer) {}

    AllSignaturesResource(
        Authorizer authorizer, Limits limits, AuthenticatorHandler authenticatorHandler) {}

    AllSignaturesResource(Jdbi jdbi, Authorizer authorizer) {}

    AllSignaturesResource(Limits limits) {}
  }

  private static class AuthorizerSignaturesResource {
    public AuthorizerSignaturesResource() {}

    AuthorizerSignaturesResource(Authorizer authorizer, Limits limits) {}

    AuthorizerSignaturesResource(Authorizer authorizer) {}
  }

  private static class AuthorizerAndFallbackSignaturesResource {
    public AuthorizerAndFallbackSignaturesResource() {}

    AuthorizerAndFallbackSignaturesResource(
        Authorizer authorizer, Limits limits, AuthenticatorHandler authenticatorHandler) {}

    AuthorizerAndFallbackSignaturesResource(Jdbi jdbi, Authorizer authorizer) {}

    AuthorizerAndFallbackSignaturesResource(Limits limits) {}
  }

  private static class AuthorizerOnlyResource {
    public AuthorizerOnlyResource() {}

    AuthorizerOnlyResource(Authorizer authorizer) {}

    AuthorizerOnlyResource(
        Authorizer authorizer, Limits limits, AuthenticatorHandler authenticatorHandler) {}
  }

  private static class JdbiAndFallbackSignaturesResource {
    public JdbiAndFallbackSignaturesResource() {}

    JdbiAndFallbackSignaturesResource(Jdbi jdbi, Authorizer authorizer) {}

    JdbiAndFallbackSignaturesResource(Limits limits) {}
  }

  private static class LimitsAndNoArgsResource {
    public LimitsAndNoArgsResource() {}

    LimitsAndNoArgsResource(Limits limits) {}
  }

  private static class NoArgsResource {
    public NoArgsResource() {}
  }

  private static class UnknownSignatureResource {
    UnknownSignatureResource(String value) {}
  }

  private static class NonPublicNoArgsResource {
    private NonPublicNoArgsResource() {}
  }
}
