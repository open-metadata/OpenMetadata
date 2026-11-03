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

import static org.openmetadata.service.Entity.DATA_PRODUCT;
import static org.openmetadata.service.Entity.DOMAIN;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.domains.DomainStyles;
import org.openmetadata.schema.api.domains.EntityStyle;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.type.Style;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Reads the colour and icon of every styled domain and data product, which clients look up by the
 * id their references hold, so references stay identity-only.
 * ADR:2026-11-02-domain-chips-resolve-their-style-by-domain-id
 */
public class DomainStyleReader {
  private final CollectionDAO daoCollection;

  public DomainStyleReader(CollectionDAO daoCollection) {
    this.daoCollection = daoCollection;
  }

  public DomainStyles listStyles() {
    List<EntityStyle> styles =
        new ArrayList<>(
            toEntityStyles(DOMAIN, Domain.class, daoCollection.domainDAO().listStyledJson()));
    styles.addAll(
        toEntityStyles(
            DATA_PRODUCT, DataProduct.class, daoCollection.dataProductDAO().listStyledJson()));
    return new DomainStyles().withData(styles);
  }

  /** A chip draws only the colour and icon; the cover image stays on the entity. */
  static Optional<Style> toChipStyle(Style style) {
    return Optional.ofNullable(style)
        .filter(value -> value.getColor() != null || value.getIconURL() != null)
        .map(value -> new Style().withColor(value.getColor()).withIconURL(value.getIconURL()));
  }

  private static <E extends EntityInterface<?>> List<EntityStyle> toEntityStyles(
      String entityType, Class<E> entityClass, List<String> entityJsons) {
    return entityJsons.stream()
        .map(json -> JsonUtils.readValue(json, entityClass))
        .flatMap(entity -> toEntityStyle(entityType, entity).stream())
        .toList();
  }

  private static Optional<EntityStyle> toEntityStyle(String entityType, EntityInterface<?> entity) {
    return toChipStyle(entity.getStyle())
        .map(
            style ->
                new EntityStyle().withId(entity.getId()).withType(entityType).withStyle(style));
  }
}
