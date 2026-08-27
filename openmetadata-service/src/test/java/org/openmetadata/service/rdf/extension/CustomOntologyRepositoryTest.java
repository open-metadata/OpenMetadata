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

package org.openmetadata.service.rdf.extension;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.configuration.rdf.CustomOntology;
import org.openmetadata.schema.api.configuration.rdf.CustomOntologyClass;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.CollectionDAO.RdfCustomOntologyDAO;

class CustomOntologyRepositoryTest {
  private static final long NOW = 1_750_000_000_000L;
  private RdfCustomOntologyDAO ontologyDAO;
  private CustomOntologyRepository repository;

  @BeforeEach
  void setUp() {
    ontologyDAO = mock(RdfCustomOntologyDAO.class);
    repository =
        new CustomOntologyRepository(
            ontologyDAO, Clock.fixed(Instant.ofEpochMilli(NOW), ZoneOffset.UTC));
  }

  @Test
  void createsNewExtensionsDurably() {
    CustomOntology extension = extension("customer-model");
    when(ontologyDAO.insertIfAbsent(anyString(), anyString(), anyLong())).thenReturn(1);

    assertTrue(repository.upsert(extension));

    verify(ontologyDAO).insertIfAbsent("customer-model", JsonUtils.pojoToJson(extension), NOW);
    verify(ontologyDAO, never()).update(anyString(), anyString(), anyLong());
  }

  @Test
  void replacesExistingExtensionsDurably() {
    CustomOntology extension = extension("customer-model");
    when(ontologyDAO.insertIfAbsent(anyString(), anyString(), anyLong())).thenReturn(0);
    when(ontologyDAO.update(anyString(), anyString(), anyLong())).thenReturn(1);

    assertFalse(repository.upsert(extension));

    verify(ontologyDAO).update("customer-model", JsonUtils.pojoToJson(extension), NOW);
  }

  @Test
  void independentRepositoryInstancesReadTheSamePersistedExtension() {
    CustomOntology extension = extension("customer-model");
    when(ontologyDAO.findByName("customer-model")).thenReturn(JsonUtils.pojoToJson(extension));
    CustomOntologyRepository reloaded =
        new CustomOntologyRepository(ontologyDAO, Clock.systemUTC());

    assertEquals(extension, repository.get("customer-model").orElseThrow());
    assertEquals(extension, reloaded.get("customer-model").orElseThrow());

    verify(ontologyDAO, times(2)).findByName("customer-model");
  }

  @Test
  void listsAndDeletesPersistedExtensions() {
    CustomOntology first = extension("customer-model");
    CustomOntology second = extension("product-model");
    when(ontologyDAO.list())
        .thenReturn(List.of(JsonUtils.pojoToJson(first), JsonUtils.pojoToJson(second)));
    when(ontologyDAO.delete("customer-model")).thenReturn(1);

    assertEquals(List.of(first, second), repository.list());
    assertTrue(repository.delete("customer-model"));
  }

  @Test
  void rejectsInvalidExtensionsBeforeWriting() {
    CustomOntology invalid = new CustomOntology().withName("invalid-model");

    assertThrows(IllegalArgumentException.class, () -> repository.upsert(invalid));

    verify(ontologyDAO, never()).insertIfAbsent(anyString(), anyString(), anyLong());
  }

  private static CustomOntology extension(final String name) {
    return new CustomOntology()
        .withName(name)
        .withClasses(
            List.of(
                new CustomOntologyClass()
                    .withUri("https://open-metadata.org/ontology-extension/Customer")
                    .withSubClassOf(List.of("om:Entity"))));
  }
}
