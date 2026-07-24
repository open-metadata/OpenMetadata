/*
 *  Copyright 2024 Collate
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
package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.jdbi.v3.sqlobject.CreateSqlObject;
import org.junit.jupiter.api.Test;

/**
 * Guards the CollectionDAO decomposition. CollectionDAO was split into domain aggregator
 * interfaces (RdfInfraDAOs, SearchReindexDAOs, ...) that it {@code extends}. JDBI's SqlObjectFactory
 * builds its handler map from {@code sqlObjectType.getMethods()}, which returns inherited public
 * methods, so every {@code @CreateSqlObject} accessor moved to an extended interface must remain
 * visible (and annotated) through CollectionDAO for the runtime wiring to keep working.
 *
 * <p>The expected accessor set is derived by reflection over CollectionDAO and every interface it
 * transitively extends, so the guard stays exhaustive automatically as accessors are added, moved,
 * or new aggregator interfaces appear — no hardcoded list to keep in sync.
 */
class CollectionDAOCompositionTest {

  /** A floor so a reflection change that silently returns nothing fails loudly. */
  private static final int MIN_EXPECTED_ACCESSORS = 30;

  @Test
  void everyCreateSqlObjectAccessorRemainsVisibleAndAnnotated() throws NoSuchMethodException {
    Set<String> visibleMethods =
        Arrays.stream(CollectionDAO.class.getMethods())
            .map(Method::getName)
            .collect(Collectors.toSet());

    List<Method> accessors = declaredCreateSqlObjectAccessors();
    assertTrue(
        accessors.size() >= MIN_EXPECTED_ACCESSORS,
        "Expected at least "
            + MIN_EXPECTED_ACCESSORS
            + " @CreateSqlObject accessors across CollectionDAO and its extended interfaces, found "
            + accessors.size());

    for (Method accessor : accessors) {
      String name = accessor.getName();
      String declaredIn = accessor.getDeclaringClass().getSimpleName();
      assertTrue(
          visibleMethods.contains(name),
          name + " (declared on " + declaredIn + ") is not visible via CollectionDAO.getMethods()");
      Method viaCollectionDao = CollectionDAO.class.getMethod(name);
      assertNotNull(
          viaCollectionDao.getAnnotation(CreateSqlObject.class),
          name + " lost its @CreateSqlObject annotation when resolved through CollectionDAO");
    }
  }

  /**
   * Every {@code @CreateSqlObject} accessor declared directly on CollectionDAO or on any interface
   * it transitively extends — the full source-of-truth set JDBI must be able to wire.
   */
  private static List<Method> declaredCreateSqlObjectAccessors() {
    Set<Class<?>> types = new LinkedHashSet<>();
    types.add(CollectionDAO.class);
    collectExtendedInterfaces(CollectionDAO.class, types);

    List<Method> accessors = new ArrayList<>();
    for (Class<?> type : types) {
      for (Method method : type.getDeclaredMethods()) {
        if (method.isAnnotationPresent(CreateSqlObject.class)) {
          accessors.add(method);
        }
      }
    }
    return accessors;
  }

  private static void collectExtendedInterfaces(Class<?> type, Set<Class<?>> accumulator) {
    for (Class<?> extended : type.getInterfaces()) {
      if (accumulator.add(extended)) {
        collectExtendedInterfaces(extended, accumulator);
      }
    }
  }
}
