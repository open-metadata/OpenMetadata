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

import java.util.UUID;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.jdbi3.GlossaryRepository;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;
import org.openmetadata.service.jdbi3.RelationshipTypeRepository;

public final class OpenMetadataOntologyAiCatalog implements OntologyAiCatalog {
  private final GlossaryRepository glossaryRepository;
  private final GlossaryTermRepository termRepository;
  private final RelationshipTypeRepository relationshipTypeRepository;

  public OpenMetadataOntologyAiCatalog(
      final GlossaryRepository glossaryRepository,
      final GlossaryTermRepository termRepository,
      final RelationshipTypeRepository relationshipTypeRepository) {
    this.glossaryRepository = glossaryRepository;
    this.termRepository = termRepository;
    this.relationshipTypeRepository = relationshipTypeRepository;
  }

  @Override
  public Glossary glossary(final String fullyQualifiedName) {
    return glossaryRepository.getByName(
        null, fullyQualifiedName, glossaryRepository.getFields("ontologyConfiguration"));
  }

  @Override
  public GlossaryTerm term(final UUID id) {
    return termRepository.get(
        null, id, termRepository.getFields("glossary"), Include.NON_DELETED, false);
  }

  @Override
  public RelationshipType relationshipType(final UUID id) {
    return relationshipTypeRepository.get(
        null, id, relationshipTypeRepository.getFields("domain,range"), Include.NON_DELETED, false);
  }
}
