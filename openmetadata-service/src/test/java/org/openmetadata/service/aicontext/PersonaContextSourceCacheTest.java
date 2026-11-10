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
package org.openmetadata.service.aicontext;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.teams.Persona;
import org.openmetadata.schema.type.PersonaContextDefinition;
import org.openmetadata.schema.type.personaContext.ContextRule;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.SearchResultListMapper;

class PersonaContextSourceCacheTest {
  @Test
  void dataProductSourcePagesRespectTheRequestedCandidateLimit() {
    PersonaContextSourceCache cache = new PersonaContextSourceCache();
    var scope = cache.scope(persona());
    var larger = new PersonaContextBuilder.ProductPage(List.of(), 10, 1000);
    var smaller = new PersonaContextBuilder.ProductPage(List.of(), 5, 1000);
    assertEquals(larger, cache.productPage(scope, "product", 0, 10, () -> larger));
    assertEquals(smaller, cache.productPage(scope, "product", 0, 5, () -> smaller));
  }

  @Test
  void unapprovedOrMissingKnowledgeIsNotReloadedOnEveryRead() {
    PersonaContextSourceCache cache = new PersonaContextSourceCache();
    var scope = cache.scope(persona());
    AtomicInteger loads = new AtomicInteger();
    for (int read = 0; read < 2; read++) {
      assertNull(
          cache.knowledge(
              scope,
              Entity.PAGE,
              "retired.page",
              () -> {
                loads.incrementAndGet();
                return null;
              }));
    }
    assertEquals(1, loads.get());
  }

  @Test
  void parallelRepresentationsShareTheirSearchAndMaterializationInputs() throws Exception {
    SearchRepository repository = mock(SearchRepository.class);
    when(repository.listWithDeepPagination(
            anyString(), isNull(), anyString(), any(), any(), anyInt(), isNull()))
        .thenReturn(
            new SearchResultListMapper(
                List.of(
                    Map.of(
                        "fullyQualifiedName",
                        "service.db.schema.orders",
                        "description",
                        "shared source")),
                1));
    Persona persona = persona();
    PersonaContextSourceCache cache = new PersonaContextSourceCache();
    CountDownLatch start = new CountDownLatch(1);
    Callable<PersonaContextBuilder.MaterializedPersonaContext> read =
        () -> {
          assertTrue(start.await(5, TimeUnit.SECONDS));
          return new PersonaContextBuilder(persona, repository).withSourceCache(cache).build();
        };
    try (var executor = Executors.newFixedThreadPool(2)) {
      var json = executor.submit(read);
      var markdown = executor.submit(read);
      start.countDown();
      assertTrue(json.get(5, TimeUnit.SECONDS).markdown().contains("shared source"));
      assertEquals(
          "service.db.schema.orders",
          markdown
              .get(5, TimeUnit.SECONDS)
              .context()
              .getRules()
              .getFirst()
              .getEntities()
              .getFirst()
              .getFullyQualifiedName());
      verify(repository, times(1))
          .listWithDeepPagination(
              anyString(), isNull(), anyString(), any(), any(), anyInt(), isNull());
    }
  }

  @Test
  void refreshRejectsAnOldGenerationThatFinishesLoadingAfterInvalidation() throws Exception {
    Persona persona = persona();
    ContextRule rule = persona.getContextDefinition().getRules().getFirst();
    PersonaContextSourceCache cache = new PersonaContextSourceCache();
    var oldScope = cache.scope(persona);
    CountDownLatch loading = new CountDownLatch(1);
    CountDownLatch finish = new CountDownLatch(1);
    try (var executor = Executors.newSingleThreadExecutor()) {
      var oldRead =
          executor.submit(
              () ->
                  cache.search(
                      oldScope,
                      rule,
                      null,
                      100,
                      () -> {
                        loading.countDown();
                        try {
                          assertTrue(finish.await(5, TimeUnit.SECONDS));
                        } catch (InterruptedException exception) {
                          Thread.currentThread().interrupt();
                          throw new IllegalStateException(exception);
                        }
                        return page("old");
                      }));
      try {
        assertTrue(loading.await(5, TimeUnit.SECONDS));
        cache.invalidate(persona.getId());
        var freshScope = cache.scope(persona);
        assertEquals(
            "fresh",
            cache
                .search(freshScope, rule, null, 100, () -> page("fresh"))
                .getResults()
                .getFirst()
                .get("description"));
        finish.countDown();
        assertEquals(
            "old", oldRead.get(5, TimeUnit.SECONDS).getResults().getFirst().get("description"));
        assertEquals(
            "fresh",
            cache
                .search(freshScope, rule, null, 100, () -> page("wrong"))
                .getResults()
                .getFirst()
                .get("description"));
      } finally {
        finish.countDown();
      }
    }
  }

  @Test
  void successfulScopeValidationIsSharedUntilRefresh() {
    Persona persona = persona();
    ContextRule rule = persona.getContextDefinition().getRules().getFirst();
    PersonaContextSourceCache cache = new PersonaContextSourceCache();
    AtomicInteger validations = new AtomicInteger();
    cache.validate(cache.scope(persona), rule, validations::incrementAndGet);
    cache.validate(cache.scope(persona), rule, validations::incrementAndGet);
    assertEquals(1, validations.get());
    cache.invalidate(persona.getId());
    cache.validate(cache.scope(persona), rule, validations::incrementAndGet);
    assertEquals(2, validations.get());
  }

  private static SearchResultListMapper page(String description) {
    return new SearchResultListMapper(List.of(Map.of("description", description)), 1);
  }

  private static Persona persona() {
    return new Persona()
        .withId(UUID.randomUUID())
        .withName("analyst")
        .withContextDefinition(
            new PersonaContextDefinition()
                .withRules(
                    List.of(
                        new ContextRule()
                            .withName("Tables")
                            .withEntityType(Entity.TABLE)
                            .withMaxAssets(10))));
  }
}
