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
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.rdf.model.Property;
import org.apache.jena.rdf.model.RDFNode;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.rdf.model.ResourceFactory;
import org.apache.jena.shacl.ShaclValidator;
import org.apache.jena.shacl.Shapes;
import org.apache.jena.shacl.vocabulary.SHACL;
import org.apache.jena.vocabulary.OWL2;
import org.openmetadata.schema.OntologyDefinition;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.type.NativeOntologyShaclReport;
import org.openmetadata.schema.type.OntologyConceptType;
import org.openmetadata.schema.type.OntologyPropertyKind;
import org.openmetadata.schema.type.OntologyReleaseMember;
import org.openmetadata.service.ontology.OntologyReleaseReader;
import org.openmetadata.service.rdf.RdfShaclValidator.ShapeSet;

public final class NativeOntologyValidation {
  private static final Property TARGET_CLASS =
      ResourceFactory.createProperty(SHACL.NS, "targetClass");
  private static final Property TARGET_NODE =
      ResourceFactory.createProperty(SHACL.NS, "targetNode");
  private final OntologyReleaseProjection projection = new OntologyReleaseProjection();
  private final RdfShaclReportMapper mapper = new RdfShaclReportMapper();

  public NativeOntologyShaclReport validate(
      final OntologyRelease release, final List<OntologyReleaseMember> members) {
    final Model localShapes = boundShapes(release, members);
    try {
      final Model data = projection.build(release, members);
      try {
        return mapper.mapNative(
            ShaclValidator.get().validate(Shapes.parse(localShapes.getGraph()), data.getGraph()));
      } finally {
        data.close();
      }
    } finally {
      localShapes.close();
    }
  }

  private static Model boundShapes(
      final OntologyRelease release, final List<OntologyReleaseMember> members) {
    final Model copy = ModelFactory.createDefaultModel();
    try {
      copy.add(
          ModelFactory.createModelForGraph(
              RdfShaclValidator.shapes(ShapeSet.NATIVE_ONTOLOGY).getGraph()));
      final List<OntologyDefinition> definitions =
          members.stream()
              .map(member -> OntologyReleaseReader.definition(release, member))
              .toList();
      final var targets = copy.listStatements(null, TARGET_CLASS, (RDFNode) null).toList();
      for (final var target : targets) {
        copy.remove(target);
        targetIris(definitions, target.getResource())
            .forEach(iri -> copy.add(target.getSubject(), TARGET_NODE, copy.createResource(iri)));
      }
      return copy;
    } catch (RuntimeException failure) {
      copy.close();
      throw failure;
    }
  }

  private static List<String> targetIris(
      final List<OntologyDefinition> definitions, final Resource targetClass) {
    if (OWL2.Class.equals(targetClass)) {
      return definitions.stream()
          .filter(OntologyConcept.class::isInstance)
          .map(OntologyConcept.class::cast)
          .filter(concept -> concept.getConceptType() != OntologyConceptType.SKOS_CONCEPT)
          .map(concept -> concept.getIri().toString())
          .distinct()
          .toList();
    }
    if (OWL2.DatatypeProperty.equals(targetClass)) {
      return definitions.stream()
          .filter(OntologyProperty.class::isInstance)
          .map(OntologyProperty.class::cast)
          .filter(property -> property.getKind() == OntologyPropertyKind.DATA)
          .map(property -> property.getIri().toString())
          .distinct()
          .toList();
    }
    throw new IllegalStateException("Unexpected native ontology shape target: " + targetClass);
  }
}
