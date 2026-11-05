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

import java.net.URI;
import java.util.Set;
import java.util.TreeSet;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.type.OntologyExpression;

/**
 * The class IRIs an axiom or property states a fact about, in IRI order. Individuals and property
 * IRIs are left out because they are not concepts.
 */
public final class OntologyConceptReferences {
  private OntologyConceptReferences() {}

  public static Set<String> of(final OntologyAxiom axiom) {
    final Set<String> referenced = new TreeSet<>();
    add(axiom.getSubjectIri(), referenced);
    add(axiom.getTargetIri(), referenced);
    listOrEmpty(axiom.getExpressions()).forEach(expression -> add(expression, referenced));
    return referenced;
  }

  public static Set<String> of(final OntologyProperty property) {
    final Set<String> referenced = new TreeSet<>();
    listOrEmpty(property.getDomain()).forEach(iri -> add(iri, referenced));
    listOrEmpty(property.getRange()).forEach(iri -> add(iri, referenced));
    return referenced;
  }

  private static void add(final URI iri, final Set<String> into) {
    if (iri != null) {
      into.add(iri.toString());
    }
  }

  private static void add(final OntologyExpression expression, final Set<String> into) {
    if (expression == null) {
      return;
    }
    add(expression.getClassIri(), into);
    listOrEmpty(expression.getOperands()).forEach(operand -> add(operand, into));
    add(expression.getFiller(), into);
  }
}
