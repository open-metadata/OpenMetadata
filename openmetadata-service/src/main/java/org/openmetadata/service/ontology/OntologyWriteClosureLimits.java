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

/**
 * Bounds on the rows one ontology write may load to validate itself. They bound a write's
 * neighbourhood, not the size of the ontology, so they do not follow {@link
 * OntologyReleaseManifest#MAX_MEMBERS}. Their values are unchanged.
 */
public final class OntologyWriteClosureLimits {
  /** Declarations, dependents, ancestors, inverse partners and disjointness axioms of a write. */
  public static final int WORKING_MODEL_CLOSURE = 10_000;

  /** Ancestor axioms walked when a concept binding inherits. */
  public static final int BINDING_ANCESTORS = 10_000;

  /** Declarations and inverse pointers around the properties a write changes. */
  public static final int PROPERTY_NEIGHBOURHOOD = 10_000;

  /** References and declarations loaded to describe the impact of deleting a concept. */
  public static final int CONCEPT_DELETION_IMPACT = 10_000;

  /** Axioms read to resolve the hierarchy of one page of concepts. */
  public static final int CONCEPT_HIERARCHY_EDGES = 10_000;

  private OntologyWriteClosureLimits() {}
}
