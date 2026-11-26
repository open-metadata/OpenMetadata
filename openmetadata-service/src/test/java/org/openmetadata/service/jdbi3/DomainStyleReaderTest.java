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
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.domains.EntityStyle;
import org.openmetadata.schema.entity.type.CoverImage;
import org.openmetadata.schema.entity.type.Style;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;

class DomainStyleReaderTest {
  private final CollectionDAO daoCollection = mock(CollectionDAO.class, RETURNS_DEEP_STUBS);

  @Test
  void listsTheColourAndIconOfStyledDomainsAndDataProducts() {
    UUID domainId = UUID.randomUUID();
    UUID dataProductId = UUID.randomUUID();
    when(daoCollection.domainDAO().listStyles())
        .thenReturn(
            List.of(
                JsonUtils.pojoToJson(
                    new EntityStyle()
                        .withId(domainId)
                        .withStyle(
                            new Style()
                                .withColor("#F14C75")
                                .withIconURL("Database01")
                                .withCoverImage(new CoverImage().withUrl("cover.png"))))));
    when(daoCollection.dataProductDAO().listStyles())
        .thenReturn(
            List.of(
                JsonUtils.pojoToJson(
                    new EntityStyle()
                        .withId(dataProductId)
                        .withStyle(new Style().withIconURL("Cube01")))));

    List<EntityStyle> styles = new DomainStyleReader(daoCollection).listStyles().getData();

    assertEquals(
        List.of(
            new EntityStyle()
                .withId(domainId)
                .withType(Entity.DOMAIN)
                .withStyle(new Style().withColor("#F14C75").withIconURL("Database01")),
            new EntityStyle()
                .withId(dataProductId)
                .withType(Entity.DATA_PRODUCT)
                .withStyle(new Style().withIconURL("Cube01"))),
        styles);
  }

  // The query matches any stored style object; one holding only a cover image has nothing a chip
  // can draw.
  @Test
  void omitsEntitiesWhoseStyleHasNoColourOrIcon() {
    when(daoCollection.domainDAO().listStyles())
        .thenReturn(
            List.of(
                JsonUtils.pojoToJson(
                    new EntityStyle()
                        .withId(UUID.randomUUID())
                        .withStyle(
                            new Style().withCoverImage(new CoverImage().withUrl("cover.png"))))));
    when(daoCollection.dataProductDAO().listStyles()).thenReturn(List.of());

    assertEquals(List.of(), new DomainStyleReader(daoCollection).listStyles().getData());
  }
}
