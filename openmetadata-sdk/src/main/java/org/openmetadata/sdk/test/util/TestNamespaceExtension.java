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
package org.openmetadata.sdk.test.util;

import org.junit.jupiter.api.extension.BeforeEachCallback;
import org.junit.jupiter.api.extension.ExtensionContext;
import org.junit.jupiter.api.extension.ExtensionContext.Namespace;
import org.junit.jupiter.api.extension.ParameterContext;
import org.junit.jupiter.api.extension.ParameterResolver;

/**
 * JUnit 5 extension that provides a fresh {@link TestNamespace} instance to every test method.
 * Annotate a test class with {@code @ExtendWith(TestNamespaceExtension.class)} and declare a
 * {@code TestNamespace} parameter on any test method to receive an auto-populated namespace.
 */
public class TestNamespaceExtension implements BeforeEachCallback, ParameterResolver {

  private static final Namespace NAMESPACE = Namespace.create(TestNamespaceExtension.class);
  private static final String NS_KEY = "testNamespace";

  @Override
  public void beforeEach(ExtensionContext context) {
    String classId = context.getRequiredTestClass().getSimpleName();
    String methodId = context.getRequiredTestMethod().getName();
    TestNamespace ns = new TestNamespace(classId);
    ns.setMethodId(methodId);
    context.getStore(NAMESPACE).put(NS_KEY, ns);
  }

  @Override
  public boolean supportsParameter(
      ParameterContext parameterContext, ExtensionContext extensionContext) {
    return parameterContext.getParameter().getType().equals(TestNamespace.class);
  }

  @Override
  public Object resolveParameter(
      ParameterContext parameterContext, ExtensionContext extensionContext) {
    return extensionContext.getStore(NAMESPACE).get(NS_KEY, TestNamespace.class);
  }
}
