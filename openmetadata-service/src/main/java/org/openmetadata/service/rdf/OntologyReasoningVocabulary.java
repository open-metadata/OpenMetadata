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

/**
 * Control vocabulary of the reasoning input: the member records beside each ontology graph, the
 * version manifests that pin a closure, and the activation index. It lives in its own namespace,
 * not the catalog vocabulary, because it describes graphs rather than metadata, and the reasoner
 * never receives it as input. docs/rdf-ontology-contract.md documents every term.
 *
 * <p>See ADR:2026-10-15-reasoning-closures-are-approved-graphs-pinned-by-a-content-manifest.
 */
public final class OntologyReasoningVocabulary {
  public static final String NS = "https://open-metadata.org/reasoning/";

  public static final String ONTOLOGY_GRAPH = NS + "OntologyGraph";
  public static final String GRAPH_OF = NS + "graphOf";
  public static final String ENTITY_TYPE = NS + "entityType";
  public static final String LIFECYCLE_STATUS = NS + "lifecycleStatus";
  public static final String CONTENT_DIGEST = NS + "contentDigest";
  public static final String TRIPLE_COUNT = NS + "tripleCount";
  public static final String GLOSSARY = NS + "glossary";
  public static final String DEFINES_PROPERTY = NS + "definesProperty";
  public static final String USES_PROPERTY = NS + "usesProperty";

  public static final String ONTOLOGY_VERSION = NS + "OntologyVersion";
  public static final String ONTOLOGY = NS + "ontology";
  public static final String SELECTION = NS + "selection";
  public static final String CLOSURE_DIGEST = NS + "closureDigest";
  public static final String DIGEST_ALGORITHM = NS + "digestAlgorithm";
  public static final String MEMBER_COUNT = NS + "memberCount";
  public static final String IMPORTS_MANIFEST = NS + "importsManifest";
  public static final String PINNED_DIGEST = NS + "pinnedDigest";
  public static final String CANDIDATE_GRAPH = NS + "candidateGraph";
  public static final String CREATED_AT = NS + "createdAt";

  public static final String ACTIVE_VERSION = NS + "activeVersion";
  public static final String ACTIVE_MANIFEST = NS + "activeManifest";

  private OntologyReasoningVocabulary() {}
}
