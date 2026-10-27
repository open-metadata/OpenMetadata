package org.openmetadata.service.rdf;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.riot.Lang;
import org.apache.jena.riot.RDFParser;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.data.ConceptMapping;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.type.OntologyAxiomType;
import org.openmetadata.schema.type.OntologyConceptType;
import org.openmetadata.schema.type.OntologyExpression;
import org.openmetadata.schema.type.OntologyExpressionKind;
import org.openmetadata.schema.type.OntologyPropertyKind;
import org.openmetadata.schema.type.OntologyReleaseMember;
import org.openmetadata.schema.type.OntologyReleaseMember.MemberKind;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.ontology.OntologyReleaseManifest;

/** A fixed sealed release: Customer and Supplier under Party, and a pair of inverse properties. */
final class OntologyReleaseExportFixture {
  static final String EX = "https://example.org/model/";
  static final UUID RELEASE_ID = id("release");
  static final URI VERSION_IRI = URI.create("urn:openmetadata:ontology-release:" + RELEASE_ID);
  static final Ontology ROOT =
      new Ontology()
          .withId(id("ontology"))
          .withName("model")
          .withDisplayName("Model")
          .withFullyQualifiedName("model")
          .withDescription("The shared model")
          .withIri(URI.create(EX))
          .withNamespace(URI.create(EX));
  static final OntologyConcept CUSTOMER =
      concept("Customer", "Customer account")
          .withDescription("Someone who buys")
          .withSynonyms(Set.of("Client", "Buyer"))
          .withConceptMappings(
              List.of(
                  new ConceptMapping()
                      .withMappingType(ConceptMapping.ConceptMappingType.EXACT_MATCH)
                      .withConceptIri(URI.create("https://other.example/Client"))));
  static final OntologyConcept SUPPLIER = concept("Supplier", null);
  static final OntologyConcept PARTY = concept("Party", null);

  private OntologyReleaseExportFixture() {}

  static Sealed release() {
    return seal(
        List.of(
            CUSTOMER,
            SUPPLIER,
            PARTY,
            parent("customer-is-party", CUSTOMER, PARTY),
            parent("supplier-is-party", SUPPLIER, PARTY),
            property("buysFrom", "soldTo"),
            property("soldTo", "buysFrom")));
  }

  static Sealed seal(final List<? extends EntityInterface<?>> definitions) {
    final List<OntologyReleaseMember> members = new ArrayList<>();
    members.add(member(MemberKind.ONTOLOGY, ROOT));
    definitions.forEach(definition -> members.add(member(kind(definition), definition)));
    final OntologyRelease release =
        new OntologyRelease()
            .withId(RELEASE_ID)
            .withOntology(ROOT.getEntityReference())
            .withOntologyIri(ROOT.getIri())
            .withVersionIri(VERSION_IRI)
            .withSealedAt(1L)
            .withEncodingVersion(
                OntologyRelease.EncodingVersion.fromValue(OntologyReleaseManifest.ENCODING_VERSION))
            .withMemberCount(members.size())
            .withTotalBytes(
                members.stream().mapToLong(OntologyReleaseMember::getPayloadBytes).sum())
            .withContentDigest(OntologyReleaseManifest.digest(members));
    return new Sealed(release, members);
  }

  static Model turtle(final String text) {
    final Model model = ModelFactory.createDefaultModel();
    RDFParser.fromString(text, Lang.TURTLE).parse(model);
    return model;
  }

  static Model parse(final String text, final Lang lang) {
    final Model model = ModelFactory.createDefaultModel();
    RDFParser.source(new java.io.ByteArrayInputStream(text.getBytes(StandardCharsets.UTF_8)))
        .lang(lang)
        .parse(model);
    return model;
  }

  static OntologyConcept concept(final String name, final String displayName) {
    return new OntologyConcept()
        .withId(id(name))
        .withName(name)
        .withDisplayName(displayName)
        .withIri(URI.create(EX + name))
        .withOntology(ROOT.getEntityReference())
        .withConceptType(OntologyConceptType.OWL_CLASS);
  }

  static OntologyAxiom parent(
      final String name, final OntologyConcept child, final OntologyConcept parent) {
    return new OntologyAxiom()
        .withId(id(name))
        .withName(name)
        .withOntology(ROOT.getEntityReference())
        .withAxiomType(OntologyAxiomType.SUBCLASS_OF)
        .withSubjectIri(child.getIri())
        .withExpressions(
            List.of(
                new OntologyExpression()
                    .withKind(OntologyExpressionKind.NAMED_CLASS)
                    .withClassIri(parent.getIri())));
  }

  static OntologyProperty property(final String name, final String inverse) {
    return new OntologyProperty()
        .withId(id(name))
        .withName(name)
        .withIri(URI.create(EX + name))
        .withInverse(URI.create(EX + inverse))
        .withOntology(ROOT.getEntityReference())
        .withKind(OntologyPropertyKind.OBJECT);
  }

  private static MemberKind kind(final EntityInterface<?> definition) {
    return switch (definition) {
      case OntologyConcept ignored -> MemberKind.CONCEPT;
      case OntologyProperty ignored -> MemberKind.PROPERTY;
      case OntologyAxiom ignored -> MemberKind.AXIOM;
      default -> throw new IllegalArgumentException();
    };
  }

  private static OntologyReleaseMember member(
      final MemberKind kind, final EntityInterface<?> entity) {
    return OntologyReleaseManifest.member(
        RELEASE_ID, kind, entity.getId(), JsonUtils.getObjectMapper().valueToTree(entity));
  }

  static UUID id(final String name) {
    return UUID.nameUUIDFromBytes(name.getBytes(StandardCharsets.UTF_8));
  }

  record Sealed(OntologyRelease release, List<OntologyReleaseMember> members) {}
}
