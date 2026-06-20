/*
 *  Copyright 2024 Collate.
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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.GLOSSARY;
import static org.openmetadata.service.Entity.GLOSSARY_TERM;

import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriInfo;
import java.io.StringReader;
import java.net.URI;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.rdf.model.Property;
import org.apache.jena.rdf.model.RDFNode;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.rdf.model.Statement;
import org.apache.jena.rdf.model.StmtIterator;
import org.apache.jena.shared.JenaException;
import org.openmetadata.schema.api.data.ConceptMapping;
import org.openmetadata.schema.configuration.GlossaryTermRelationSettings;
import org.openmetadata.schema.configuration.GlossaryTermRelationType;
import org.openmetadata.schema.configuration.RelationCategory;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.type.CustomProperty;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.OntologyNamespace;
import org.openmetadata.schema.type.TermRelation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.GlossaryRepository;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;
import org.openmetadata.service.jdbi3.TypeRepository;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.RestUtil.PutResponse;

/**
 * Imports an external OWL/SKOS ontology (e.g. a CENTree export) into OpenMetadata glossaries.
 *
 * <p>This is the inverse of {@link RdfRepository#exportGlossaryAsOntology}. It parses RDF with
 * Apache Jena and materializes real {@link GlossaryTerm} entities through the glossary repository
 * (so terms are versioned, searchable and editable). The RDF triplestore is not required: when it
 * is enabled the existing {@code RdfUpdater} mirrors the created terms automatically.
 *
 * <p>SKOS/OWL mapping mirrors the export vocabulary:
 *
 * <ul>
 *   <li>{@code skos:ConceptScheme} &rarr; Glossary
 *   <li>{@code skos:Concept} / {@code owl:Class} &rarr; GlossaryTerm (subject IRI &rarr; {@code iri})
 *   <li>{@code skos:broader} / {@code rdfs:subClassOf} &rarr; parent
 *   <li>{@code skos:altLabel} &rarr; synonyms; {@code skos:definition} / {@code rdfs:comment} &rarr;
 *       description
 *   <li>{@code skos:*Match} / {@code owl:sameAs} to external IRIs &rarr; conceptMappings
 *   <li>other predicates between two imported terms &rarr; typed relatedTerms
 * </ul>
 */
@Slf4j
public class GlossaryRdfImporter {
  private static final String SKOS = "http://www.w3.org/2004/02/skos/core#";
  private static final String RDFS = "http://www.w3.org/2000/01/rdf-schema#";
  private static final String RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
  private static final String OWL = "http://www.w3.org/2002/07/owl#";
  private static final String DCT = "http://purl.org/dc/terms/";
  private static final int MAX_RDF_PAYLOAD_CHARS = 10 * 1024 * 1024;
  private static final String DOCTYPE_TOKEN = "<!DOCTYPE";
  private static final String RDF_XML_LANG = "RDF/XML";

  private static final Set<String> STRUCTURAL_PREDICATES =
      Set.of(
          RDF + "type",
          SKOS + "prefLabel",
          SKOS + "altLabel",
          SKOS + "definition",
          SKOS + "notation",
          SKOS + "scopeNote",
          SKOS + "inScheme",
          SKOS + "topConceptOf",
          SKOS + "hasTopConcept",
          SKOS + "broader",
          SKOS + "narrower",
          RDFS + "label",
          RDFS + "comment",
          RDFS + "subClassOf",
          DCT + "created",
          DCT + "modified");

  private final UriInfo uriInfo;
  private final String user;
  private final boolean allowGlobalSchemaChanges;
  private final OntologyImportResult result = new OntologyImportResult();
  private final Map<String, EntityReference> termRefByIri = new HashMap<>();
  private final Map<String, String> termFqnByIri = new HashMap<>();
  private EntityReference targetGlossaryRef;

  /**
   * @param allowGlobalSchemaChanges whether the caller may mutate global, admin-scoped settings
   *     (the {@code GlossaryTerm} type's custom properties and the glossary relation-type settings).
   *     Glossary {@code EDIT_ALL} alone is not sufficient for those side effects.
   */
  public GlossaryRdfImporter(UriInfo uriInfo, String user, boolean allowGlobalSchemaChanges) {
    this.uriInfo = uriInfo;
    this.user = user;
    this.allowGlobalSchemaChanges = allowGlobalSchemaChanges;
  }

  public OntologyImportResult importRdf(
      String rdf, String format, String targetGlossaryName, boolean dryRun) {
    result.setDryRun(dryRun);
    validatePayloadSize(rdf);
    Model model = parseModel(rdf, format);
    Map<String, EntityReference> glossaryByScheme =
        createGlossaries(model, targetGlossaryName, dryRun);
    List<TermIntent> intents = buildTermIntents(model);
    persistTerms(intents, glossaryByScheme, dryRun);
    registerRelationTypes(model, intents, dryRun);
    registerDatatypeProperties(model, dryRun);
    wireRelations(intents, dryRun);
    return result;
  }

  private void validatePayloadSize(String rdf) {
    if (rdf != null && rdf.length() > MAX_RDF_PAYLOAD_CHARS) {
      throw new BadRequestException(
          String.format(
              "Ontology payload of %d characters exceeds the maximum of %d",
              rdf.length(), MAX_RDF_PAYLOAD_CHARS));
    }
  }

  private Model parseModel(String rdf, String format) {
    String lang = jenaLang(format);
    rejectExternalEntities(rdf, lang);
    Model model = ModelFactory.createDefaultModel();
    try {
      model.read(new StringReader(rdf), null, lang);
    } catch (JenaException ex) {
      throw new BadRequestException("Failed to parse the ontology payload: " + ex.getMessage());
    }
    return model;
  }

  private void rejectExternalEntities(String rdf, String lang) {
    if (RDF_XML_LANG.equals(lang)
        && rdf != null
        && rdf.toUpperCase(Locale.ROOT).contains(DOCTYPE_TOKEN)) {
      throw new BadRequestException(
          "RDF/XML payloads with a DOCTYPE declaration are rejected to prevent XXE/SSRF");
    }
  }

  private String jenaLang(String format) {
    String normalized = format == null ? "turtle" : format.toLowerCase(Locale.ROOT);
    return switch (normalized) {
      case "rdfxml", "xml", "rdf", "application/rdf+xml" -> RDF_XML_LANG;
      case "ntriples", "nt", "application/n-triples" -> "N-TRIPLES";
      case "jsonld", "json-ld", "application/ld+json" -> "JSON-LD";
      default -> "TURTLE";
    };
  }

  private Map<String, EntityReference> createGlossaries(
      Model model, String targetGlossaryName, boolean dryRun) {
    Map<String, EntityReference> glossaryByScheme = new HashMap<>();
    List<Map<String, String>> namespaces = collectNamespaces(model);
    if (nullOrEmpty(targetGlossaryName)) {
      collectSchemeGlossaries(model, namespaces, glossaryByScheme, dryRun);
    } else {
      targetGlossaryRef = resolveTargetGlossary(targetGlossaryName, namespaces, dryRun);
    }
    return glossaryByScheme;
  }

  private void collectSchemeGlossaries(
      Model model,
      List<Map<String, String>> namespaces,
      Map<String, EntityReference> glossaryByScheme,
      boolean dryRun) {
    Resource conceptScheme = model.getResource(SKOS + "ConceptScheme");
    var schemes = model.listResourcesWithProperty(model.getProperty(RDF, "type"), conceptScheme);
    while (schemes.hasNext()) {
      Resource scheme = schemes.next();
      if (scheme.isURIResource()) {
        addSchemeGlossary(model, scheme, namespaces, glossaryByScheme, dryRun);
      }
    }
  }

  private void addSchemeGlossary(
      Model model,
      Resource scheme,
      List<Map<String, String>> namespaces,
      Map<String, EntityReference> glossaryByScheme,
      boolean dryRun) {
    String name = sanitizeName(localName(scheme.getURI()));
    String label = firstLiteral(scheme, model, RDFS + "label", DCT + "title");
    String definition = firstLiteral(scheme, model, SKOS + "definition", RDFS + "comment");
    EntityReference ref = ensureGlossary(name, label, definition, namespaces, dryRun);
    glossaryByScheme.put(scheme.getURI(), ref);
  }

  private EntityReference resolveTargetGlossary(
      String targetGlossaryName, List<Map<String, String>> namespaces, boolean dryRun) {
    EntityReference ref;
    try {
      ref = Entity.getEntityReferenceByName(GLOSSARY, targetGlossaryName, Include.NON_DELETED);
    } catch (EntityNotFoundException ex) {
      ref =
          ensureGlossary(
              sanitizeName(targetGlossaryName), targetGlossaryName, null, namespaces, dryRun);
    }
    return ref;
  }

  private List<Map<String, String>> collectNamespaces(Model model) {
    List<Map<String, String>> namespaces = new ArrayList<>();
    for (var entry : model.getNsPrefixMap().entrySet()) {
      namespaces.add(Map.of("prefix", entry.getKey(), "namespace", entry.getValue()));
    }
    return namespaces;
  }

  private EntityReference ensureGlossary(
      String name,
      String displayName,
      String description,
      List<Map<String, String>> namespaces,
      boolean dryRun) {
    EntityReference ref;
    if (dryRun) {
      ref = previewGlossary(name);
    } else {
      ref = persistGlossary(name, displayName, description, namespaces);
    }
    return ref;
  }

  private EntityReference previewGlossary(String name) {
    EntityReference ref;
    try {
      ref = Entity.getEntityReferenceByName(GLOSSARY, name, Include.NON_DELETED);
    } catch (EntityNotFoundException ex) {
      result.setGlossariesCreated(result.getGlossariesCreated() + 1);
      ref = new EntityReference().withName(name).withFullyQualifiedName(name).withType(GLOSSARY);
    }
    return ref;
  }

  private EntityReference persistGlossary(
      String name, String displayName, String description, List<Map<String, String>> namespaces) {
    GlossaryRepository repository = (GlossaryRepository) Entity.getEntityRepository(GLOSSARY);
    Glossary glossary =
        new Glossary()
            .withId(UUID.randomUUID())
            .withName(name)
            .withDisplayName(nullOrEmpty(displayName) ? name : displayName)
            .withDescription(nullOrEmpty(description) ? name : description)
            .withNamespaces(toNamespaces(namespaces))
            .withUpdatedBy(user)
            .withUpdatedAt(System.currentTimeMillis());
    glossary.setFullyQualifiedName(name);
    PutResponse<Glossary> response = repository.createOrUpdate(uriInfo, glossary, user);
    if (Response.Status.CREATED.equals(response.getStatus())) {
      result.setGlossariesCreated(result.getGlossariesCreated() + 1);
    }
    return response.getEntity().getEntityReference();
  }

  private List<OntologyNamespace> toNamespaces(List<Map<String, String>> namespaces) {
    List<OntologyNamespace> result = new ArrayList<>();
    for (Map<String, String> ns : namespaces) {
      result.add(
          new OntologyNamespace()
              .withPrefix(ns.get("prefix"))
              .withNamespace(toUri(ns.get("namespace"))));
    }
    return result;
  }

  List<TermIntent> buildTermIntents(Model model) {
    Map<String, TermIntent> byIri = new LinkedHashMap<>();
    collectConcepts(model, SKOS + "Concept", byIri);
    collectConcepts(model, OWL + "Class", byIri);
    Set<String> internalIris = byIri.keySet();
    for (TermIntent intent : byIri.values()) {
      extractEdges(model, intent, internalIris);
    }
    return new ArrayList<>(byIri.values());
  }

  private void collectConcepts(Model model, String typeUri, Map<String, TermIntent> byIri) {
    Resource type = model.getResource(typeUri);
    var resources = model.listResourcesWithProperty(model.getProperty(RDF, "type"), type);
    while (resources.hasNext()) {
      Resource resource = resources.next();
      if (resource.isURIResource() && !byIri.containsKey(resource.getURI())) {
        byIri.put(resource.getURI(), toTermIntent(resource, model));
      }
    }
  }

  private TermIntent toTermIntent(Resource resource, Model model) {
    TermIntent intent = new TermIntent();
    intent.iri = resource.getURI();
    String prefLabel = firstLiteral(resource, model, SKOS + "prefLabel", RDFS + "label");
    intent.name = sanitizeName(localName(resource.getURI()));
    intent.displayName = nullOrEmpty(prefLabel) ? intent.name : prefLabel;
    intent.description = firstLiteral(resource, model, SKOS + "definition", RDFS + "comment");
    intent.synonyms = listLiterals(resource, model.getProperty(SKOS, "altLabel"));
    intent.schemeIri = firstResourceUri(resource, model.getProperty(SKOS, "inScheme"));
    return intent;
  }

  private void extractEdges(Model model, TermIntent intent, Set<String> internalIris) {
    Resource resource = model.getResource(intent.iri);
    StmtIterator statements = resource.listProperties();
    while (statements.hasNext()) {
      Statement statement = statements.next();
      classifyEdge(statement, intent, internalIris);
    }
  }

  private void classifyEdge(Statement statement, TermIntent intent, Set<String> internalIris) {
    RDFNode object = statement.getObject();
    if (!object.isURIResource()) {
      return;
    }
    String predicate = statement.getPredicate().getURI();
    String targetIri = object.asResource().getURI();
    boolean internal = internalIris.contains(targetIri);
    if (isHierarchical(predicate)) {
      assignParent(intent, targetIri, internal);
    } else if (mappingTypeFor(predicate) != null && !internal) {
      intent.conceptMappings.add(toConceptMapping(predicate, targetIri));
    } else if (internal) {
      addRelation(intent, predicate, targetIri);
    }
  }

  private boolean isHierarchical(String predicate) {
    return (SKOS + "broader").equals(predicate) || (RDFS + "subClassOf").equals(predicate);
  }

  private void assignParent(TermIntent intent, String targetIri, boolean internal) {
    if (internal && nullOrEmpty(intent.parentIri)) {
      intent.parentIri = targetIri;
    }
  }

  private void addRelation(TermIntent intent, String predicate, String targetIri) {
    if (STRUCTURAL_PREDICATES.contains(predicate)) {
      return;
    }
    String relationType = relationTypeFor(predicate);
    intent.relations.add(new String[] {relationType, targetIri});
  }

  private String relationTypeFor(String predicate) {
    return switch (predicate) {
      case SKOS + "related", SKOS + "closeMatch", SKOS + "relatedMatch" -> "relatedTo";
      case SKOS + "exactMatch", OWL + "sameAs" -> "synonym";
      case SKOS + "broadMatch" -> "broader";
      case SKOS + "narrowMatch" -> "narrower";
      default -> sanitizeRelationName(localName(predicate));
    };
  }

  private ConceptMapping toConceptMapping(String predicate, String targetIri) {
    result.setConceptMappingsAdded(result.getConceptMappingsAdded() + 1);
    return new ConceptMapping()
        .withConceptIri(toUri(targetIri))
        .withMappingType(mappingTypeFor(predicate));
  }

  private ConceptMapping.ConceptMappingType mappingTypeFor(String predicate) {
    return switch (predicate) {
      case SKOS + "exactMatch" -> ConceptMapping.ConceptMappingType.EXACT_MATCH;
      case SKOS + "closeMatch" -> ConceptMapping.ConceptMappingType.CLOSE_MATCH;
      case SKOS + "broadMatch" -> ConceptMapping.ConceptMappingType.BROAD_MATCH;
      case SKOS + "narrowMatch" -> ConceptMapping.ConceptMappingType.NARROW_MATCH;
      case SKOS + "relatedMatch" -> ConceptMapping.ConceptMappingType.RELATED_MATCH;
      case OWL + "sameAs" -> ConceptMapping.ConceptMappingType.SAME_AS;
      default -> null;
    };
  }

  private void registerRelationTypes(Model model, List<TermIntent> intents, boolean dryRun) {
    Set<String> existing = existingRelationTypeNames();
    Map<String, GlossaryTermRelationType> toAdd = new LinkedHashMap<>();
    for (TermIntent intent : intents) {
      for (String[] relation : intent.relations) {
        collectCustomRelationType(model, relation[0], existing, toAdd);
      }
    }
    if (!toAdd.isEmpty()) {
      applyRelationTypes(toAdd, dryRun);
    }
  }

  private void applyRelationTypes(Map<String, GlossaryTermRelationType> toAdd, boolean dryRun) {
    if (!allowGlobalSchemaChanges) {
      result.addMessage(
          String.format(
              "%d relation type(s) require admin privileges and were not registered",
              toAdd.size()));
    } else if (dryRun) {
      result.setRelationTypesRegistered(result.getRelationTypesRegistered() + toAdd.size());
    } else {
      persistRelationTypes(toAdd.values());
    }
  }

  private void collectCustomRelationType(
      Model model,
      String relationName,
      Set<String> existing,
      Map<String, GlossaryTermRelationType> toAdd) {
    if (existing.contains(relationName) || toAdd.containsKey(relationName)) {
      return;
    }
    toAdd.put(relationName, buildRelationType(model, relationName));
  }

  GlossaryTermRelationType buildRelationType(Model model, String relationName) {
    GlossaryTermRelationType type =
        new GlossaryTermRelationType()
            .withName(relationName)
            .withDisplayName(relationName)
            .withCategory(RelationCategory.ASSOCIATIVE)
            .withIsSystemDefined(false);
    Resource property = findObjectProperty(model, relationName);
    if (property != null) {
      enrichFromObjectProperty(model, type, property, relationName);
    }
    return type;
  }

  private void enrichFromObjectProperty(
      Model model, GlossaryTermRelationType type, Resource property, String relationName) {
    String label = firstLiteral(property, model, RDFS + "label");
    type.withDisplayName(nullOrEmpty(label) ? relationName : label)
        .withRdfPredicate(toUri(property.getURI()))
        .withInverseRelation(inverseRelationName(property, model))
        .withDomain(listResourceUris(property, model.getProperty(RDFS, "domain")))
        .withRange(listResourceUris(property, model.getProperty(RDFS, "range")));
    applyCharacteristics(model, type, property);
  }

  private void applyCharacteristics(Model model, GlossaryTermRelationType type, Resource property) {
    type.withIsSymmetric(hasRdfType(model, property, OWL + "SymmetricProperty"))
        .withIsTransitive(hasRdfType(model, property, OWL + "TransitiveProperty"))
        .withIsFunctional(hasRdfType(model, property, OWL + "FunctionalProperty"))
        .withIsInverseFunctional(hasRdfType(model, property, OWL + "InverseFunctionalProperty"))
        .withIsReflexive(hasRdfType(model, property, OWL + "ReflexiveProperty"))
        .withIsIrreflexive(hasRdfType(model, property, OWL + "IrreflexiveProperty"))
        .withIsAsymmetric(hasRdfType(model, property, OWL + "AsymmetricProperty"));
  }

  private boolean hasRdfType(Model model, Resource resource, String typeUri) {
    return resource.hasProperty(model.getProperty(RDF, "type"), model.getResource(typeUri));
  }

  private List<String> listResourceUris(Resource resource, Property property) {
    List<String> uris = new ArrayList<>();
    StmtIterator statements = resource.listProperties(property);
    while (statements.hasNext()) {
      RDFNode object = statements.next().getObject();
      if (object.isURIResource()) {
        uris.add(object.asResource().getURI());
      }
    }
    return uris;
  }

  private Resource findObjectProperty(Model model, String relationName) {
    Resource objectProperty = model.getResource(OWL + "ObjectProperty");
    var properties =
        model.listResourcesWithProperty(model.getProperty(RDF, "type"), objectProperty);
    Resource match = null;
    while (properties.hasNext() && match == null) {
      Resource property = properties.next();
      if (property.isURIResource()
          && sanitizeRelationName(localName(property.getURI())).equals(relationName)) {
        match = property;
      }
    }
    return match;
  }

  private String inverseRelationName(Resource property, Model model) {
    String inverse = firstResourceUri(property, model.getProperty(OWL, "inverseOf"));
    return inverse == null ? null : sanitizeRelationName(localName(inverse));
  }

  private Set<String> existingRelationTypeNames() {
    Set<String> names = new LinkedHashSet<>(GlossaryTermRepository.DEFAULT_RELATION_TYPES);
    GlossaryTermRelationSettings settings =
        SettingsCache.getSetting(
            SettingsType.GLOSSARY_TERM_RELATION_SETTINGS, GlossaryTermRelationSettings.class);
    if (settings != null && settings.getRelationTypes() != null) {
      settings.getRelationTypes().forEach(type -> names.add(type.getName()));
    }
    return names;
  }

  private void persistRelationTypes(java.util.Collection<GlossaryTermRelationType> newTypes) {
    GlossaryTermRelationSettings settings =
        SettingsCache.getSetting(
            SettingsType.GLOSSARY_TERM_RELATION_SETTINGS, GlossaryTermRelationSettings.class);
    List<GlossaryTermRelationType> merged =
        settings == null || settings.getRelationTypes() == null
            ? new ArrayList<>()
            : new ArrayList<>(settings.getRelationTypes());
    merged.addAll(newTypes);
    Settings updated =
        new Settings()
            .withConfigType(SettingsType.GLOSSARY_TERM_RELATION_SETTINGS)
            .withConfigValue(new GlossaryTermRelationSettings().withRelationTypes(merged));
    Entity.getSystemRepository().createOrUpdate(updated);
    result.setRelationTypesRegistered(result.getRelationTypesRegistered() + newTypes.size());
  }

  private void persistTerms(
      List<TermIntent> intents, Map<String, EntityReference> glossaryByScheme, boolean dryRun) {
    GlossaryTermRepository repository =
        (GlossaryTermRepository) Entity.getEntityRepository(GLOSSARY_TERM);
    Map<String, GlossaryTerm> batch = new HashMap<>();
    for (TermIntent intent : orderByDepth(intents)) {
      persistTerm(repository, intent, glossaryByScheme, dryRun, batch);
    }
  }

  private void persistTerm(
      GlossaryTermRepository repository,
      TermIntent intent,
      Map<String, EntityReference> glossaryByScheme,
      boolean dryRun,
      Map<String, GlossaryTerm> batch) {
    EntityReference glossaryRef = resolveGlossary(intent, glossaryByScheme);
    if (glossaryRef == null) {
      result.addMessage(
          String.format("Skipped %s: no glossary (missing inScheme/target)", intent.iri));
    } else {
      persistResolvedTerm(repository, intent, glossaryRef, dryRun, batch);
    }
  }

  private void persistResolvedTerm(
      GlossaryTermRepository repository,
      TermIntent intent,
      EntityReference glossaryRef,
      boolean dryRun,
      Map<String, GlossaryTerm> batch) {
    GlossaryTerm term = buildTerm(intent, glossaryRef);
    try {
      if (dryRun) {
        validateTermForDryRun(repository, term, batch);
      } else {
        commitTerm(repository, term, intent);
      }
    } catch (Exception ex) {
      result.addMessage(String.format("Failed %s: %s", intent.iri, ex.getMessage()));
    }
  }

  private void validateTermForDryRun(
      GlossaryTermRepository repository, GlossaryTerm term, Map<String, GlossaryTerm> batch) {
    boolean exists = entityExists(GLOSSARY_TERM, term.getFullyQualifiedName());
    repository.validateForDryRun(term, batch);
    batch.put(term.getFullyQualifiedName(), term);
    if (exists) {
      result.setTermsUpdated(result.getTermsUpdated() + 1);
    } else {
      result.setTermsCreated(result.getTermsCreated() + 1);
    }
  }

  private boolean entityExists(String entityType, String fqn) {
    boolean exists;
    try {
      Entity.getEntityReferenceByName(entityType, fqn, Include.NON_DELETED);
      exists = true;
    } catch (EntityNotFoundException ex) {
      exists = false;
    }
    return exists;
  }

  private void commitTerm(GlossaryTermRepository repository, GlossaryTerm term, TermIntent intent) {
    repository.prepareInternal(term, true);
    PutResponse<GlossaryTerm> response = repository.createOrUpdate(uriInfo, term, user);
    GlossaryTerm saved = response.getEntity();
    termRefByIri.put(intent.iri, saved.getEntityReference());
    termFqnByIri.put(intent.iri, saved.getFullyQualifiedName());
    if (Response.Status.CREATED.equals(response.getStatus())) {
      result.setTermsCreated(result.getTermsCreated() + 1);
    } else {
      result.setTermsUpdated(result.getTermsUpdated() + 1);
    }
  }

  private GlossaryTerm buildTerm(TermIntent intent, EntityReference glossaryRef) {
    EntityReference parentRef =
        intent.parentIri == null ? null : termRefByIri.get(intent.parentIri);
    String parentFqn = intent.parentIri == null ? null : termFqnByIri.get(intent.parentIri);
    String fqn =
        nullOrEmpty(parentFqn)
            ? FullyQualifiedName.build(glossaryRef.getFullyQualifiedName(), intent.name)
            : FullyQualifiedName.add(parentFqn, intent.name);
    return new GlossaryTerm()
        .withId(UUID.randomUUID())
        .withGlossary(glossaryRef)
        .withParent(parentRef)
        .withName(intent.name)
        .withFullyQualifiedName(fqn)
        .withDisplayName(intent.displayName)
        .withDescription(nullOrEmpty(intent.description) ? intent.displayName : intent.description)
        .withSynonyms(intent.synonyms)
        .withIri(toUri(intent.iri))
        .withConceptMappings(intent.conceptMappings)
        .withUpdatedBy(user)
        .withUpdatedAt(System.currentTimeMillis());
  }

  private EntityReference resolveGlossary(
      TermIntent intent, Map<String, EntityReference> glossaryByScheme) {
    EntityReference ref = intent.schemeIri == null ? null : glossaryByScheme.get(intent.schemeIri);
    return ref == null ? targetGlossaryRef : ref;
  }

  private List<TermIntent> orderByDepth(List<TermIntent> intents) {
    Map<String, TermIntent> byIri = new HashMap<>();
    intents.forEach(intent -> byIri.put(intent.iri, intent));
    List<TermIntent> ordered = new ArrayList<>(intents);
    ordered.sort(Comparator.comparingInt(intent -> depth(intent, byIri, new HashSetGuard())));
    return ordered;
  }

  private int depth(TermIntent intent, Map<String, TermIntent> byIri, HashSetGuard visited) {
    int result = 0;
    if (intent.parentIri != null
        && byIri.containsKey(intent.parentIri)
        && visited.add(intent.iri)) {
      result = 1 + depth(byIri.get(intent.parentIri), byIri, visited);
    }
    return result;
  }

  private void wireRelations(List<TermIntent> intents, boolean dryRun) {
    if (dryRun) {
      countRelationsForDryRun(intents);
    } else {
      persistRelations(intents);
    }
  }

  private void countRelationsForDryRun(List<TermIntent> intents) {
    int total = intents.stream().mapToInt(intent -> intent.relations.size()).sum();
    result.setRelationsAdded(result.getRelationsAdded() + total);
  }

  private void persistRelations(List<TermIntent> intents) {
    GlossaryTermRepository repository =
        (GlossaryTermRepository) Entity.getEntityRepository(GLOSSARY_TERM);
    for (TermIntent intent : intents) {
      EntityReference fromRef = termRefByIri.get(intent.iri);
      if (fromRef != null) {
        intent.relations.forEach(relation -> addTermRelation(repository, fromRef, relation));
      }
    }
  }

  private void addTermRelation(
      GlossaryTermRepository repository, EntityReference fromRef, String[] relation) {
    EntityReference toRef = termRefByIri.get(relation[1]);
    if (toRef == null) {
      return;
    }
    try {
      TermRelation termRelation =
          new TermRelation()
              .withRelationType(relation[0])
              .withTerm(new EntityReference().withId(toRef.getId()).withType(GLOSSARY_TERM));
      repository.addTermRelation(fromRef.getId(), termRelation);
      result.setRelationsAdded(result.getRelationsAdded() + 1);
    } catch (Exception ex) {
      result.addMessage(String.format("Relation %s skipped: %s", relation[0], ex.getMessage()));
    }
  }

  private void registerDatatypeProperties(Model model, boolean dryRun) {
    List<DatatypeIntent> intents = buildDatatypeIntents(model);
    if (!intents.isEmpty()) {
      applyDatatypeProperties(intents, dryRun);
    }
  }

  private void applyDatatypeProperties(List<DatatypeIntent> intents, boolean dryRun) {
    if (!allowGlobalSchemaChanges) {
      result.addMessage(
          String.format(
              "%d datatype attribute(s) require admin privileges and were not created",
              intents.size()));
    } else if (dryRun) {
      result.setCustomPropertiesCreated(result.getCustomPropertiesCreated() + intents.size());
    } else {
      persistDatatypeProperties(intents);
    }
  }

  private void persistDatatypeProperties(List<DatatypeIntent> intents) {
    TypeRepository typeRepository = (TypeRepository) Entity.getEntityRepository(Entity.TYPE);
    EntityReference glossaryTermType =
        Entity.getEntityReferenceByName(Entity.TYPE, GLOSSARY_TERM, Include.NON_DELETED);
    for (DatatypeIntent intent : intents) {
      createCustomProperty(typeRepository, glossaryTermType.getId(), intent);
    }
  }

  List<DatatypeIntent> buildDatatypeIntents(Model model) {
    List<DatatypeIntent> intents = new ArrayList<>();
    Resource datatypeProperty = model.getResource(OWL + "DatatypeProperty");
    var properties =
        model.listResourcesWithProperty(model.getProperty(RDF, "type"), datatypeProperty);
    while (properties.hasNext()) {
      Resource property = properties.next();
      if (property.isURIResource()) {
        intents.add(toDatatypeIntent(property, model));
      }
    }
    return intents;
  }

  private DatatypeIntent toDatatypeIntent(Resource property, Model model) {
    DatatypeIntent intent = new DatatypeIntent();
    intent.iri = property.getURI();
    intent.name = customPropertyName(localName(property.getURI()));
    intent.displayName = firstLiteral(property, model, RDFS + "label");
    intent.description = firstLiteral(property, model, RDFS + "comment", SKOS + "definition");
    intent.domainIri = firstResourceUri(property, model.getProperty(RDFS, "domain"));
    intent.xsdType = firstResourceUri(property, model.getProperty(RDFS, "range"));
    return intent;
  }

  private void createCustomProperty(
      TypeRepository typeRepository, UUID glossaryTermTypeId, DatatypeIntent intent) {
    try {
      EntityReference propertyType =
          Entity.getEntityReferenceByName(
              Entity.TYPE, customPropertyTypeFor(intent.xsdType), Include.NON_DELETED);
      CustomProperty property =
          new CustomProperty()
              .withName(intent.name)
              .withDescription(datatypeDescription(intent))
              .withPropertyType(propertyType);
      typeRepository.addCustomProperty(uriInfo, user, glossaryTermTypeId, property);
      result.setCustomPropertiesCreated(result.getCustomPropertiesCreated() + 1);
    } catch (Exception ex) {
      result.addMessage(
          String.format("Custom property %s skipped: %s", intent.iri, ex.getMessage()));
    }
  }

  String customPropertyTypeFor(String xsdIri) {
    String local = xsdIri == null ? "" : localName(xsdIri).toLowerCase();
    return switch (local) {
      case "integer", "int", "long", "short", "nonnegativeinteger", "positiveinteger" -> "integer";
      case "decimal", "double", "float" -> "number";
      default -> "string";
    };
  }

  private String datatypeDescription(DatatypeIntent intent) {
    StringBuilder description = new StringBuilder();
    if (!nullOrEmpty(intent.displayName)) {
      description.append(intent.displayName);
    }
    if (!nullOrEmpty(intent.description)) {
      appendSpaced(description, intent.description);
    }
    if (!nullOrEmpty(intent.domainIri)) {
      appendSpaced(description, "(Attribute of " + localName(intent.domainIri) + ".)");
    }
    return description.length() == 0 ? intent.name : description.toString();
  }

  private void appendSpaced(StringBuilder builder, String text) {
    if (builder.length() > 0) {
      builder.append(' ');
    }
    builder.append(text);
  }

  private String customPropertyName(String local) {
    String cleaned = local == null ? "" : local.replaceAll("[^a-zA-Z0-9]", "");
    if (cleaned.isEmpty()) {
      cleaned = "attribute";
    }
    if (!Character.isLetter(cleaned.charAt(0))) {
      cleaned = "a" + cleaned;
    }
    return Character.toLowerCase(cleaned.charAt(0)) + cleaned.substring(1);
  }

  private String firstLiteral(Resource resource, Model model, String... propertyUris) {
    String result = null;
    for (String propertyUri : propertyUris) {
      Statement statement = resource.getProperty(model.getProperty(propertyUri));
      if (statement != null && statement.getObject().isLiteral()) {
        result = statement.getString();
        break;
      }
    }
    return result;
  }

  private List<String> listLiterals(Resource resource, Property property) {
    List<String> values = new ArrayList<>();
    StmtIterator statements = resource.listProperties(property);
    while (statements.hasNext()) {
      RDFNode object = statements.next().getObject();
      if (object.isLiteral()) {
        values.add(object.asLiteral().getString());
      }
    }
    return values.isEmpty() ? null : values;
  }

  private String firstResourceUri(Resource resource, Property property) {
    Statement statement = resource.getProperty(property);
    String result = null;
    if (statement != null && statement.getObject().isURIResource()) {
      result = statement.getObject().asResource().getURI();
    }
    return result;
  }

  private String localName(String iri) {
    int hash = iri.lastIndexOf('#');
    int slash = iri.lastIndexOf('/');
    int separator = Math.max(hash, slash);
    return separator >= 0 && separator < iri.length() - 1 ? iri.substring(separator + 1) : iri;
  }

  private String sanitizeName(String raw) {
    String trimmed = raw == null ? "" : raw.replace('.', ' ').replace("::", " ").trim();
    return trimmed.isEmpty() ? "term" : trimmed;
  }

  private String sanitizeRelationName(String raw) {
    String cleaned = raw == null ? "" : raw.replaceAll("[^a-zA-Z0-9]", "");
    return cleaned.isEmpty() ? "relatedTo" : cleaned;
  }

  private URI toUri(String value) {
    URI result = null;
    if (!nullOrEmpty(value)) {
      try {
        result = URI.create(value);
      } catch (IllegalArgumentException ex) {
        LOG.debug("Skipping invalid IRI {}", value);
      }
    }
    return result;
  }

  static final class TermIntent {
    String iri;
    String name;
    String displayName;
    String description;
    List<String> synonyms;
    String parentIri;
    String schemeIri;
    final List<ConceptMapping> conceptMappings = new ArrayList<>();
    final List<String[]> relations = new ArrayList<>();
  }

  static final class DatatypeIntent {
    String iri;
    String name;
    String displayName;
    String description;
    String domainIri;
    String xsdType;
  }

  private static final class HashSetGuard {
    private final Set<String> seen = new java.util.HashSet<>();

    private boolean add(String value) {
      return seen.add(value);
    }
  }
}
