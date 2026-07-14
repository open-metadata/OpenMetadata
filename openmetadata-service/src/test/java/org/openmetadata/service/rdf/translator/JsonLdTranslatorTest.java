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

package org.openmetadata.service.rdf.translator;

import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.UUID;
import java.util.stream.StreamSupport;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.service.rdf.RdfUtils;

class JsonLdTranslatorTest {

  private static final String BASE_URI = "https://example.openmetadata.org/";

  @Test
  void assignsStableIdentifiersToNestedColumns() {
    String tableFqn = "service.database.schema.orders";
    String parentFqn = tableFqn + ".customer";
    String childFqn = parentFqn + ".email";
    Column child = new Column().withName("email").withFullyQualifiedName(childFqn);
    Column parent =
        new Column()
            .withName("customer")
            .withFullyQualifiedName(parentFqn)
            .withChildren(List.of(child));
    Table table =
        new Table()
            .withId(UUID.randomUUID())
            .withName("orders")
            .withFullyQualifiedName(tableFqn)
            .withColumns(List.of(parent));

    JsonNode document =
        new JsonLdTranslator(new ObjectMapper(), BASE_URI, ignored -> "table").toJsonLd(table);

    assertTrue(containsIdentifier(document, RdfUtils.columnUri(BASE_URI, parentFqn)));
    assertTrue(containsIdentifier(document, RdfUtils.columnUri(BASE_URI, childFqn)));
  }

  private static boolean containsIdentifier(JsonNode node, String identifier) {
    return identifier.equals(node.path("@id").asText())
        || StreamSupport.stream(node.spliterator(), false)
            .anyMatch(child -> containsIdentifier(child, identifier));
  }
}
