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
package org.openmetadata.service.rdf;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.rdf.storage.RdfStorageInterface;
import org.openmetadata.service.rdf.translator.JsonLdTranslator;
import org.openmetadata.service.rdf.translator.LiveTagLookup;
import org.openmetadata.service.rdf.translator.ReferenceScope;

/** The reindex resolves the labels of a page together, not entity by entity. */
class RdfReindexLabelLookupTest {
  private static final String BASE = "https://open-metadata.org/";
  private static final int ENTITIES = 1_000;
  private static final int PAGE_SIZE = 100;
  private static final int TAGS = 50;
  private static final int TERMS = 10;

  private final AtomicInteger lookups = new AtomicInteger();
  private final LiveTagLookup countingLookup =
      (type, fqns) -> {
        lookups.incrementAndGet();
        return fqns.stream()
            .collect(
                Collectors.toMap(
                    fqn -> fqn,
                    fqn -> UUID.nameUUIDFromBytes((type + fqn).getBytes(StandardCharsets.UTF_8))));
      };

  @BeforeAll
  static void registerType() {
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put("table", Entity.TABLE);
  }

  @Test
  void aReindexPageResolvesItsLabelsWithOneLookupPerLabelType() {
    final RdfRepository repository =
        new RdfRepository(
            new RdfConfiguration().withEnabled(true).withBaseUri(URI.create(BASE)),
            mock(RdfStorageInterface.class),
            new JsonLdTranslator(
                JsonUtils.getObjectMapper(), BASE, countingLookup, ReferenceScope.LIVE));
    final List<Table> tables = labelledTables();
    int translated = 0;
    for (int start = 0; start < ENTITIES; start += PAGE_SIZE) {
      translated += repository.translateEntities(tables.subList(start, start + PAGE_SIZE)).size();
    }

    assertEquals(ENTITIES, translated);
    assertEquals(2 * ENTITIES / PAGE_SIZE, lookups.get(), "one lookup per label type per page");
  }

  private static List<Table> labelledTables() {
    final List<Table> tables = new ArrayList<>(ENTITIES);
    for (int index = 0; index < ENTITIES; index++) {
      final String fqn = "service.db.schema.table" + index;
      final List<Column> columns = new ArrayList<>();
      for (int column = 0; column < 3; column++) {
        columns.add(
            new Column()
                .withName("c" + column)
                .withFullyQualifiedName(fqn + ".c" + column)
                .withDataType(ColumnDataType.STRING)
                .withTags(List.of(tag((index + column) % TAGS))));
      }
      tables.add(
          new Table()
              .withId(UUID.randomUUID())
              .withName("table" + index)
              .withFullyQualifiedName(fqn)
              .withColumns(columns)
              .withTags(List.of(tag(index % TAGS), tag((index + 7) % TAGS), term(index % TERMS))));
    }
    return tables;
  }

  private static TagLabel tag(final int index) {
    return label("PII.Tag" + index, TagLabel.TagSource.CLASSIFICATION);
  }

  private static TagLabel term(final int index) {
    return label("Business.Term" + index, TagLabel.TagSource.GLOSSARY);
  }

  private static TagLabel label(final String fqn, final TagLabel.TagSource source) {
    return new TagLabel()
        .withTagFQN(fqn)
        .withSource(source)
        .withLabelType(TagLabel.LabelType.MANUAL)
        .withState(TagLabel.State.CONFIRMED);
  }
}
