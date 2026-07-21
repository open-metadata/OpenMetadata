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
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.rdf.model.Property;
import org.apache.jena.rdf.model.RDFNode;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.rdf.model.Statement;
import org.apache.jena.rdf.model.StmtIterator;
import org.apache.jena.shared.JenaException;
import org.openmetadata.schema.api.configuration.rdf.ShaclValidationMode;
import org.openmetadata.schema.api.data.ConceptMapping;
import org.openmetadata.schema.api.data.OntologyImportResult;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.OntologyAnnexRevision;
import org.openmetadata.schema.type.OntologyAnnexSource;
import org.openmetadata.schema.type.OntologyAttribute;
import org.openmetadata.schema.type.OntologyAttributeDataType;
import org.openmetadata.schema.type.OntologyNamespace;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.RdfValidationReport;
import org.openmetadata.schema.type.RelationProvenance;
import org.openmetadata.schema.type.RelationshipCardinality;
import org.openmetadata.schema.type.RelationshipCharacteristic;
import org.openmetadata.schema.type.RelationshipPaletteKey;
import org.openmetadata.schema.type.RelationshipTypeCategory;
import org.openmetadata.schema.type.SemanticReference;
import org.openmetadata.schema.type.TermRelation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.GlossaryRepository;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;
import org.openmetadata.service.jdbi3.RelationshipTypeRepository;
import org.openmetadata.service.monitoring.OntologyMetrics;
import org.openmetadata.service.ontology.OntologyAnnexService;
import org.openmetadata.service.ontology.OntologyChangeEventPublisher;
import org.openmetadata.service.ontology.RdfBlankNodeCanonicalizer;
import org.openmetadata.service.ontology.RelationshipTypeIds;
import org.openmetadata.service.ontology.RelationshipTypeResolver;
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
 *   <li>{@code skos:broader} / {@code rdfs:subClassOf} &rarr; deterministic parent plus typed
 *       {@code broader} relations for additional parents
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
  private static final String SKOS_RELATED = SKOS + "related";
  private static final String SKOS_EXACT_MATCH = SKOS + "exactMatch";
  private static final String SKOS_CLOSE_MATCH = SKOS + "closeMatch";
  private static final String SKOS_BROAD_MATCH = SKOS + "broadMatch";
  private static final String SKOS_NARROW_MATCH = SKOS + "narrowMatch";
  private static final String SKOS_RELATED_MATCH = SKOS + "relatedMatch";
  private static final String OWL_SAME_AS = OWL + "sameAs";
  private static final String RELATED_TYPE = "skosRelated";
  private static final String SYNONYM_TYPE = "synonym";
  private static final String SAME_AS_TYPE = "sameAs";
  private static final String CLOSE_MATCH_TYPE = "closeMatch";
  private static final String BROAD_MATCH_TYPE = "broadMatch";
  private static final String NARROW_MATCH_TYPE = "narrowMatch";
  private static final String RELATED_MATCH_TYPE = "relatedMatch";
  private static final String BROADER_TYPE = "broader";
  private static final int MAX_RDF_PAYLOAD_CHARS = 10 * 1024 * 1024;
  private static final String DOCTYPE_TOKEN = "<!DOCTYPE";
  private static final String RDF_XML_LANG = "RDF/XML";
  private final SafeJsonLdModelParser jsonLdParser = new SafeJsonLdModelParser();

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
  private final Supplier<ShaclValidationMode> validationModeSupplier;
  private final OntologyImportResult result = new OntologyImportResult();
  private final Map<String, EntityReference> termRefByIri = new HashMap<>();
  private final Map<String, String> termFqnByIri = new HashMap<>();
  private final Map<String, String> iriByFqn = new HashMap<>();
  private EntityReference targetGlossaryRef;

  /**
   * @param allowGlobalSchemaChanges whether the caller may register global, governed relationship
   *     types. Per-concept attributes are part of each term and require only glossary edit access.
   */
  public GlossaryRdfImporter(UriInfo uriInfo, String user, boolean allowGlobalSchemaChanges) {
    this(uriInfo, user, allowGlobalSchemaChanges, GlossaryRdfImporter::configuredValidationMode);
  }

  GlossaryRdfImporter(
      UriInfo uriInfo,
      String user,
      boolean allowGlobalSchemaChanges,
      Supplier<ShaclValidationMode> validationModeSupplier) {
    this.uriInfo = uriInfo;
    this.user = user;
    this.allowGlobalSchemaChanges = allowGlobalSchemaChanges;
    this.validationModeSupplier = Objects.requireNonNull(validationModeSupplier);
  }

  public OntologyImportResult importRdf(
      String rdf, String format, String targetGlossaryName, boolean dryRun) {
    result.setDryRun(dryRun);
    validatePayload(rdf);
    Model model = parseModel(rdf, format);
    try {
      result.setValidationReport(validateModel(model, dryRun));
      Map<String, EntityReference> glossaryByScheme =
          createGlossaries(model, targetGlossaryName, dryRun);
      List<TermIntent> intents = buildTermIntents(model);
      attachDatatypeAttributes(model, intents);
      persistTerms(intents, glossaryByScheme, dryRun);
      registerRelationTypes(model, intents, dryRun);
      wireRelations(intents, dryRun);
      preserveAnnex(model, glossaryByScheme, dryRun);
      publishImportEvents(glossaryByScheme, dryRun);
      return result;
    } finally {
      model.close();
    }
  }

  RdfValidationReport validateModel(Model model, boolean dryRun) {
    final ShaclValidationMode validationMode = validationModeSupplier.get();
    final boolean shouldValidate = dryRun || validationMode != ShaclValidationMode.OFF;
    final RdfValidationReport validationReport =
        shouldValidate
            ? new RdfShaclReportMapper().map(RdfShaclValidator.validate(model))
            : new RdfShaclReportMapper().skipped();
    OntologyMetrics.recordShaclValidation(
        Boolean.TRUE.equals(validationReport.getPerformed()),
        Boolean.TRUE.equals(validationReport.getConforms()));
    if (!dryRun
        && validationMode == ShaclValidationMode.ENFORCE_IMPORTS
        && !validationReport.getConforms()) {
      throw new BadRequestException(
          String.format(
              "Ontology import failed SHACL validation with %d violation(s)",
              validationReport.getViolationCount()));
    }
    return validationReport;
  }

  private static ShaclValidationMode configuredValidationMode() {
    final RdfRepository repository = RdfRepository.getInstanceOrNull();
    final ShaclValidationMode validationMode =
        repository == null || repository.getConfig().getShaclValidationMode() == null
            ? ShaclValidationMode.REPORT
            : repository.getConfig().getShaclValidationMode();
    return validationMode;
  }

  private void preserveAnnex(
      Model sourceModel, Map<String, EntityReference> glossaryByScheme, boolean dryRun) {
    if (!dryRun) {
      for (UUID glossaryId : importedGlossaryIds(glossaryByScheme)) {
        preserveAnnex(sourceModel, glossaryId);
      }
    }
  }

  private void publishImportEvents(Map<String, EntityReference> glossaryByScheme, boolean dryRun) {
    if (!dryRun) {
      OntologyChangeEventPublisher publisher = new OntologyChangeEventPublisher();
      for (UUID glossaryId : importedGlossaryIds(glossaryByScheme)) {
        Glossary glossary = Entity.getEntity(GLOSSARY, glossaryId, "", Include.NON_DELETED);
        publisher.publish(EventType.ONTOLOGY_IMPORTED, glossary, user);
      }
    }
  }

  private Set<UUID> importedGlossaryIds(Map<String, EntityReference> glossaryByScheme) {
    Set<UUID> ids = new LinkedHashSet<>();
    glossaryByScheme.values().stream()
        .map(EntityReference::getId)
        .filter(Objects::nonNull)
        .forEach(ids::add);
    if (targetGlossaryRef != null && targetGlossaryRef.getId() != null) {
      ids.add(targetGlossaryRef.getId());
    }
    return ids;
  }

  private void preserveAnnex(Model sourceModel, UUID glossaryId) {
    GlossaryOntologyExporter exporter =
        new GlossaryOntologyExporter(
            URI.create("https://open-metadata.org/"), Entity.getCollectionDAO().ontologyAnnexDAO());
    Model representedModel = exporter.buildModel(glossaryId, true);
    try {
      OntologyAnnexService annexService =
          new OntologyAnnexService(
              Entity.getCollectionDAO().ontologyAnnexDAO(),
              new RdfBlankNodeCanonicalizer(),
              Clock.systemUTC());
      OntologyAnnexRevision revision =
          annexService.preserve(
              glossaryId, sourceModel, representedModel, OntologyAnnexSource.IMPORT, user);
      result.getAnnexRevisions().add(revision);
    } finally {
      representedModel.close();
    }
  }

  private void validatePayload(String rdf) {
    if (nullOrEmpty(rdf)) {
      throw new BadRequestException("The ontology payload must not be empty");
    }
    if (rdf.length() > MAX_RDF_PAYLOAD_CHARS) {
      throw new BadRequestException(
          String.format(
              "Ontology payload of %d characters exceeds the maximum of %d",
              rdf.length(), MAX_RDF_PAYLOAD_CHARS));
    }
  }

  private void addMessage(String message) {
    result.getMessages().add(message);
  }

  private Model parseModel(String rdf, String format) {
    OntologyInputFormat inputFormat = OntologyInputFormat.resolve(format);
    rejectExternalEntities(rdf, inputFormat.jenaLanguage());
    Model model;
    if (inputFormat == OntologyInputFormat.JSON_LD) {
      model = jsonLdParser.parse(rdf);
    } else {
      model = ModelFactory.createDefaultModel();
      try {
        model.read(new StringReader(rdf), null, inputFormat.jenaLanguage());
      } catch (JenaException ex) {
        throw new BadRequestException("Failed to parse the ontology payload: " + ex.getMessage());
      }
    }
    return model;
  }

  private void rejectExternalEntities(String rdf, String lang) {
    if (RDF_XML_LANG.equals(lang)
        && !nullOrEmpty(rdf)
        && rdf.toUpperCase(Locale.ROOT).contains(DOCTYPE_TOKEN)) {
      throw new BadRequestException(
          "RDF/XML payloads with a DOCTYPE declaration are rejected to prevent XXE/SSRF");
    }
  }

  private Map<String, EntityReference> createGlossaries(
      Model model, String targetGlossaryName, boolean dryRun) {
    Map<String, EntityReference> glossaryByScheme = new HashMap<>();
    List<OntologyNamespace> namespaces = collectNamespaces(model);
    if (nullOrEmpty(targetGlossaryName)) {
      collectSchemeGlossaries(model, namespaces, glossaryByScheme, dryRun);
    } else {
      targetGlossaryRef = resolveTargetGlossary(targetGlossaryName, namespaces, dryRun);
    }
    return glossaryByScheme;
  }

  private void collectSchemeGlossaries(
      Model model,
      List<OntologyNamespace> namespaces,
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
      List<OntologyNamespace> namespaces,
      Map<String, EntityReference> glossaryByScheme,
      boolean dryRun) {
    String name = sanitizeName(localName(scheme.getURI()));
    String label = firstLiteral(scheme, model, RDFS + "label", DCT + "title");
    String definition = firstLiteral(scheme, model, SKOS + "definition", RDFS + "comment");
    EntityReference ref = ensureGlossary(name, label, definition, namespaces, dryRun);
    glossaryByScheme.put(scheme.getURI(), ref);
  }

  private EntityReference resolveTargetGlossary(
      String targetGlossaryName, List<OntologyNamespace> namespaces, boolean dryRun) {
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

  private List<OntologyNamespace> collectNamespaces(Model model) {
    return model.getNsPrefixMap().entrySet().stream()
        .map(
            entry ->
                new OntologyNamespace()
                    .withPrefix(entry.getKey())
                    .withNamespace(toUri(entry.getValue())))
        .toList();
  }

  private EntityReference ensureGlossary(
      String name,
      String displayName,
      String description,
      List<OntologyNamespace> namespaces,
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
      String name, String displayName, String description, List<OntologyNamespace> namespaces) {
    GlossaryRepository repository = (GlossaryRepository) Entity.getEntityRepository(GLOSSARY);
    Glossary glossary =
        new Glossary()
            .withId(UUID.randomUUID())
            .withName(name)
            .withDisplayName(nullOrEmpty(displayName) ? name : displayName)
            .withDescription(nullOrEmpty(description) ? name : description)
            .withNamespaces(namespaces)
            .withUpdatedBy(user)
            .withUpdatedAt(System.currentTimeMillis());
    glossary.setFullyQualifiedName(name);
    PutResponse<Glossary> response = repository.createOrUpdate(uriInfo, glossary, user);
    if (Response.Status.CREATED.equals(response.getStatus())) {
      result.setGlossariesCreated(result.getGlossariesCreated() + 1);
    }
    return response.getEntity().getEntityReference();
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
    ConceptMapping.ConceptMappingType mappingType = mappingTypeFor(predicate);
    if (isHierarchical(predicate)) {
      assignParent(intent, targetIri, internal);
    } else if (mappingType != null && !internal) {
      addConceptMapping(intent, targetIri, mappingType);
    } else if (internal) {
      addRelation(intent, predicate, targetIri);
    }
  }

  private boolean isHierarchical(String predicate) {
    return (SKOS + "broader").equals(predicate) || (RDFS + "subClassOf").equals(predicate);
  }

  private void assignParent(TermIntent intent, String targetIri, boolean internal) {
    if (!internal) {
      addConceptMapping(intent, targetIri, ConceptMapping.ConceptMappingType.BROAD_MATCH);
      return;
    }
    if (targetIri.equals(intent.parentIri)) {
      return;
    }
    if (intent.parentIri == null || targetIri.compareTo(intent.parentIri) < 0) {
      String previousParent = intent.parentIri;
      intent.parentIri = targetIri;
      removeRelation(intent, "broader", targetIri);
      if (previousParent != null) {
        addTypedRelation(intent, BROADER_TYPE, SKOS + "broader", previousParent);
      }
    } else {
      addTypedRelation(intent, BROADER_TYPE, SKOS + "broader", targetIri);
    }
  }

  private void addRelation(TermIntent intent, String predicate, String targetIri) {
    if (STRUCTURAL_PREDICATES.contains(predicate)) {
      return;
    }
    String relationType = relationTypeFor(predicate);
    addTypedRelation(intent, relationType, predicate, targetIri);
  }

  private void addTypedRelation(
      TermIntent intent, String relationType, String predicateIri, String targetIri) {
    if (BROADER_TYPE.equals(relationType) && targetIri.equals(intent.parentIri)) {
      return;
    }
    boolean exists =
        intent.relations.stream()
            .anyMatch(
                relation ->
                    relationType.equals(relation.relationshipType())
                        && targetIri.equals(relation.targetIri()));
    if (!exists) {
      intent.relations.add(new RelationIntent(relationType, predicateIri, targetIri));
    }
  }

  private void removeRelation(TermIntent intent, String relationType, String targetIri) {
    intent.relations.removeIf(
        relation ->
            relationType.equals(relation.relationshipType())
                && targetIri.equals(relation.targetIri()));
  }

  private void addConceptMapping(
      TermIntent intent, String targetIri, ConceptMapping.ConceptMappingType mappingType) {
    boolean exists =
        intent.conceptMappings.stream()
            .anyMatch(
                mapping ->
                    mappingType.equals(mapping.getMappingType())
                        && mapping.getConceptIri() != null
                        && targetIri.equals(mapping.getConceptIri().toString()));
    if (!exists) {
      intent.conceptMappings.add(
          new ConceptMapping().withConceptIri(toUri(targetIri)).withMappingType(mappingType));
    }
  }

  private String relationTypeFor(String predicate) {
    return switch (predicate) {
      case SKOS_RELATED -> RELATED_TYPE;
      case SKOS_EXACT_MATCH -> SYNONYM_TYPE;
      case OWL_SAME_AS -> SAME_AS_TYPE;
      case SKOS_CLOSE_MATCH -> CLOSE_MATCH_TYPE;
      case SKOS_BROAD_MATCH -> BROAD_MATCH_TYPE;
      case SKOS_NARROW_MATCH -> NARROW_MATCH_TYPE;
      case SKOS_RELATED_MATCH -> RELATED_MATCH_TYPE;
      default -> sanitizeRelationName(localName(predicate));
    };
  }

  private ConceptMapping.ConceptMappingType mappingTypeFor(String predicate) {
    return switch (predicate) {
      case SKOS_EXACT_MATCH -> ConceptMapping.ConceptMappingType.EXACT_MATCH;
      case SKOS_CLOSE_MATCH -> ConceptMapping.ConceptMappingType.CLOSE_MATCH;
      case SKOS_BROAD_MATCH -> ConceptMapping.ConceptMappingType.BROAD_MATCH;
      case SKOS_NARROW_MATCH -> ConceptMapping.ConceptMappingType.NARROW_MATCH;
      case SKOS_RELATED_MATCH -> ConceptMapping.ConceptMappingType.RELATED_MATCH;
      case OWL_SAME_AS -> ConceptMapping.ConceptMappingType.SAME_AS;
      default -> null;
    };
  }

  private void registerRelationTypes(Model model, List<TermIntent> intents, boolean dryRun) {
    Set<String> existing = existingRelationTypeNames();
    Map<String, RelationshipType> toAdd = new LinkedHashMap<>();
    for (TermIntent intent : intents) {
      for (RelationIntent relation : intent.relations) {
        collectCustomRelationType(
            model, relation.relationshipType(), relation.predicateIri(), existing, toAdd);
      }
    }
    if (!toAdd.isEmpty()) {
      applyRelationTypes(toAdd, dryRun);
    }
  }

  private void applyRelationTypes(Map<String, RelationshipType> toAdd, boolean dryRun) {
    if (!allowGlobalSchemaChanges) {
      addMessage(
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
      String predicateIri,
      Set<String> existing,
      Map<String, RelationshipType> toAdd) {
    if (existing.contains(relationName) || toAdd.containsKey(relationName)) {
      return;
    }
    toAdd.put(relationName, buildRelationType(model, relationName, predicateIri));
  }

  RelationshipType buildRelationType(Model model, String relationName) {
    Resource property = findObjectProperty(model, relationName);
    String predicateIri =
        property == null ? "https://open-metadata.org/ontology/" + relationName : property.getURI();
    return buildRelationType(model, relationName, predicateIri);
  }

  private RelationshipType buildRelationType(
      Model model, String relationName, String predicateIri) {
    Resource property = model.getResource(predicateIri);
    URI predicate = URI.create(predicateIri);
    RelationshipType type =
        new RelationshipType()
            .withId(RelationshipTypeIds.stableId(relationName))
            .withName(relationName)
            .withFullyQualifiedName(relationName)
            .withDisplayName(relationName)
            .withDescription(relationName)
            .withIri(predicate)
            .withRdfPredicate(predicate)
            .withCategory(RelationshipTypeCategory.CUSTOM)
            .withDomain(Set.of())
            .withRange(Set.of())
            .withCharacteristics(Set.of())
            .withPropertyChain(List.of())
            .withDisjointWith(Set.of())
            .withCrossGlossaryAllowed(true)
            .withPaletteKey(RelationshipPaletteKey.VIOLET)
            .withSystemDefined(false)
            .withEntityStatus(EntityStatus.APPROVED)
            .withProvider(ProviderType.USER)
            .withUpdatedBy(user)
            .withUpdatedAt(System.currentTimeMillis());
    enrichFromObjectProperty(model, type, property, relationName);
    return type;
  }

  private void enrichFromObjectProperty(
      Model model, RelationshipType type, Resource property, String relationName) {
    if (property != null) {
      String label = firstLiteral(property, model, RDFS + "label");
      String description = firstLiteral(property, model, RDFS + "comment", SKOS + "definition");
      type.withDisplayName(nullOrEmpty(label) ? relationName : label)
          .withDescription(nullOrEmpty(description) ? relationName : description)
          .withInverse(inverseReference(property, model))
          .withDomain(semanticReferences(property, model.getProperty(RDFS, "domain")))
          .withRange(semanticReferences(property, model.getProperty(RDFS, "range")));
      applyCharacteristics(model, type, property);
    }
  }

  private void applyCharacteristics(Model model, RelationshipType type, Resource property) {
    Set<RelationshipCharacteristic> characteristics =
        EnumSet.noneOf(RelationshipCharacteristic.class);
    addCharacteristic(
        model,
        property,
        OWL + "SymmetricProperty",
        RelationshipCharacteristic.SYMMETRIC,
        characteristics);
    addCharacteristic(
        model,
        property,
        OWL + "TransitiveProperty",
        RelationshipCharacteristic.TRANSITIVE,
        characteristics);
    addCharacteristic(
        model,
        property,
        OWL + "FunctionalProperty",
        RelationshipCharacteristic.FUNCTIONAL,
        characteristics);
    addCharacteristic(
        model,
        property,
        OWL + "InverseFunctionalProperty",
        RelationshipCharacteristic.INVERSE_FUNCTIONAL,
        characteristics);
    addCharacteristic(
        model,
        property,
        OWL + "ReflexiveProperty",
        RelationshipCharacteristic.REFLEXIVE,
        characteristics);
    addCharacteristic(
        model,
        property,
        OWL + "IrreflexiveProperty",
        RelationshipCharacteristic.IRREFLEXIVE,
        characteristics);
    addCharacteristic(
        model,
        property,
        OWL + "AsymmetricProperty",
        RelationshipCharacteristic.ASYMMETRIC,
        characteristics);
    type.setCharacteristics(Set.copyOf(characteristics));
    type.setCardinality(cardinality(characteristics));
    if (characteristics.contains(RelationshipCharacteristic.SYMMETRIC)) {
      type.setInverse(type.getEntityReference());
    }
  }

  private void addCharacteristic(
      Model model,
      Resource property,
      String typeIri,
      RelationshipCharacteristic characteristic,
      Set<RelationshipCharacteristic> characteristics) {
    if (hasRdfType(model, property, typeIri)) {
      characteristics.add(characteristic);
    }
  }

  private RelationshipCardinality cardinality(Set<RelationshipCharacteristic> characteristics) {
    Integer sourceMax = characteristics.contains(RelationshipCharacteristic.FUNCTIONAL) ? 1 : null;
    Integer targetMax =
        characteristics.contains(RelationshipCharacteristic.INVERSE_FUNCTIONAL) ? 1 : null;
    RelationshipCardinality cardinality =
        sourceMax == null && targetMax == null
            ? null
            : new RelationshipCardinality().withSourceMax(sourceMax).withTargetMax(targetMax);
    return cardinality;
  }

  private Set<SemanticReference> semanticReferences(Resource resource, Property property) {
    return listResourceUris(resource, property).stream()
        .map(iri -> new SemanticReference().withIri(URI.create(iri)))
        .collect(Collectors.toUnmodifiableSet());
  }

  private EntityReference inverseReference(Resource property, Model model) {
    String inverseName = inverseRelationName(property, model);
    EntityReference inverse =
        inverseName == null
            ? null
            : new EntityReference()
                .withId(RelationshipTypeIds.stableId(inverseName))
                .withName(inverseName)
                .withFullyQualifiedName(inverseName)
                .withType(Entity.RELATIONSHIP_TYPE);
    return inverse;
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
    RelationshipTypeResolver resolver =
        new RelationshipTypeResolver(Entity.getCollectionDAO().relationshipTypeDAO());
    Set<String> names =
        resolver.list().stream()
            .map(RelationshipType::getName)
            .collect(Collectors.toCollection(LinkedHashSet::new));
    return names;
  }

  private void persistRelationTypes(Collection<RelationshipType> newTypes) {
    RelationshipTypeRepository repository =
        (RelationshipTypeRepository) Entity.getEntityRepository(Entity.RELATIONSHIP_TYPE);
    int added = 0;
    for (RelationshipType type : newTypes) {
      repository.prepareInternal(type, false);
      PutResponse<RelationshipType> response = repository.createOrUpdate(uriInfo, type, user);
      if (Response.Status.CREATED.equals(response.getStatus())) {
        added++;
      }
    }
    result.setRelationTypesRegistered(result.getRelationTypesRegistered() + added);
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
      addMessage(String.format("Skipped %s: no glossary (missing inScheme/target)", intent.iri));
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
    if (!collidesWithExistingConcept(intent, term.getFullyQualifiedName())) {
      persistNonCollidingTerm(repository, intent, term, dryRun, batch);
    }
  }

  /**
   * Distinct concept IRIs that share a local name (e.g. {@code ex1:Drug} and {@code ex2:Drug} from
   * blended vocabularies) collapse to the same term FQN. Without this guard the second concept's
   * {@code createOrUpdate} would silently overwrite the first term — including its canonical IRI.
   * The owner is checked against both this run ({@code iriByFqn}) and any already-persisted term at
   * the FQN: an FQN taken by a different concept, or by a non-ontology term with no canonical IRI
   * (e.g. one created manually), is a collision that is skipped and surfaced rather than
   * overwritten. Only a re-import of the same concept (matching IRI) updates in place.
   */
  private boolean collidesWithExistingConcept(TermIntent intent, String fqn) {
    String owner = iriByFqn.get(fqn);
    boolean collides;
    String conflictLabel = owner;
    if (owner != null) {
      collides = !owner.equals(intent.iri);
    } else {
      GlossaryTerm existing = persistedTerm(fqn);
      String existingIri =
          existing == null || existing.getIri() == null ? null : existing.getIri().toString();
      collides = existing != null && (existingIri == null || !existingIri.equals(intent.iri));
      conflictLabel = existingIri == null ? "an existing term" : existingIri;
    }
    if (collides) {
      addMessage(
          String.format(
              "Skipped %s: local name '%s' collides with %s; both map to '%s'",
              intent.iri, intent.name, conflictLabel, fqn));
    } else {
      iriByFqn.put(fqn, intent.iri);
    }
    return collides;
  }

  private GlossaryTerm persistedTerm(String fqn) {
    GlossaryTerm term = null;
    try {
      term = Entity.getEntityByName(GLOSSARY_TERM, fqn, "", Include.NON_DELETED);
    } catch (EntityNotFoundException ex) {
      term = null;
    }
    return term;
  }

  private void persistNonCollidingTerm(
      GlossaryTermRepository repository,
      TermIntent intent,
      GlossaryTerm term,
      boolean dryRun,
      Map<String, GlossaryTerm> batch) {
    try {
      if (dryRun) {
        validateTermForDryRun(repository, term, batch);
        // Backfill the FQN so depth-later children resolve their parent FQN and
        // are previewed with the correct nested FQN (commitTerm does this for the
        // non-dry-run path); otherwise nested terms get a flat FQN and the
        // exists-check miscounts every re-imported child as a create.
        termFqnByIri.put(intent.iri, term.getFullyQualifiedName());
      } else {
        commitTerm(repository, term, intent);
      }
    } catch (RuntimeException ex) {
      LOG.warn("Failed to persist imported ontology concept {}", intent.iri, ex);
      addMessage(String.format("Failed %s: %s", intent.iri, ex.getMessage()));
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
      result.setConceptMappingsAdded(
          result.getConceptMappingsAdded() + term.getConceptMappings().size());
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
      result.setConceptMappingsAdded(
          result.getConceptMappingsAdded() + term.getConceptMappings().size());
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
        .withAttributes(intent.attributes)
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
    ordered.sort(Comparator.comparingInt(intent -> depth(intent, byIri)));
    return ordered;
  }

  /**
   * Walks the parent chain iteratively (not recursively) so a deep or crafted linear hierarchy
   * cannot overflow the thread stack; the visited set bounds it against cycles.
   */
  private int depth(TermIntent intent, Map<String, TermIntent> byIri) {
    int depth = 0;
    Set<String> visited = new HashSet<>();
    TermIntent current = intent;
    while (current.parentIri != null
        && byIri.containsKey(current.parentIri)
        && visited.add(current.iri)) {
      depth++;
      current = byIri.get(current.parentIri);
    }
    return depth;
  }

  private void wireRelations(List<TermIntent> intents, boolean dryRun) {
    if (dryRun) {
      countRelationsForDryRun(intents);
    } else {
      persistRelations(intents);
    }
  }

  private void countRelationsForDryRun(List<TermIntent> intents) {
    Set<String> knownIris = new HashSet<>();
    intents.forEach(intent -> knownIris.add(intent.iri));
    Set<String> registerableTypes = registerableRelationTypes(intents);
    int total = 0;
    for (TermIntent intent : intents) {
      for (RelationIntent relation : intent.relations) {
        if (knownIris.contains(relation.targetIri())
            && registerableTypes.contains(relation.relationshipType())) {
          total++;
        }
      }
    }
    result.setRelationsAdded(result.getRelationsAdded() + total);
  }

  /**
   * Relation types the real import would accept: the already-registered (default + custom) types,
   * plus — only when the caller may register them — the custom types declared by this ontology. A
   * non-admin cannot register new types, so their relations using custom types are skipped on a real
   * import and must not inflate the dry-run preview.
   */
  private Set<String> registerableRelationTypes(List<TermIntent> intents) {
    Set<String> types = new HashSet<>(existingRelationTypeNames());
    if (allowGlobalSchemaChanges) {
      intents.forEach(
          intent -> intent.relations.forEach(relation -> types.add(relation.relationshipType())));
    }
    return types;
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
      GlossaryTermRepository repository, EntityReference fromRef, RelationIntent relation) {
    EntityReference toRef = termRefByIri.get(relation.targetIri());
    if (toRef != null) {
      try {
        TermRelation termRelation =
            new TermRelation()
                .withRelationType(relation.relationshipType())
                .withProvenance(RelationProvenance.IMPORTED)
                .withTerm(new EntityReference().withId(toRef.getId()).withType(GLOSSARY_TERM));
        repository.addTermRelation(uriInfo, user, fromRef.getId(), termRelation);
        result.setRelationsAdded(result.getRelationsAdded() + 1);
      } catch (BadRequestException | EntityNotFoundException ex) {
        addMessage(
            String.format("Relation %s skipped: %s", relation.relationshipType(), ex.getMessage()));
      }
    }
  }

  private void attachDatatypeAttributes(Model model, List<TermIntent> terms) {
    Map<String, TermIntent> termsByIri = new HashMap<>();
    terms.forEach(term -> termsByIri.put(term.iri, term));
    for (DatatypeIntent datatype : buildDatatypeIntents(model)) {
      attachDatatypeAttribute(datatype, termsByIri);
    }
  }

  private void attachDatatypeAttribute(
      DatatypeIntent datatype, Map<String, TermIntent> termsByIri) {
    int attached = 0;
    for (String domainIri : datatype.domainIris) {
      TermIntent term = termsByIri.get(domainIri);
      if (term != null) {
        term.attributes.add(toAttribute(datatype, domainIri));
        attached++;
      }
    }
    result.setCustomPropertiesCreated(result.getCustomPropertiesCreated() + attached);
    if (attached == 0) {
      addMessage(
          String.format(
              "Datatype property %s was preserved in the ontology annex because it has no imported class domain",
              datatype.iri));
    }
  }

  private OntologyAttribute toAttribute(DatatypeIntent datatype, String domainIri) {
    UUID id =
        UUID.nameUUIDFromBytes(
            (domainIri + '\u0000' + datatype.iri).getBytes(StandardCharsets.UTF_8));
    return new OntologyAttribute()
        .withId(id)
        .withName(datatype.name)
        .withIri(toUri(datatype.iri))
        .withDescription(
            nullOrEmpty(datatype.description) ? datatype.displayName : datatype.description)
        .withDataType(attributeDataType(datatype.xsdType))
        .withDatatypeIri(toUri(datatype.xsdType))
        .withEnumValues(Set.of())
        .withIsIdentifier(false);
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
    intent.domainIris = listResourceUris(property, model.getProperty(RDFS, "domain"));
    intent.xsdType = firstResourceUri(property, model.getProperty(RDFS, "range"));
    return intent;
  }

  OntologyAttributeDataType attributeDataType(String xsdIri) {
    String local = xsdIri == null ? "" : localName(xsdIri).toLowerCase(Locale.ROOT);
    OntologyAttributeDataType dataType = OntologyAttributeDataType.STRING;
    if (Set.of("integer", "int", "long", "short", "nonnegativeinteger", "positiveinteger")
        .contains(local)) {
      dataType = OntologyAttributeDataType.INTEGER;
    } else if (Set.of("decimal", "double", "float").contains(local)) {
      dataType = OntologyAttributeDataType.DECIMAL;
    } else if ("boolean".equals(local)) {
      dataType = OntologyAttributeDataType.BOOLEAN;
    } else if (Set.of("date", "datetime").contains(local)) {
      dataType = OntologyAttributeDataType.DATE;
    }
    return dataType;
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
    final List<RelationIntent> relations = new ArrayList<>();
    final List<OntologyAttribute> attributes = new ArrayList<>();
  }

  static final class DatatypeIntent {
    String iri;
    String name;
    String displayName;
    String description;
    List<String> domainIris;
    String xsdType;
  }

  record RelationIntent(String relationshipType, String predicateIri, String targetIri) {}

  private enum OntologyInputFormat {
    TURTLE("TURTLE", Set.of("turtle", "ttl", "text/turtle")),
    RDF_XML(RDF_XML_LANG, Set.of("rdfxml", "xml", "rdf", "application/rdf+xml")),
    N_TRIPLES("N-TRIPLES", Set.of("ntriples", "nt", "application/n-triples")),
    JSON_LD("JSON-LD", Set.of("jsonld", "json-ld", "application/ld+json"));

    private final String jenaLanguage;
    private final Set<String> aliases;

    OntologyInputFormat(final String jenaLanguage, final Set<String> aliases) {
      this.jenaLanguage = jenaLanguage;
      this.aliases = aliases;
    }

    private String jenaLanguage() {
      return jenaLanguage;
    }

    private static OntologyInputFormat resolve(final String value) {
      final String normalized = nullOrEmpty(value) ? "turtle" : value.toLowerCase(Locale.ROOT);
      OntologyInputFormat resolved = TURTLE;
      for (final OntologyInputFormat candidate : values()) {
        if (candidate.aliases.contains(normalized)) {
          resolved = candidate;
        }
      }
      return resolved;
    }
  }
}
