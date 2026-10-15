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

package org.openmetadata.service.util.jdbi;

import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.jdbi.v3.core.config.ConfigRegistry;
import org.jdbi.v3.core.extension.ExtensionMetadata;
import org.jdbi.v3.core.extension.ExtensionMetadata.ExtensionHandlerInvoker;
import org.jdbi.v3.core.extension.HandleSupplier;
import org.jdbi.v3.core.internal.OnDemandHandleSupplier;
import org.jdbi.v3.sqlobject.CreateSqlObject;

/**
 * The invocation handler behind one attached SQL object: it builds a method's Jdbi handler the
 * first time that method is called and reuses it after.
 */
final class LazyMethodHandlers implements InvocationHandler {

  private static final String EQUALS = "equals";
  private static final String HASH_CODE = "hashCode";

  private final LazySqlObjectFactory factory;
  private final Class<?> extensionType;
  private final ExtensionMetadata metadata;
  private final HandleSupplier handleSupplier;
  private final ConfigRegistry instanceConfig;
  // Bounded by the number of methods the SQL object type declares.
  private final Map<Method, ExtensionHandlerInvoker> invokers = new ConcurrentHashMap<>();

  LazyMethodHandlers(
      LazySqlObjectFactory factory,
      Class<?> extensionType,
      ExtensionMetadata metadata,
      HandleSupplier handleSupplier,
      ConfigRegistry instanceConfig) {
    this.factory = factory;
    this.extensionType = extensionType;
    this.metadata = metadata;
    this.handleSupplier = handleSupplier;
    this.instanceConfig = instanceConfig;
  }

  @Override
  public Object invoke(Object proxy, Method method, Object[] args) {
    Object result;
    if (method.getDeclaringClass() == Object.class) {
      result = invokeObjectMethod(proxy, method, args);
    } else if (attachesNestedObjectOnHandle(method)) {
      result = factory.attach(method.getReturnType(), handleSupplier);
    } else {
      result = invokerFor(proxy, method).invoke(args);
    }
    return result;
  }

  // On demand, Jdbi's @CreateSqlObject handler returns another on-demand proxy, which reaches this
  // factory anyway. On a handle (a transaction, withExtension) it attaches the nested type through
  // Jdbi's own SqlObjectFactory, which would build every handler of the nested DAO.
  private boolean attachesNestedObjectOnHandle(Method method) {
    return method.isAnnotationPresent(CreateSqlObject.class)
        && !(handleSupplier instanceof OnDemandHandleSupplier);
  }

  private ExtensionHandlerInvoker invokerFor(Object proxy, Method method) {
    ExtensionHandlerInvoker invoker = invokers.get(method);
    if (invoker == null) {
      // Built outside any lock: computeIfAbsent would hold a bin lock while the handler and its
      // configuration copy are built, pinning a virtual thread if anything inside parks.
      ExtensionHandlerInvoker built =
          metadata.createExtensionHandlerInvoker(
              proxy, extensionMethodFor(method), handleSupplier, instanceConfig);
      ExtensionHandlerInvoker raced = invokers.putIfAbsent(method, built);
      invoker = raced == null ? built : raced;
    }
    return invoker;
  }

  // Jdbi keys handlers by the methods of the SQL object type; a proxy may hand over the same
  // signature declared on another interface the type inherits it from.
  private Method extensionMethodFor(Method method) {
    return metadata.getExtensionMethods().contains(method)
        ? method
        : metadata.getExtensionMethods().stream()
            .filter(candidate -> hasSameSignature(candidate, method))
            .findFirst()
            .orElse(method);
  }

  private static boolean hasSameSignature(Method candidate, Method method) {
    return candidate.getName().equals(method.getName())
        && Arrays.equals(candidate.getParameterTypes(), method.getParameterTypes());
  }

  // A proxy routes only equals, hashCode and toString of Object to its handler.
  private Object invokeObjectMethod(Object proxy, Method method, Object[] args) {
    return switch (method.getName()) {
      case EQUALS -> proxy == args[0];
      case HASH_CODE -> System.identityHashCode(proxy);
      default -> "Jdbi extension proxy for %s@%s"
          .formatted(extensionType.getName(), Integer.toHexString(System.identityHashCode(proxy)));
    };
  }
}
