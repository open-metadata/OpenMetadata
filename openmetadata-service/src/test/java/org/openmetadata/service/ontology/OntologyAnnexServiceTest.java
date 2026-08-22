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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.OntologyAnnexRevision;
import org.openmetadata.schema.type.OntologyAnnexSource;
import org.openmetadata.service.jdbi3.CollectionDAO.OntologyAnnexDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.OntologyAnnexRow;

class OntologyAnnexServiceTest {
  private static final long NOW = 1_750_000_000_000L;

  @Test
  void preservesCanonicalPayloadIdempotently() {
    final UUID glossaryId = UUID.randomUUID();
    final EntityReference glossary =
        new EntityReference().withId(glossaryId).withType("glossary").withName("Commerce");
    final OntologyAnnexDAO dao = mock(OntologyAnnexDAO.class);
    final AtomicReference<OntologyAnnexRow> stored = new AtomicReference<>();
    when(dao.findByChecksum(eq(glossaryId), any())).thenAnswer(invocation -> stored.get());
    when(dao.nextRevision(glossaryId)).thenReturn(1L);
    org.mockito.Mockito.doAnswer(
            invocation -> {
              stored.set(invocation.getArgument(0));
              return null;
            })
        .when(dao)
        .insert(any());
    final OntologyAnnexService service = service(dao, glossary);

    final OntologyAnnexRevision first =
        service.preserve(
            glossaryId,
            "<https://example.org/s> <https://example.org/p> <https://example.org/o> .\n",
            OntologyAnnexSource.IMPORT,
            "steward");
    final OntologyAnnexRevision second =
        service.preserve(
            glossaryId,
            "<https://example.org/s> <https://example.org/p> <https://example.org/o> .\n",
            OntologyAnnexSource.IMPORT,
            "steward");

    assertEquals(1, first.getRevision());
    assertEquals(first.getChecksum(), second.getChecksum());
    assertEquals(NOW, first.getCreatedAt());
    verify(dao, times(1)).insert(any());
  }

  private static OntologyAnnexService service(
      final OntologyAnnexDAO dao, final EntityReference glossary) {
    return new OntologyAnnexService(
        dao,
        new RdfBlankNodeCanonicalizer(),
        Clock.fixed(Instant.ofEpochMilli(NOW), ZoneOffset.UTC),
        ignored -> glossary);
  }
}
