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

package org.openmetadata.service.ontology;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.utils.JsonUtils;

class OntologyChangeEventPublisherTest {

  @Test
  void publishesTypedOntologyEventsWithEntityContext() {
    final List<String> storedEvents = new ArrayList<>();
    final Clock clock = Clock.fixed(Instant.ofEpochMilli(1234), ZoneOffset.UTC);
    final Glossary glossary =
        new Glossary()
            .withId(UUID.randomUUID())
            .withName("governance")
            .withFullyQualifiedName("governance")
            .withVersion(0.3);

    new OntologyChangeEventPublisher(storedEvents::add, clock)
        .publish(EventType.ONTOLOGY_IMPORTED, glossary, "steward");

    final ChangeEvent event = JsonUtils.readValue(storedEvents.getFirst(), ChangeEvent.class);
    assertEquals(EventType.ONTOLOGY_IMPORTED, event.getEventType());
    assertEquals(glossary.getId(), event.getEntityId());
    assertEquals("glossary", event.getEntityType());
    assertEquals("steward", event.getUserName());
    assertEquals(1234, event.getTimestamp());
  }
}
