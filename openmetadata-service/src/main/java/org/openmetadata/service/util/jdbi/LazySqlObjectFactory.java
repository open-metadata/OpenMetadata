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

import java.lang.reflect.Proxy;
import java.util.EnumSet;
import java.util.Set;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.config.ConfigRegistry;
import org.jdbi.v3.core.extension.ExtensionFactory;
import org.jdbi.v3.core.extension.ExtensionMetadata;
import org.jdbi.v3.core.extension.Extensions;
import org.jdbi.v3.core.extension.HandleSupplier;
import org.jdbi.v3.sqlobject.SqlObjectFactory;

/**
 * Attaches SQL objects the way Jdbi did before 3.38: a method's handler is built the first time
 * that method is called, not when the object is attached.
 *
 * <p>From 3.38 on, Jdbi builds a handler, each with its own copy of the configuration, for every
 * method of a SQL object whenever it is attached, and an on-demand DAO is attached on every call.
 * OpenMetadata's {@code CollectionDAO} has about 150 methods and each entity DAO about 80, so one
 * {@code getCollectionDAO().tableDAO().findById(...)} paid for over two hundred configuration
 * copies. Every pin-free Jdbi release does this (jdbi/jdbi#2601).
 *
 * <p>Handlers come from the same {@link ExtensionMetadata} Jdbi's own factory uses, so a method
 * behaves exactly as before; only when its handler is built changes.
 * ADR:2026-10-14-sql-objects-build-method-handlers-on-first-call
 */
public final class LazySqlObjectFactory implements ExtensionFactory {

  private static final Set<FactoryFlag> FACTORY_FLAGS = EnumSet.of(FactoryFlag.DONT_USE_PROXY);

  private final ExtensionFactory sqlObjects;

  // SqlObjectFactory.accepts scans every method's annotations; Jdbi asks on every attach.
  private final ClassValue<Boolean> acceptedTypes =
      new ClassValue<>() {
        @Override
        protected Boolean computeValue(Class<?> extensionType) {
          return sqlObjects.accepts(extensionType);
        }
      };

  LazySqlObjectFactory(ExtensionFactory sqlObjects) {
    this.sqlObjects = sqlObjects;
  }

  /**
   * Puts the factory in front of Jdbi's own SQL object factory, which must already be installed:
   * Jdbi asks the most recently registered factory first.
   */
  public static void install(Jdbi jdbi) {
    Extensions extensions = jdbi.getConfig(Extensions.class);
    ExtensionFactory sqlObjects =
        extensions
            .findFactory(SqlObjectFactory.class)
            .orElseThrow(
                () ->
                    new IllegalStateException(
                        "SqlObjectPlugin must be installed before LazySqlObjectFactory"));
    extensions.register(new LazySqlObjectFactory(sqlObjects));
  }

  @Override
  public boolean accepts(Class<?> extensionType) {
    return acceptedTypes.get(extensionType);
  }

  @Override
  public Set<FactoryFlag> getFactoryFlags() {
    return FACTORY_FLAGS;
  }

  @Override
  public <E> E attach(Class<E> extensionType, HandleSupplier handleSupplier) {
    ConfigRegistry config = handleSupplier.getConfig();
    Extensions extensions = config.get(Extensions.class);
    extensions.onCreateProxy();
    ExtensionMetadata metadata = extensions.findMetadata(extensionType, sqlObjects);
    LazyMethodHandlers handlers =
        new LazyMethodHandlers(
            this,
            extensionType,
            metadata,
            handleSupplier,
            metadata.createInstanceConfiguration(config));
    return extensionType.cast(
        Proxy.newProxyInstance(
            extensionType.getClassLoader(), new Class<?>[] {extensionType}, handlers));
  }
}
