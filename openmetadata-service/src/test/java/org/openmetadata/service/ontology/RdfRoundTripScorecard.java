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

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.apache.jena.query.Dataset;
import org.apache.jena.query.DatasetFactory;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.rdf.model.Property;
import org.apache.jena.rdf.model.RDFNode;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.rdf.model.Statement;
import org.apache.jena.riot.Lang;
import org.apache.jena.riot.RDFParser;
import org.apache.jena.vocabulary.OWL2;
import org.apache.jena.vocabulary.RDF;
import org.apache.jena.vocabulary.RDFS;
import org.apache.jena.vocabulary.SKOS;

/** Categorizes exact RDF round-trip preservation across entity and lossless-annex storage. */
public final class RdfRoundTripScorecard {
  private static final List<Property> LABEL_PROPERTIES =
      List.of(RDFS.label, SKOS.prefLabel, SKOS.altLabel, SKOS.hiddenLabel);

  private final RdfBlankNodeCanonicalizer canonicalizer;

  public RdfRoundTripScorecard() {
    this.canonicalizer = new RdfBlankNodeCanonicalizer();
  }

  public Scorecard analyze(
      final String fixture, final Model source, final Model exported, final String annexNQuads) {
    final Model parsedAnnex = parseAnnex(annexNQuads);
    final Model canonicalSource = canonicalize(source);
    final Model canonicalExport = canonicalize(exported);
    final Model canonicalAnnex = canonicalize(parsedAnnex);
    final Model entityProjection = canonicalExport.difference(canonicalAnnex);
    final Scorecard result;
    try {
      final ModelContext context = ModelContext.from(canonicalSource);
      final List<ConstructScore> constructs =
          scoreConstructs(canonicalSource, context, entityProjection, canonicalAnnex);
      result =
          score(
              fixture,
              canonicalSource,
              canonicalExport,
              entityProjection,
              canonicalAnnex,
              constructs);
    } finally {
      closeModels(entityProjection, canonicalAnnex, canonicalExport, canonicalSource, parsedAnnex);
    }
    return result;
  }

  public void writeMarkdown(final Scorecard scorecard, final Path output) throws IOException {
    final Path parent = output.getParent();
    if (parent != null) {
      Files.createDirectories(parent);
    }
    Files.writeString(output, scorecard.toMarkdown());
  }

  private Scorecard score(
      final String fixture,
      final Model source,
      final Model exported,
      final Model entity,
      final Model annex,
      final List<ConstructScore> constructs) {
    final PreservationCounts counts = countPreservation(source, entity, annex);
    final long generated = exported.difference(source).size();
    return new Scorecard(fixture, source.size(), generated, counts, constructs);
  }

  private List<ConstructScore> scoreConstructs(
      final Model source, final ModelContext context, final Model entity, final Model annex) {
    return Arrays.stream(Construct.values())
        .map(construct -> scoreConstruct(construct, source, context, entity, annex))
        .toList();
  }

  private ConstructScore scoreConstruct(
      final Construct construct,
      final Model source,
      final ModelContext context,
      final Model entity,
      final Model annex) {
    final List<Statement> statements =
        source.listStatements().toList().stream()
            .filter(statement -> construct.matches(statement, context))
            .toList();
    final PreservationCounts counts = countPreservation(statements, entity, annex);
    return new ConstructScore(construct, statements.size(), counts);
  }

  private PreservationCounts countPreservation(
      final Model source, final Model entity, final Model annex) {
    return countPreservation(source.listStatements().toList(), entity, annex);
  }

  private PreservationCounts countPreservation(
      final List<Statement> source, final Model entity, final Model annex) {
    final long preservedInEntity = source.stream().filter(entity::contains).count();
    final long preservedInAnnex =
        source.stream()
            .filter(statement -> !entity.contains(statement) && annex.contains(statement))
            .count();
    final long lost = source.size() - preservedInEntity - preservedInAnnex;
    return new PreservationCounts(preservedInEntity, preservedInAnnex, lost);
  }

  private Model canonicalize(final Model source) {
    final String canonicalNTriples = canonicalizer.canonicalize(source);
    final Model canonical = ModelFactory.createDefaultModel();
    RDFParser.fromString(canonicalNTriples).lang(Lang.NTRIPLES).parse(canonical);
    return canonical;
  }

  private Model parseAnnex(final String annexNQuads) {
    final Model annex = ModelFactory.createDefaultModel();
    if (annexNQuads != null && !annexNQuads.isBlank()) {
      addAnnexGraphs(annex, annexNQuads);
    }
    return annex;
  }

  private void addAnnexGraphs(final Model annex, final String annexNQuads) {
    final Dataset dataset = DatasetFactory.createTxnMem();
    try {
      RDFParser.fromString(annexNQuads).lang(Lang.NQUADS).parse(dataset.asDatasetGraph());
      annex.add(dataset.getDefaultModel());
      dataset.listNames().forEachRemaining(name -> annex.add(dataset.getNamedModel(name)));
    } finally {
      dataset.close();
    }
  }

  private static void closeModels(final Model... models) {
    Arrays.stream(models).forEach(Model::close);
  }

  public enum Construct {
    CLASSES("Classes") {
      @Override
      boolean matches(final Statement statement, final ModelContext context) {
        return context.isClassDeclaration(statement);
      }
    },
    SUBCLASS_EDGES("subClassOf edges") {
      @Override
      boolean matches(final Statement statement, final ModelContext context) {
        return statement.getPredicate().equals(RDFS.subClassOf);
      }
    },
    POLYHIERARCHY_EDGES("Polyhierarchy edges") {
      @Override
      boolean matches(final Statement statement, final ModelContext context) {
        return statement.getPredicate().equals(RDFS.subClassOf)
            && context.polyhierarchyClasses().contains(statement.getSubject());
      }
    },
    OBJECT_PROPERTIES("Object properties and characteristics") {
      @Override
      boolean matches(final Statement statement, final ModelContext context) {
        return context.objectProperties().contains(statement.getSubject());
      }
    },
    DATATYPE_PROPERTIES("Datatype properties") {
      @Override
      boolean matches(final Statement statement, final ModelContext context) {
        return context.datatypeProperties().contains(statement.getSubject());
      }
    },
    RESTRICTIONS("OWL restrictions") {
      @Override
      boolean matches(final Statement statement, final ModelContext context) {
        return context.isRestrictionStatement(statement);
      }
    },
    LABELS("Labels") {
      @Override
      boolean matches(final Statement statement, final ModelContext context) {
        return LABEL_PROPERTIES.contains(statement.getPredicate());
      }
    },
    ANNOTATIONS("Annotations") {
      @Override
      boolean matches(final Statement statement, final ModelContext context) {
        return statement.getObject().isLiteral() && !statement.getPredicate().equals(RDF.type);
      }
    };

    private final String label;

    Construct(final String label) {
      this.label = label;
    }

    abstract boolean matches(Statement statement, ModelContext context);

    public String label() {
      return label;
    }
  }

  public record PreservationCounts(long entityModel, long annex, long lost) {}

  public record ConstructScore(
      Construct construct, long sourceTriples, PreservationCounts preservation) {}

  public record Scorecard(
      String fixture,
      long sourceTriples,
      long generatedTriples,
      PreservationCounts preservation,
      List<ConstructScore> constructs) {
    public Scorecard {
      constructs = List.copyOf(constructs);
    }

    public String toMarkdown() {
      final StringBuilder markdown = new StringBuilder();
      appendSummary(markdown);
      appendConstructs(markdown);
      return markdown.toString();
    }

    private void appendSummary(final StringBuilder markdown) {
      markdown
          .append("# RDF round-trip scorecard: ")
          .append(fixture)
          .append("\n\n")
          .append("| Source triples | Entity model | Annex | Lost | Generated |\n")
          .append("| ---: | ---: | ---: | ---: | ---: |\n")
          .append(
              String.format(
                  "| %d | %d | %d | %d | %d |%n%n",
                  sourceTriples,
                  preservation.entityModel(),
                  preservation.annex(),
                  preservation.lost(),
                  generatedTriples));
    }

    private void appendConstructs(final StringBuilder markdown) {
      markdown.append("| Construct | Source | Entity model | Annex | Lost |\n");
      markdown.append("| --- | ---: | ---: | ---: | ---: |\n");
      constructs.forEach(score -> appendConstruct(markdown, score));
    }

    private static void appendConstruct(final StringBuilder markdown, final ConstructScore score) {
      markdown.append(
          String.format(
              "| %s | %d | %d | %d | %d |%n",
              score.construct().label(),
              score.sourceTriples(),
              score.preservation().entityModel(),
              score.preservation().annex(),
              score.preservation().lost()));
    }
  }

  private record ModelContext(
      Set<Resource> objectProperties,
      Set<Resource> datatypeProperties,
      Set<Resource> restrictions,
      Set<Resource> polyhierarchyClasses) {
    private static ModelContext from(final Model model) {
      final Set<Resource> objectProperties = objectProperties(model);
      final Set<Resource> datatypeProperties = subjectsOfType(model, OWL2.DatatypeProperty);
      final Set<Resource> restrictions = restrictionClosure(model);
      final Set<Resource> polyhierarchyClasses = polyhierarchyClasses(model);
      return new ModelContext(
          objectProperties, datatypeProperties, restrictions, polyhierarchyClasses);
    }

    private boolean isClassDeclaration(final Statement statement) {
      return statement.getPredicate().equals(RDF.type)
          && statement.getObject().isResource()
          && isClassType(statement.getResource());
    }

    private boolean isRestrictionStatement(final Statement statement) {
      return restrictions.contains(statement.getSubject())
          || isRestrictedResource(statement.getObject());
    }

    private boolean isRestrictedResource(final RDFNode node) {
      return node.isResource() && restrictions.contains(node.asResource());
    }

    private static boolean isClassType(final Resource type) {
      return type.equals(OWL2.Class) || type.equals(RDFS.Class) || type.equals(SKOS.Concept);
    }

    private static Set<Resource> objectProperties(final Model model) {
      final Set<Resource> properties = subjectsOfType(model, OWL2.ObjectProperty);
      properties.addAll(subjectsOfType(model, OWL2.SymmetricProperty));
      properties.addAll(subjectsOfType(model, OWL2.AsymmetricProperty));
      properties.addAll(subjectsOfType(model, OWL2.TransitiveProperty));
      properties.addAll(subjectsOfType(model, OWL2.FunctionalProperty));
      properties.addAll(subjectsOfType(model, OWL2.InverseFunctionalProperty));
      properties.addAll(subjectsOfType(model, OWL2.ReflexiveProperty));
      properties.addAll(subjectsOfType(model, OWL2.IrreflexiveProperty));
      return properties;
    }

    private static Set<Resource> subjectsOfType(final Model model, final Resource... types) {
      final Set<Resource> subjects = new LinkedHashSet<>();
      Arrays.stream(types)
          .forEach(
              type ->
                  model.listResourcesWithProperty(RDF.type, type).forEachRemaining(subjects::add));
      return subjects;
    }

    private static Set<Resource> restrictionClosure(final Model model) {
      final Set<Resource> restrictions = subjectsOfType(model, OWL2.Restriction);
      boolean changed = true;
      while (changed) {
        changed = expandRestrictionClosure(model, restrictions);
      }
      return restrictions;
    }

    private static boolean expandRestrictionClosure(
        final Model model, final Set<Resource> restrictions) {
      final int sizeBefore = restrictions.size();
      model
          .listStatements()
          .forEachRemaining(statement -> addConnectedBlank(statement, restrictions));
      return restrictions.size() > sizeBefore;
    }

    private static void addConnectedBlank(
        final Statement statement, final Set<Resource> restrictions) {
      final Resource subject = statement.getSubject();
      final RDFNode object = statement.getObject();
      if (restrictions.contains(subject) && object.isAnon()) {
        restrictions.add(object.asResource());
      }
      if (object.isResource() && restrictions.contains(object.asResource()) && subject.isAnon()) {
        restrictions.add(subject);
      }
    }

    private static Set<Resource> polyhierarchyClasses(final Model model) {
      final Set<Resource> classes = new LinkedHashSet<>();
      model
          .listSubjectsWithProperty(RDFS.subClassOf)
          .forEachRemaining(subject -> addPolyhierarchy(model, classes, subject));
      return classes;
    }

    private static void addPolyhierarchy(
        final Model model, final Set<Resource> classes, final Resource subject) {
      final int parentCount = model.listObjectsOfProperty(subject, RDFS.subClassOf).toList().size();
      if (parentCount > 1) {
        classes.add(subject);
      }
    }
  }
}
