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

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.entity.data.RelationshipType;

/**
 * Everything one glossary's ontology projection reads, loaded before any RDF is built.
 *
 * @param externalTermIris class IRIs of terms in other glossaries that this glossary's terms relate
 *     to, keyed by term ID
 */
record GlossaryOntologySource(
    Glossary glossary,
    List<GlossaryTerm> terms,
    List<OntologyAxiom> axioms,
    List<RelationshipType> relationshipTypes,
    Map<UUID, String> externalTermIris) {
  GlossaryOntologySource {
    terms = List.copyOf(terms);
    axioms = List.copyOf(axioms);
    relationshipTypes = List.copyOf(relationshipTypes);
    externalTermIris = Map.copyOf(externalTermIris);
  }
}
