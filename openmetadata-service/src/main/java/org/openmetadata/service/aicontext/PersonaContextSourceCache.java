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

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.function.Supplier;
import org.openmetadata.schema.entity.teams.Persona;
import org.openmetadata.schema.type.personaContext.ContextRule;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.search.SearchResultListMapper;

/** Shared source data only. Authorization decisions and caller-rendered documents never enter it. */
final class PersonaContextSourceCache {
  private static final int MIN_PAGE_WEIGHT = 32_000;
  private final Cache<UUID, UUID> generations = Caffeine.newBuilder().maximumSize(1000).build();
  private final Cache<PageKey, SearchResultListMapper> pages = weightedCache(16_000_000);
  private final Cache<SelectionKey, PersonaContextBuilder.EnrichedSelection> selections =
      weightedCache(16_000_000);
  private final Cache<EntityKey, KnowledgeSource> knowledge = weightedCache(8_000_000);
  private final Cache<ProductKey, PersonaContextBuilder.ProductPage> products =
      weightedCache(8_000_000);
  private final Cache<RuleKey, Boolean> validations =
      Caffeine.newBuilder().maximumSize(1000).expireAfterWrite(Duration.ofSeconds(60)).build();

  SearchResultListMapper search(
      Scope scope,
      ContextRule rule,
      Object[] cursor,
      int pageSize,
      Supplier<SearchResultListMapper> load) {
    PageKey key = new PageKey(scope, rule.getName(), JsonUtils.pojoToJson(cursor), pageSize);
    return pages.get(key, ignored -> load.get());
  }

  PersonaContextBuilder.EnrichedSelection enrich(
      Scope scope,
      List<PersonaContextBuilder.RuleMaterialization> rules,
      Supplier<PersonaContextBuilder.EnrichedSelection> load) {
    List<RuleSelection> selection =
        rules.stream()
            .map(
                rule ->
                    new RuleSelection(
                        rule.rule().getName(),
                        rule.entities().stream()
                            .map(
                                entity ->
                                    new AssetSelection(
                                        entity.context().getEntityType(),
                                        entity.context().getFullyQualifiedName()))
                            .toList()))
            .toList();
    return selections.get(new SelectionKey(scope, selection), ignored -> load.get());
  }

  PersonaContextBuilder.SelectedEntity knowledge(
      Scope scope,
      String entityType,
      String fqn,
      Supplier<PersonaContextBuilder.SelectedEntity> load) {
    return knowledge
        .get(new EntityKey(scope, entityType, fqn), ignored -> new KnowledgeSource(load.get()))
        .entity();
  }

  PersonaContextBuilder.ProductPage productPage(
      Scope scope,
      String fqn,
      int offset,
      int limit,
      Supplier<PersonaContextBuilder.ProductPage> load) {
    return products.get(new ProductKey(scope, fqn, offset, limit), ignored -> load.get());
  }

  void validate(Scope scope, ContextRule rule, Runnable validate) {
    validations.get(
        new RuleKey(scope, rule.getName()),
        ignored -> {
          validate.run();
          return true;
        });
  }

  void invalidate(UUID personaId) {
    // An in-flight load retains its old generation key and cannot repopulate the new generation.
    generations.invalidate(personaId);
    pages.asMap().keySet().removeIf(key -> key.scope().personaId().equals(personaId));
    selections.asMap().keySet().removeIf(key -> key.scope().personaId().equals(personaId));
    knowledge.asMap().keySet().removeIf(key -> key.scope().personaId().equals(personaId));
    products.asMap().keySet().removeIf(key -> key.scope().personaId().equals(personaId));
    validations.asMap().keySet().removeIf(key -> key.scope().personaId().equals(personaId));
  }

  Scope scope(Persona persona) {
    return new Scope(
        persona.getId(),
        generations.get(persona.getId(), ignored -> UUID.randomUUID()),
        PersonaContextHash.definitionHash(PersonaContextBuilder.definitionOf(persona)));
  }

  private static <K, V> Cache<K, V> weightedCache(int maximumWeight) {
    return Caffeine.newBuilder()
        .maximumWeight(maximumWeight)
        .weigher(
            (K key, V value) -> Math.max(MIN_PAGE_WEIGHT, JsonUtils.pojoToJson(value).length()))
        .expireAfterWrite(Duration.ofSeconds(60))
        .build();
  }

  record Scope(UUID personaId, UUID generation, String definitionHash) {}

  private record PageKey(Scope scope, String ruleName, String cursor, int pageSize) {}

  private record SelectionKey(Scope scope, List<RuleSelection> rules) {}

  private record RuleSelection(String ruleName, List<AssetSelection> entities) {}

  private record AssetSelection(String entityType, String fqn) {}

  private record EntityKey(Scope scope, String entityType, String fqn) {}

  private record ProductKey(Scope scope, String fqn, int offset, int limit) {}

  private record RuleKey(Scope scope, String ruleName) {}

  private record KnowledgeSource(PersonaContextBuilder.SelectedEntity entity) {}
}
