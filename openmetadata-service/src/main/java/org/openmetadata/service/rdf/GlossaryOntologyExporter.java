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

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.net.URI;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.apache.jena.query.Dataset;
import org.apache.jena.query.DatasetFactory;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.riot.Lang;
import org.apache.jena.riot.RDFParser;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TermRelation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.GlossaryRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.RdfInfraDAOs.OntologyAnnexDAO;
import org.openmetadata.service.jdbi3.RdfInfraDAOs.OntologyAnnexRow;
import org.openmetadata.service.ontology.RelationshipTypeResolver;

/** Loads a glossary from the database and serializes its ontology projection. */
public final class GlossaryOntologyExporter {
  private static final String DEFAULT_TERM_FIELDS =
      "attributes,conceptMappings,entityStatus,parent,realizedIn,relatedTerms,synonyms";
  private final URI publicBaseUri;
  private final OntologyAnnexDAO annexDAO;
  private final GlossaryOntologyModelBuilder modelBuilder;

  public GlossaryOntologyExporter(final URI publicBaseUri, final OntologyAnnexDAO annexDAO) {
    this.publicBaseUri = publicBaseUri;
    this.annexDAO = annexDAO;
    modelBuilder = new GlossaryOntologyModelBuilder(publicBaseUri);
  }

  public String export(
      final UUID glossaryId, final String requestedFormat, final boolean includeRelations) {
    final Model model = materialize(glossaryId, includeRelations);
    try {
      return serialize(model, exportFormat(requestedFormat));
    } finally {
      model.close();
    }
  }

  private static RdfSerializationFormat exportFormat(final String requestedFormat) {
    try {
      return RdfSerializationFormat.parse(requestedFormat);
    } catch (IllegalArgumentException e) {
      return RdfSerializationFormat.TURTLE;
    }
  }

  public Model materialize(final UUID glossaryId, final boolean includeRelations) {
    final Model model = buildModel(glossaryId, includeRelations);
    try {
      mergeAnnex(model, glossaryId);
    } catch (RuntimeException exception) {
      model.close();
      throw exception;
    }
    return model;
  }

  Model buildModel(final UUID glossaryId, final boolean includeRelations) {
    return modelBuilder.build(load(glossaryId, includeRelations), includeRelations);
  }

  private GlossaryOntologySource load(final UUID glossaryId, final boolean includeRelations) {
    final Glossary glossary = glossary(glossaryId);
    final List<GlossaryTerm> terms = terms(glossary);
    final Map<UUID, String> externalTermIris =
        includeRelations ? externalTermIris(terms) : Map.of();
    final RelationshipTypeResolver resolver =
        new RelationshipTypeResolver(Entity.getCollectionDAO().relationshipTypeDAO());
    return new GlossaryOntologySource(
        glossary, terms, axioms(glossaryId), resolver.list(), externalTermIris);
  }

  private Glossary glossary(final UUID glossaryId) {
    final GlossaryRepository repository =
        (GlossaryRepository) Entity.getEntityRepository(Entity.GLOSSARY);
    return repository.get(
        null,
        glossaryId,
        repository.getFields("namespaces,ontologyConfiguration"),
        Include.NON_DELETED,
        false);
  }

  @SuppressWarnings("unchecked")
  private List<GlossaryTerm> terms(final Glossary glossary) {
    final EntityRepository<GlossaryTerm> repository =
        (EntityRepository<GlossaryTerm>) Entity.getEntityRepository(Entity.GLOSSARY_TERM);
    final ListFilter filter = new ListFilter(Include.NON_DELETED);
    filter.addQueryParam("parent", glossary.getFullyQualifiedName());
    return repository.listAll(repository.getFields(DEFAULT_TERM_FIELDS), filter);
  }

  /** Class IRIs of related terms that live in other glossaries. */
  private Map<UUID, String> externalTermIris(final List<GlossaryTerm> terms) {
    final Set<UUID> localIds = new HashSet<>();
    terms.forEach(term -> localIds.add(term.getId()));
    final Map<UUID, String> iris = new HashMap<>();
    terms.stream()
        .flatMap(term -> listOrEmpty(term.getRelatedTerms()).stream())
        .map(TermRelation::getTerm)
        .filter(reference -> !localIds.contains(reference.getId()))
        .forEach(reference -> iris.computeIfAbsent(reference.getId(), this::externalTermIri));
    return iris;
  }

  private String externalTermIri(final UUID termId) {
    final GlossaryTerm term =
        Entity.getEntity(Entity.GLOSSARY_TERM, termId, "", Include.NON_DELETED);
    return GlossaryTermClassIri.of(term, publicBaseUri);
  }

  @SuppressWarnings("unchecked")
  private List<OntologyAxiom> axioms(final UUID glossaryId) {
    final EntityRepository<OntologyAxiom> repository =
        (EntityRepository<OntologyAxiom>) Entity.getEntityRepository(Entity.ONTOLOGY_AXIOM);
    final ListFilter filter = new ListFilter(Include.NON_DELETED);
    filter.addQueryParam("glossaryId", glossaryId.toString());
    return repository.listAll(repository.getFields(""), filter);
  }

  private void mergeAnnex(final Model model, final UUID glossaryId) {
    final OntologyAnnexRow annex = annexDAO.findLatest(glossaryId);
    if (annex != null && !annex.canonicalNQuads().isBlank()) {
      final Model annexModel = parseAnnex(annex.canonicalNQuads());
      try {
        model.add(annexModel);
      } finally {
        annexModel.close();
      }
    }
  }

  private static Model parseAnnex(final String nQuads) {
    final Dataset dataset = DatasetFactory.createTxnMem();
    final Model annex = ModelFactory.createDefaultModel();
    try {
      RDFParser.fromString(nQuads, Lang.NQUADS).parse(dataset.asDatasetGraph());
      annex.add(dataset.getDefaultModel());
      dataset.listNames().forEachRemaining(name -> annex.add(dataset.getNamedModel(name)));
    } finally {
      dataset.close();
    }
    return annex;
  }

  private static String serialize(final Model model, final RdfSerializationFormat format) {
    return RdfGraphSerializer.asString(model, format);
  }
}
