package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.it.util.SearchDocs.awaitDoc;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Duration;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.factories.UserTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.VoteRequest;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.data.MoveGlossaryTermRequest;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.AssetCertification;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * Votes, team membership changes and glossary term moves each change one aspect of an entity. They
 * used to re-index it from a partially loaded copy, blanking owners, domains, tags, tier and
 * certification in search until the next reindex (#34639). Each check waits for a marker of the
 * write under test, then asserts the relationship fields survived that same write.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class TargetedWriteSearchDocIT {

  private static final String TABLE_INDEX = "table_search_index";
  private static final String TEAM_INDEX = "team_search_index";
  private static final String GLOSSARY_TERM_INDEX = "glossary_term_search_index";
  private static final String TIER1 = "Tier.Tier1";
  private static final String CERTIFICATION_GOLD = "Certification.Gold";

  @Test
  void vote_keepsTableRelationshipsInSearchDoc(TestNamespace ns) {
    Table table = createClassifiedTable(ns);
    awaitDoc(TABLE_INDEX, table.getId(), TargetedWriteSearchDocIT::assertTableRelationships);

    SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.PUT,
            "/v1/tables/" + table.getId() + "/vote",
            new VoteRequest().withUpdatedVoteType(VoteRequest.VoteType.VOTED_UP),
            ChangeEvent.class);

    awaitDoc(
        TABLE_INDEX,
        table.getId(),
        doc -> {
          assertEquals(1, doc.path("votes").path("upVotes").asInt());
          assertEquals(1, doc.path("totalVotes").asInt());
          assertTableRelationships(doc);
        });
  }

  @Test
  void addingTeamMember_keepsTeamOwnersAndDomainsInSearchDoc(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Team team =
        client
            .teams()
            .create(
                new CreateTeam()
                    .withName(ns.prefix("team"))
                    .withTeamType(CreateTeam.TeamType.GROUP)
                    .withOwners(List.of(SharedEntities.get().USER1_REF))
                    .withDomains(List.of(sharedDomainFqn())));
    awaitDoc(TEAM_INDEX, team.getId(), TargetedWriteSearchDocIT::assertOwnerAndDomain);

    User member = UserTestFactory.createUser(ns, "member");
    User withTeam = client.users().get(member.getId().toString(), "teams");
    withTeam.setTeams(List.of(team.getEntityReference()));
    client.users().update(member.getId().toString(), withTeam);

    awaitDoc(
        TEAM_INDEX,
        team.getId(),
        doc -> {
          assertEquals(1, doc.path("userCount").asInt());
          assertOwnerAndDomain(doc);
        });
  }

  @Test
  void glossaryTermMove_keepsOwnersAndDomainsInSearchDoc(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary =
        client
            .glossaries()
            .create(
                new CreateGlossary()
                    .withName(ns.prefix("glossary"))
                    .withDescription("glossary whose terms inherit its domain")
                    .withDomains(List.of(sharedDomainFqn())));
    GlossaryTerm newParent = createTerm(glossary, ns.prefix("new_parent"));
    GlossaryTerm moved = createTerm(glossary, ns.prefix("moved"));
    awaitDoc(GLOSSARY_TERM_INDEX, moved.getId(), TargetedWriteSearchDocIT::assertOwnerAndDomain);

    client
        .getHttpClient()
        .executeForString(
            HttpMethod.PUT,
            "/v1/glossaryTerms/" + moved.getId() + "/moveAsync",
            new MoveGlossaryTermRequest().withParent(newParent.getEntityReference()));

    awaitDoc(
        GLOSSARY_TERM_INDEX,
        moved.getId(),
        doc -> {
          assertEquals(newParent.getId().toString(), doc.path("parent").path("id").asText());
          assertOwnerAndDomain(doc);
        });
  }

  private static GlossaryTerm createTerm(Glossary glossary, String name) {
    return SdkClients.adminClient()
        .glossaryTerms()
        .create(
            new CreateGlossaryTerm()
                .withName(name)
                .withDescription("term owned by the shared user")
                .withGlossary(glossary.getFullyQualifiedName())
                .withOwners(List.of(SharedEntities.get().USER1_REF)));
  }

  private static Table createClassifiedTable(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Database database =
        client
            .databases()
            .create(
                new CreateDatabase()
                    .withName(ns.prefix("db"))
                    .withService(SharedEntities.get().MYSQL_SERVICE.getFullyQualifiedName()));
    DatabaseSchema schema =
        client
            .databaseSchemas()
            .create(
                new CreateDatabaseSchema()
                    .withName(ns.prefix("schema"))
                    .withDatabase(database.getFullyQualifiedName()));
    long now = System.currentTimeMillis();
    return client
        .tables()
        .create(
            new CreateTable()
                .withName(ns.prefix("table"))
                .withDatabaseSchema(schema.getFullyQualifiedName())
                .withColumns(
                    List.of(new Column().withName("id").withDataType(ColumnDataType.BIGINT)))
                .withOwners(List.of(SharedEntities.get().USER1_REF))
                .withDomains(List.of(sharedDomainFqn()))
                .withTags(
                    List.of(
                        SharedEntities.get().PERSONAL_DATA_TAG_LABEL, classificationLabel(TIER1)))
                .withCertification(
                    new AssetCertification()
                        .withTagLabel(classificationLabel(CERTIFICATION_GOLD))
                        .withAppliedDate(now)
                        .withExpiryDate(now + Duration.ofDays(30).toMillis())));
  }

  private static TagLabel classificationLabel(String tagFqn) {
    return new TagLabel()
        .withTagFQN(tagFqn)
        .withSource(TagLabel.TagSource.CLASSIFICATION)
        .withLabelType(TagLabel.LabelType.MANUAL);
  }

  private static void assertTableRelationships(JsonNode doc) {
    Set<String> tagFqns = new HashSet<>();
    doc.path("tags").forEach(tag -> tagFqns.add(tag.path("tagFQN").asText()));
    assertAll(
        () -> assertOwnerAndDomain(doc),
        () ->
            assertTrue(
                tagFqns.contains(SharedEntities.get().PERSONAL_DATA_TAG_LABEL.getTagFQN()),
                "indexed tags: " + tagFqns),
        () -> assertEquals(TIER1, doc.path("tier").path("tagFQN").asText()),
        () ->
            assertEquals(
                CERTIFICATION_GOLD,
                doc.path("certification").path("tagLabel").path("tagFQN").asText()));
  }

  private static void assertOwnerAndDomain(JsonNode doc) {
    assertAll(
        () ->
            assertEquals(
                SharedEntities.get().USER1.getId().toString(),
                doc.path("owners").path(0).path("id").asText()),
        () ->
            assertEquals(
                sharedDomainFqn(),
                doc.path("domains").path(0).path("fullyQualifiedName").asText()));
  }

  private static String sharedDomainFqn() {
    return SharedEntities.get().DOMAIN.getFullyQualifiedName();
  }
}
