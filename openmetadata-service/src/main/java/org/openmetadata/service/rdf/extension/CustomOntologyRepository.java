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

import java.time.Clock;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import org.openmetadata.schema.api.configuration.rdf.CustomOntology;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.CollectionDAO.RdfCustomOntologyDAO;

/** Durable storage for user-authored ontology extensions. */
public final class CustomOntologyRepository {
  private final RdfCustomOntologyDAO ontologyDAO;
  private final Clock clock;

  public CustomOntologyRepository(final RdfCustomOntologyDAO ontologyDAO, final Clock clock) {
    this.ontologyDAO = Objects.requireNonNull(ontologyDAO);
    this.clock = Objects.requireNonNull(clock);
  }

  public List<CustomOntology> list() {
    return ontologyDAO.list().stream().map(CustomOntologyRepository::deserialize).toList();
  }

  public Optional<CustomOntology> get(final String name) {
    return Optional.ofNullable(ontologyDAO.findByName(name))
        .map(CustomOntologyRepository::deserialize);
  }

  /** @return true when the extension was created, false when it replaced an existing extension. */
  public boolean upsert(final CustomOntology extension) {
    requireValid(extension);
    final String json = JsonUtils.pojoToJson(extension);
    final long updatedAt = clock.millis();
    final boolean created = ontologyDAO.insertIfAbsent(extension.getName(), json, updatedAt) == 1;
    if (!created) {
      ontologyDAO.update(extension.getName(), json, updatedAt);
    }
    return created;
  }

  public boolean delete(final String name) {
    return ontologyDAO.delete(name) == 1;
  }

  private static void requireValid(final CustomOntology extension) {
    final List<String> errors = CustomOntologyValidator.validate(extension);
    if (!errors.isEmpty()) {
      throw new IllegalArgumentException(
          "Invalid ontology extension: " + String.join("; ", errors));
    }
  }

  private static CustomOntology deserialize(final String json) {
    return JsonUtils.readValue(json, CustomOntology.class);
  }
}
