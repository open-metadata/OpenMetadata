/*
 *  Copyright 2026 Collate.
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

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.schema.type.Include.ALL;

import com.fasterxml.jackson.databind.JsonNode;
import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;
import com.google.common.util.concurrent.UncheckedExecutionException;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutionException;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.tuple.ImmutablePair;
import org.openmetadata.schema.entity.type.Style;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;

/**
 * Fills the colour and icon of references to styled entities (domains, data products), so a client
 * can draw the reference without fetching the entity. Applied where references leave the server:
 * API responses ({@code EntityResource.addHref}) and search documents ({@code SearchIndex}).
 * ADR:2026-11-02-references-to-styled-entities-carry-their-colour-and-icon
 */
@Slf4j
public final class ReferenceStyles {
  private static final Set<String> STYLED_ENTITY_TYPES = Set.of(Entity.DOMAIN, Entity.DATA_PRODUCT);

  // Keyed by the entity's JSON string in CACHE_WITH_ID, compared by identity (weakKeys). An update,
  // a cross-instance eviction or a TTL expiry replaces that string, so a style here is never staler
  // than the entity cache and needs no invalidation of its own.
  private static final Cache<String, Optional<Style>> STYLE_BY_ENTITY_JSON =
      CacheBuilder.newBuilder().weakKeys().maximumSize(1000).build();

  private ReferenceStyles() {}

  public static boolean isStyledEntityType(String entityType) {
    return STYLED_ENTITY_TYPES.contains(entityType);
  }

  public static void apply(List<EntityReference> references) {
    listOrEmpty(references).forEach(ReferenceStyles::apply);
  }

  public static void apply(EntityReference reference) {
    if (isStyledReference(reference)) {
      reference.setStyle(lookup(reference.getType(), reference.getId()).orElse(null));
    }
  }

  /** A reference carries only the colour and icon; the cover image stays on the entity. */
  public static Optional<Style> toReferenceStyle(Style style) {
    return Optional.ofNullable(style)
        .filter(value -> value.getColor() != null || value.getIconURL() != null)
        .map(value -> new Style().withColor(value.getColor()).withIconURL(value.getIconURL()));
  }

  private static boolean isStyledReference(EntityReference reference) {
    return reference != null
        && reference.getId() != null
        && isStyledEntityType(reference.getType());
  }

  private static Optional<Style> lookup(String entityType, UUID id) {
    String entityJson =
        EntityRepository.CACHE_WITH_ID.getIfPresent(new ImmutablePair<>(entityType, id));
    return entityJson != null ? styleOfCachedJson(entityJson) : styleOfEntity(entityType, id);
  }

  private static Optional<Style> styleOfCachedJson(String entityJson) {
    try {
      return STYLE_BY_ENTITY_JSON.get(entityJson, () -> parseStyle(entityJson));
    } catch (ExecutionException | UncheckedExecutionException e) {
      LOG.warn("Could not read the style from a cached entity", e);
      return Optional.empty();
    }
  }

  // L1 miss: find() goes through the negative cache, Redis L2 and the load-race guard, and fills L1
  // so the next reference to the same entity reads the cached JSON.
  private static Optional<Style> styleOfEntity(String entityType, UUID id) {
    try {
      return toReferenceStyle(Entity.getEntityRepository(entityType).find(id, ALL).getStyle());
    } catch (EntityNotFoundException e) {
      return Optional.empty();
    }
  }

  private static Optional<Style> parseStyle(String entityJson) {
    JsonNode style = JsonUtils.readTree(entityJson).get(Entity.FIELD_STYLE);
    return style != null && style.isObject()
        ? toReferenceStyle(JsonUtils.treeToValue(style, Style.class))
        : Optional.empty();
  }
}
