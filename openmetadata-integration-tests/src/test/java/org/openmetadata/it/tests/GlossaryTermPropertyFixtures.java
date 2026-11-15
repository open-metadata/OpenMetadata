package org.openmetadata.it.tests;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.GlossaryTermProperty;
import org.openmetadata.schema.type.GlossaryTermPropertyDatatype;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.service.Entity;

/** Builds glossaries and terms with properties, and reads back what the server stored. */
final class GlossaryTermPropertyFixtures {
  static final String STORED_FIELDS = "propertyDefinitions,propertyValues";

  private GlossaryTermPropertyFixtures() {}

  static GlossaryTermProperty property(String name, GlossaryTermPropertyDatatype datatype) {
    return new GlossaryTermProperty().withName(name).withDatatype(datatype);
  }

  static GlossaryTermProperty regulatoryScope() {
    return new GlossaryTermProperty()
        .withName("regulatoryScope")
        .withDatatype(GlossaryTermPropertyDatatype.ENUM)
        .withEnumValues(new LinkedHashSet<>(List.of("GDPR", "CCPA")))
        .withMultiValued(true)
        .withInheritable(true);
  }

  static GlossaryTermProperty retentionDays() {
    return property("retentionDays", GlossaryTermPropertyDatatype.INTEGER)
        .withUnit("days")
        .withInheritable(false);
  }

  /** A property only its declaring term has, with a closed set of values. */
  static GlossaryTermProperty region() {
    return new GlossaryTermProperty()
        .withName("region")
        .withDatatype(GlossaryTermPropertyDatatype.ENUM)
        .withEnumValues(new LinkedHashSet<>(List.of("EU", "US")))
        .withInheritable(false);
  }

  static Glossary glossary(TestNamespace ns, String prefix, EntityReference owner) {
    CreateGlossary create =
        new CreateGlossary()
            .withName(ns.shortPrefix(prefix))
            .withDescription("Glossary for term property tests");
    if (owner != null) {
      create.withOwners(List.of(owner));
    }
    return ns.trackRoot(Entity.GLOSSARY, SdkClients.adminClient().glossaries().create(create));
  }

  static GlossaryTerm term(
      Glossary glossary,
      GlossaryTerm parent,
      String name,
      List<GlossaryTermProperty> definitions,
      Map<String, List<String>> values) {
    return SdkClients.adminClient()
        .glossaryTerms()
        .create(createRequest(glossary, parent, name, definitions, values));
  }

  static CreateGlossaryTerm createRequest(
      Glossary glossary,
      GlossaryTerm parent,
      String name,
      List<GlossaryTermProperty> definitions,
      Map<String, List<String>> values) {
    CreateGlossaryTerm create =
        new CreateGlossaryTerm()
            .withName(name)
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Term for property tests")
            .withPropertyDefinitions(definitions)
            .withPropertyValues(values);
    return parent == null ? create : create.withParent(parent.getFullyQualifiedName());
  }

  static GlossaryTerm withStored(GlossaryTerm term) {
    return SdkClients.adminClient().glossaryTerms().get(term.getId().toString(), STORED_FIELDS);
  }

  static GlossaryTerm withEffective(OpenMetadataClient client, GlossaryTerm term) {
    return client.glossaryTerms().get(term.getId().toString(), "effectiveProperties");
  }

  static GlossaryTerm patch(OpenMetadataClient client, GlossaryTerm term, String... operations) {
    return client.glossaryTerms().patch(term.getId().toString(), patchDocument(operations));
  }

  static JsonNode patchDocument(String... operations) {
    return JsonUtils.readTree("[" + String.join(",", operations) + "]");
  }

  static String op(String op, String path, String valueJson) {
    return "{\"op\":\"%s\",\"path\":\"%s\",\"value\":%s}".formatted(op, path, valueJson);
  }

  static String removeOp(String path) {
    return "{\"op\":\"remove\",\"path\":\"%s\"}".formatted(path);
  }

  /** What the row stores, read straight from the database, soft-deleted terms included. */
  static GlossaryTerm stored(UUID id) {
    return Entity.getCollectionDAO().glossaryTermDAO().findEntityById(id, Include.ALL);
  }

  static String storedJson(UUID id) {
    return Entity.getJdbi()
        .withHandle(
            handle ->
                handle
                    .createQuery("SELECT json FROM glossary_term_entity WHERE id = :id")
                    .bind("id", id.toString())
                    .mapTo(String.class)
                    .one());
  }
}
