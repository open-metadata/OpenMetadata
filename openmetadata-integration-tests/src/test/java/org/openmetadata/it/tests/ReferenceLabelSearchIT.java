package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.openmetadata.it.util.SearchDocs.awaitDoc;
import static org.openmetadata.it.util.SearchDocs.refOf;
import static org.openmetadata.it.util.SearchDocs.textValues;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.GlossaryTestFactory;
import org.openmetadata.it.factories.TeamHierarchyTestFactory;
import org.openmetadata.it.factories.UserTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.domains.CreateDataProduct;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.api.BulkAssets;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * Documents copy the name and display name of the users, teams, domains and data products they
 * reference. A rename or a display-name change of one of those has to reach every copy.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class ReferenceLabelSearchIT {

  private static final String TABLE_INDEX = "table_search_index";
  private static final String USER_INDEX = "user_search_index";
  private static final String TEAM_INDEX = "team_search_index";
  private static final String DOMAIN_INDEX = "domain_search_index";
  private static final String DATA_PRODUCT_INDEX = "data_product_search_index";
  private static final String GLOSSARY_TERM_INDEX = "glossary_term_search_index";

  @Test
  void userDisplayName_reachesOwnerReviewerAndExpertCopies(TestNamespace ns) {
    User user = UserTestFactory.createUser(ns, "labeled");
    EntityReference userRef = reference(user.getId(), "user");
    Table table = table(ns, "user_owned", List.of(userRef), null);
    GlossaryTerm term =
        client()
            .glossaryTerms()
            .create(
                new CreateGlossaryTerm()
                    .withGlossary(GlossaryTestFactory.createSimple(ns).getFullyQualifiedName())
                    .withName("Reviewed")
                    .withDescription("Reviewed")
                    .withReviewers(List.of(userRef)));
    Domain domain =
        client()
            .domains()
            .create(
                new CreateDomain()
                    .withName(ns.prefix("experts"))
                    .withDomainType(CreateDomain.DomainType.AGGREGATE)
                    .withDescription("experts")
                    .withExperts(List.of(user.getName())));
    awaitReference(TABLE_INDEX, table.getId(), "owners", user.getId());
    awaitReference(GLOSSARY_TERM_INDEX, term.getId(), "reviewers", user.getId());
    awaitReference(DOMAIN_INDEX, domain.getId(), "experts", user.getId());

    User edited = client().users().get(user.getId().toString());
    edited.setDisplayName("Shown Owner");
    client().users().update(user.getId().toString(), edited);

    JsonNode tableDoc =
        awaitLabel(TABLE_INDEX, table.getId(), "owners", user.getId(), "Shown Owner");
    assertAll(
        () -> assertEquals(Set.of("Shown Owner"), textValues(tableDoc.path("ownerDisplayName"))),
        () ->
            awaitLabel(GLOSSARY_TERM_INDEX, term.getId(), "reviewers", user.getId(), "Shown Owner"),
        () -> awaitLabel(DOMAIN_INDEX, domain.getId(), "experts", user.getId(), "Shown Owner"));
  }

  @Test
  void teamDisplayName_reachesOwnerMemberAndChildTeamCopies(TestNamespace ns) {
    Team department = TeamHierarchyTestFactory.departmentUnderDivision(ns, "lbl", null);
    Team group = TeamHierarchyTestFactory.groupUnder(ns, "lblgroup", department);
    User member =
        client()
            .users()
            .getByName(TeamHierarchyTestFactory.user(ns, "lbl", List.of(group.getId())));
    Table table = table(ns, "team_owned", List.of(reference(group.getId(), "team")), null);
    awaitReference(TABLE_INDEX, table.getId(), "owners", group.getId());
    awaitReference(USER_INDEX, member.getId(), "teams", group.getId());
    awaitReference(TEAM_INDEX, group.getId(), "parents", department.getId());

    setTeamDisplayName(group, "Shown Group");
    setTeamDisplayName(department, "Shown Department");

    JsonNode tableDoc =
        awaitLabel(TABLE_INDEX, table.getId(), "owners", group.getId(), "Shown Group");
    assertAll(
        () -> assertEquals(Set.of("Shown Group"), textValues(tableDoc.path("ownerDisplayName"))),
        () -> awaitLabel(USER_INDEX, member.getId(), "teams", group.getId(), "Shown Group"),
        () ->
            awaitLabel(
                TEAM_INDEX, group.getId(), "parents", department.getId(), "Shown Department"));
  }

  @Test
  void domainRenameAndDisplayName_reachAssetAndUserCopies(TestNamespace ns) {
    Domain domain = TeamHierarchyTestFactory.domain(ns, "lbl");
    Table table = table(ns, "in_domain", List.of(), domain);
    String userName = "dommember" + ns.shortPrefix();
    User user =
        client()
            .users()
            .create(
                new CreateUser()
                    .withName(userName)
                    .withEmail(userName + "@test.com")
                    .withDomains(List.of(domain.getFullyQualifiedName())));
    awaitReference(TABLE_INDEX, table.getId(), "domains", domain.getId());
    awaitReference(USER_INDEX, user.getId(), "domains", domain.getId());

    Domain edited = client().domains().get(domain.getId().toString());
    edited.setName(domain.getName() + "Renamed");
    edited.setDisplayName("Shown Domain");
    client().domains().update(domain.getId().toString(), edited);
    Domain renamed = client().domains().get(domain.getId().toString());

    JsonNode tableRef =
        refOf(
            awaitLabel(TABLE_INDEX, table.getId(), "domains", domain.getId(), "Shown Domain")
                .path("domains"),
            domain.getId());
    assertAll(
        () -> assertEquals(renamed.getName(), tableRef.path("name").asText()),
        () ->
            assertEquals(
                renamed.getFullyQualifiedName(), tableRef.path("fullyQualifiedName").asText()),
        () -> awaitLabel(USER_INDEX, user.getId(), "domains", domain.getId(), "Shown Domain"));
  }

  @Test
  void dataProductRenameAndDisplayName_reachAssetCopies(TestNamespace ns) {
    Domain domain = TeamHierarchyTestFactory.domain(ns, "dp");
    Table table = table(ns, "in_product", List.of(), domain);
    DataProduct product = dataProduct(ns, domain);
    client()
        .getHttpClient()
        .executeForString(
            HttpMethod.PUT,
            "/v1/dataProducts/" + product.getFullyQualifiedName() + "/assets/add",
            new BulkAssets()
                .withAssets(List.of(reference(table.getId(), "table")))
                .withDryRun(false));
    awaitReference(TABLE_INDEX, table.getId(), "dataProducts", product.getId());

    DataProduct edited = client().dataProducts().get(product.getId().toString());
    edited.setName(product.getName() + "Renamed");
    edited.setDisplayName("Shown Product");
    client().dataProducts().update(product.getId().toString(), edited);
    DataProduct renamed = client().dataProducts().get(product.getId().toString());

    JsonNode tableRef =
        refOf(
            awaitLabel(TABLE_INDEX, table.getId(), "dataProducts", product.getId(), "Shown Product")
                .path("dataProducts"),
            product.getId());
    assertAll(
        () -> assertEquals(renamed.getName(), tableRef.path("name").asText()),
        () ->
            assertEquals(
                renamed.getFullyQualifiedName(), tableRef.path("fullyQualifiedName").asText()));
  }

  @Test
  void domainOwnerChange_reachesTheDataProducts(TestNamespace ns) {
    Domain domain = TeamHierarchyTestFactory.domain(ns, "ownedonly");
    DataProduct product = dataProduct(ns, domain);
    User owner = UserTestFactory.createUser(ns, "onlyowner");
    awaitReference(DATA_PRODUCT_INDEX, product.getId(), "domains", domain.getId());

    Domain edited = client().domains().get(domain.getId().toString(), "owners");
    edited.setOwners(List.of(reference(owner.getId(), "user")));
    client().domains().update(domain.getId().toString(), edited);

    awaitReference(DATA_PRODUCT_INDEX, product.getId(), "owners", owner.getId());
  }

  @Test
  void domainDisplayNameAndOwnerChange_reachTheDataProducts(TestNamespace ns) {
    // The display-name script for a domain's children wrote a "domain" field that data products do
    // not have, so it failed and took the owners propagated in the same update down with it. The
    // relabel pass that replaced it rewrites the same data products, so it must not race the
    // owners either.
    Domain domain = TeamHierarchyTestFactory.domain(ns, "owned");
    DataProduct product = dataProduct(ns, domain);
    User owner = UserTestFactory.createUser(ns, "domainowner");
    awaitReference(DATA_PRODUCT_INDEX, product.getId(), "domains", domain.getId());

    Domain edited = client().domains().get(domain.getId().toString(), "owners");
    edited.setDisplayName("Owned Domain");
    edited.setOwners(List.of(reference(owner.getId(), "user")));
    client().domains().update(domain.getId().toString(), edited);

    awaitReference(DATA_PRODUCT_INDEX, product.getId(), "owners", owner.getId());
    awaitLabel(DATA_PRODUCT_INDEX, product.getId(), "domains", domain.getId(), "Owned Domain");
  }

  private static JsonNode awaitReference(String index, UUID docId, String field, UUID refId) {
    return awaitDoc(index, docId, doc -> refOf(doc.path(field), refId).isObject());
  }

  private static JsonNode awaitLabel(
      String index, UUID docId, String field, UUID refId, String displayName) {
    return awaitDoc(
        index,
        docId,
        doc -> displayName.equals(refOf(doc.path(field), refId).path("displayName").asText()));
  }

  private static void setTeamDisplayName(Team team, String displayName) {
    Team edited = client().teams().get(team.getId().toString());
    edited.setDisplayName(displayName);
    client().teams().update(team.getId().toString(), edited);
  }

  private static DataProduct dataProduct(TestNamespace ns, Domain domain) {
    return client()
        .dataProducts()
        .create(
            new CreateDataProduct()
                .withName(ns.prefix("product"))
                .withDomains(List.of(domain.getFullyQualifiedName()))
                .withDescription("product"));
  }

  private static Table table(
      TestNamespace ns, String name, List<EntityReference> owners, Domain domain) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    return client()
        .tables()
        .create(
            new CreateTable()
                .withName(ns.prefix(name))
                .withDatabaseSchema(
                    DatabaseSchemaTestFactory.createSimple(ns, service).getFullyQualifiedName())
                .withOwners(owners)
                .withDomains(domain == null ? null : List.of(domain.getFullyQualifiedName()))
                .withColumns(
                    List.of(new Column().withName("id").withDataType(ColumnDataType.BIGINT))));
  }

  private static EntityReference reference(UUID id, String type) {
    return new EntityReference().withId(id).withType(type);
  }

  private static OpenMetadataClient client() {
    return SdkClients.adminClient();
  }
}
