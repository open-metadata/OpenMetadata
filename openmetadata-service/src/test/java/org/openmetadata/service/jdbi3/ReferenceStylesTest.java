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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.List;
import java.util.UUID;
import org.apache.commons.lang3.tuple.ImmutablePair;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.type.CoverImage;
import org.openmetadata.schema.entity.type.Style;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;

class ReferenceStylesTest {
  private final UUID domainId = UUID.randomUUID();
  private final UUID dataProductId = UUID.randomUUID();

  @AfterEach
  void evictCachedEntities() {
    EntityRepository.CACHE_WITH_ID.invalidate(new ImmutablePair<>(Entity.DOMAIN, domainId));
    EntityRepository.CACHE_WITH_ID.invalidate(
        new ImmutablePair<>(Entity.DATA_PRODUCT, dataProductId));
  }

  @Test
  void stylesReferencesToDomainsAndDataProductsWithColourAndIconOnly() {
    cacheDomain(
        new Style()
            .withColor("#F14C75")
            .withIconURL("Database01")
            .withCoverImage(new CoverImage().withUrl("https://example.com/cover.png")));
    cache(
        Entity.DATA_PRODUCT,
        dataProductId,
        new DataProduct()
            .withId(dataProductId)
            .withName("orders")
            .withStyle(new Style().withColor("#12B76A")));
    EntityReference domain = reference(Entity.DOMAIN, domainId);
    EntityReference dataProduct = reference(Entity.DATA_PRODUCT, dataProductId);

    ReferenceStyles.apply(List.of(domain, dataProduct));

    assertEquals(new Style().withColor("#F14C75").withIconURL("Database01"), domain.getStyle());
    assertEquals(new Style().withColor("#12B76A"), dataProduct.getStyle());
  }

  @Test
  void restyledEntityIsReadFromTheReplacedCacheEntry() {
    cacheDomain(new Style().withColor("#F14C75"));
    EntityReference before = reference(Entity.DOMAIN, domainId);
    ReferenceStyles.apply(before);

    cacheDomain(new Style().withColor("#1470EF").withIconURL("Globe01"));
    EntityReference after = reference(Entity.DOMAIN, domainId);
    ReferenceStyles.apply(after);

    assertEquals("#F14C75", before.getStyle().getColor());
    assertEquals(new Style().withColor("#1470EF").withIconURL("Globe01"), after.getStyle());
  }

  @Test
  void leavesUnstyledAndUnknownEntitiesWithoutStyle() {
    cacheDomain(null);
    EntityReference unstyled = reference(Entity.DOMAIN, domainId);
    EntityReference unknown = reference(Entity.DATA_PRODUCT, dataProductId);
    EntityReference owner = reference(Entity.USER, domainId);

    ReferenceStyles.apply(List.of(unstyled, unknown, owner));

    assertNull(unstyled.getStyle(), "a domain without colour or icon");
    assertNull(unknown.getStyle(), "an entity that cannot be found");
    assertNull(owner.getStyle(), "a reference to an entity type without a style");
  }

  private void cacheDomain(Style style) {
    cache(
        Entity.DOMAIN,
        domainId,
        new Domain().withId(domainId).withName("marketing").withStyle(style));
  }

  private static void cache(String entityType, UUID id, Object entity) {
    EntityRepository.CACHE_WITH_ID.put(
        new ImmutablePair<>(entityType, id), JsonUtils.pojoToJson(entity));
  }

  private static EntityReference reference(String entityType, UUID id) {
    return new EntityReference().withId(id).withType(entityType);
  }
}
