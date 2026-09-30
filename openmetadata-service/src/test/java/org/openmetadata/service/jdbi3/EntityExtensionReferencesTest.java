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

package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.stream.StreamSupport;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.utils.JsonUtils;

/** A client may echo a value it read before the sweep ran; ids already marked dead are dropped. */
class EntityExtensionReferencesTest {
  private static final UUID HOLDER = UUID.randomUUID();
  private static final String KEY = "domain.customProperties.owningTeams";
  private static final String DEAD = UUID.randomUUID().toString();
  private static final String LIVE = UUID.randomUUID().toString();
  private static final String ADDED = UUID.randomUUID().toString();

  private CollectionDAO.EntityExtensionReferenceDAO ledger;
  private EntityExtensionReferences references;

  @BeforeEach
  void setUp() {
    CollectionDAO daoCollection = mock(CollectionDAO.class);
    ledger = mock(CollectionDAO.EntityExtensionReferenceDAO.class);
    when(daoCollection.entityExtensionReferenceDAO()).thenReturn(ledger);
    when(ledger.findPendingToIds(any(), any())).thenReturn(List.of(DEAD));
    references = new EntityExtensionReferences(daoCollection);
  }

  @Test
  void dropsMarkedIdsFromAnEchoedList() {
    ObjectNode extension = extension("{\"owningTeams\":[%s,%s,%s]}", DEAD, LIVE, ADDED);

    assertTrue(references.dropPending(extension, "owningTeams"::equals, HOLDER, KEY));

    assertEquals(List.of(LIVE, ADDED), ids(extension));
  }

  @Test
  void removesAPropertyItEmpties() {
    ObjectNode extension = extension("{\"owningTeams\":[%s]}", DEAD);

    assertTrue(references.dropPending(extension, "owningTeams"::equals, HOLDER, KEY));

    assertFalse(extension.has("owningTeams"));
  }

  @Test
  void removesASingleReferenceToAMarkedId() {
    ObjectNode extension = extension("{\"owningTeams\":%s}", DEAD);

    assertTrue(references.dropPending(extension, "owningTeams"::equals, HOLDER, KEY));

    assertFalse(extension.has("owningTeams"));
  }

  @Test
  void leavesValuesWithoutMarkedIdsAlone() {
    when(ledger.findPendingToIds(any(), any())).thenReturn(List.of());
    ObjectNode extension = extension("{\"owningTeams\":[%s]}", LIVE);

    assertFalse(references.dropPending(extension, "owningTeams"::equals, HOLDER, KEY));

    assertEquals(List.of(LIVE), ids(extension));
  }

  @Test
  void leavesPropertiesOutsideThePredicateAlone() {
    ObjectNode extension = extension("{\"reviewers\":[%s]}", DEAD);

    assertFalse(references.dropPending(extension, "owningTeams"::equals, HOLDER, KEY));

    assertTrue(extension.has("reviewers"));
  }

  private static ObjectNode extension(String template, String... ids) {
    Object[] refs =
        Arrays.stream(ids).map(id -> "{\"id\":\"" + id + "\",\"type\":\"team\"}").toArray();
    return (ObjectNode) JsonUtils.readTree(String.format(template, refs));
  }

  private static List<String> ids(ObjectNode extension) {
    return StreamSupport.stream(extension.get("owningTeams").spliterator(), false)
        .map(ref -> ref.get("id").asText())
        .toList();
  }
}
