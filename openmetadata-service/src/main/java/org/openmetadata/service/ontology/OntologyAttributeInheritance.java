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

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.net.URI;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.OntologyAttribute;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Computes the effective attribute set of an ontology concept.
 *
 * <p>OWL scopes a datatype property to a class through {@code rdfs:domain}, and subsumption carries
 * that property to every subclass. This class materializes the same view for readers: a concept's
 * own attributes plus those declared by its ancestors, with nearer declarations shadowing farther
 * ones. Inherited entries are copies flagged with {@code inherited} and the ancestor that declares
 * them, so callers can render provenance and so a read-modify-write of {@code attributes} can never
 * persist an ancestor's declaration onto a descendant.
 */
public final class OntologyAttributeInheritance {
  private OntologyAttributeInheritance() {}

  /**
   * Merge a concept's own attributes with those effective on its parent.
   *
   * @param ownAttributes attributes declared by the concept itself
   * @param parentEffectiveAttributes parent's already-resolved effective attributes
   * @param parentReference parent that contributes attributes it declares itself
   */
  public static List<OntologyAttribute> merge(
      final List<OntologyAttribute> ownAttributes,
      final List<OntologyAttribute> parentEffectiveAttributes,
      final EntityReference parentReference) {
    final List<OntologyAttribute> effective = new ArrayList<>();
    final AttributeKeyspace keyspace = new AttributeKeyspace();
    for (final OntologyAttribute own : listOrEmpty(ownAttributes)) {
      if (own != null && keyspace.claim(own)) {
        effective.add(asDeclared(own));
      }
    }
    for (final OntologyAttribute ancestor : listOrEmpty(parentEffectiveAttributes)) {
      if (ancestor != null && keyspace.claim(ancestor)) {
        effective.add(asInherited(ancestor, parentReference));
      }
    }
    return effective;
  }

  private static OntologyAttribute asDeclared(final OntologyAttribute attribute) {
    return copyOf(attribute).withInherited(false).withDeclaringTerm(null);
  }

  /**
   * An attribute arriving from a grandparent already carries the concept that declares it; only a
   * first-generation inherited attribute takes the immediate parent as its declaring concept.
   */
  private static OntologyAttribute asInherited(
      final OntologyAttribute attribute, final EntityReference parentReference) {
    final EntityReference declaringTerm =
        attribute.getDeclaringTerm() != null ? attribute.getDeclaringTerm() : parentReference;
    return copyOf(attribute).withInherited(true).withDeclaringTerm(declaringTerm);
  }

  /** Ancestor attributes may be served from a shared inheritance cache and must not be mutated. */
  private static OntologyAttribute copyOf(final OntologyAttribute attribute) {
    return JsonUtils.deepCopy(attribute, OntologyAttribute.class);
  }

  /**
   * Tracks the names and IRIs already contributed to an effective set. An attribute is shadowed when
   * either identity collides, so a concept can override an ancestor's attribute by reusing its name
   * or its IRI.
   */
  private static final class AttributeKeyspace {
    private final Set<String> names = new HashSet<>();
    private final Set<URI> iris = new HashSet<>();

    private boolean claim(final OntologyAttribute attribute) {
      final String name = normalizedName(attribute);
      final URI iri = attribute.getIri();
      if (names.contains(name) || (iri != null && iris.contains(iri))) {
        return false;
      }
      names.add(name);
      if (iri != null) {
        iris.add(iri);
      }
      return true;
    }

    private String normalizedName(final OntologyAttribute attribute) {
      final String name = attribute.getName() == null ? null : attribute.getName().toString();
      return nullOrEmpty(name) ? "" : name.toLowerCase(Locale.ROOT);
    }
  }
}
