package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.it.tests.GlossaryTermPropertyFixtures.createRequest;
import static org.openmetadata.it.tests.GlossaryTermPropertyFixtures.glossary;
import static org.openmetadata.it.tests.GlossaryTermPropertyFixtures.op;
import static org.openmetadata.it.tests.GlossaryTermPropertyFixtures.patch;
import static org.openmetadata.it.tests.GlossaryTermPropertyFixtures.property;
import static org.openmetadata.it.tests.GlossaryTermPropertyFixtures.region;
import static org.openmetadata.it.tests.GlossaryTermPropertyFixtures.regulatoryScope;
import static org.openmetadata.it.tests.GlossaryTermPropertyFixtures.removeOp;
import static org.openmetadata.it.tests.GlossaryTermPropertyFixtures.retentionDays;
import static org.openmetadata.it.tests.GlossaryTermPropertyFixtures.stored;
import static org.openmetadata.it.tests.GlossaryTermPropertyFixtures.term;
import static org.openmetadata.it.tests.GlossaryTermPropertyFixtures.withEffective;
import static org.openmetadata.it.tests.GlossaryTermPropertyFixtures.withStored;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.SqlQueryCounter;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.GlossaryTermPropertyImpact;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.type.GlossaryTermPropertyDatatype;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.ApiException;
import org.openmetadata.sdk.exceptions.ForbiddenException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityDataDAOs.GlossaryTermDAO;
import org.openmetadata.service.util.FullyQualifiedName;

/** Permissions, the impact endpoint, the paths that must keep stored properties, and SQL cost. */
@ExtendWith(TestNamespaceExtension.class)
@Execution(ExecutionMode.CONCURRENT)
class GlossaryTermPropertiesAccessIT {
  private static final String SCOPE_VALUE_PATCH =
      op("add", "/propertyValues/regulatoryScope", "[\"CCPA\"]");
  private static final String NEW_DEFINITION_PATCH =
      op("add", "/propertyDefinitions/-", "{\"name\":\"tier\",\"datatype\":\"string\"}");

  private final OpenMetadataClient admin = SdkClients.adminClient();

  private record Fixture(
      Glossary glossary, GlossaryTerm customer, GlossaryTerm phone, GlossaryTerm mobile) {}

  private Fixture fixture(TestNamespace ns, Glossary glossary) {
    GlossaryTerm customer =
        term(
            glossary,
            null,
            "Customer",
            List.of(regulatoryScope(), region(), retentionDays()),
            Map.of(
                "regulatoryScope",
                List.of("GDPR"),
                "region",
                List.of("EU"),
                "retentionDays",
                List.of("30")));
    GlossaryTerm phone =
        term(glossary, customer, "Phone", null, Map.of("regulatoryScope", List.of("CCPA")));
    GlossaryTerm mobile =
        term(glossary, phone, "Mobile", null, Map.of("regulatoryScope", List.of()));
    return new Fixture(glossary, customer, phone, mobile);
  }

  private OpenMetadataClient userClient(TestNamespace ns, String label, String roleName) {
    return client(ns, label, roleName == null ? List.of() : List.of(roleId(roleName)));
  }

  private OpenMetadataClient clientWithRules(TestNamespace ns, String label, Rule... rules) {
    Policy policy =
        admin
            .policies()
            .create(
                new CreatePolicy()
                    .withName(ns.shortPrefix("p_" + label))
                    .withDescription("Glossary term property access")
                    .withRules(List.of(rules)));
    Role role =
        admin
            .roles()
            .create(
                new CreateRole()
                    .withName(ns.shortPrefix("r_" + label))
                    .withPolicies(List.of(policy.getFullyQualifiedName())));
    return client(ns, label, List.of(role.getId()));
  }

  private UUID roleId(String roleName) {
    return admin.roles().getByName(roleName).getId();
  }

  private OpenMetadataClient client(TestNamespace ns, String label, List<UUID> roleIds) {
    String name = ns.shortPrefix(label);
    String email = name + "@test.openmetadata.org";
    CreateUser create = new CreateUser().withName(name).withEmail(email);
    if (!roleIds.isEmpty()) {
      create.withRoles(roleIds);
    }
    ns.trackRoot(Entity.USER, admin.users().create(create));
    return SdkClients.createClient(name, email, new String[] {});
  }

  private static Rule rule(String name, Rule.Effect effect, MetadataOperation... operations) {
    return new Rule()
        .withName(name)
        .withResources(List.of(Entity.GLOSSARY_TERM))
        .withOperations(List.of(operations))
        .withEffect(effect);
  }

  private GlossaryTermPropertyImpact impact(
      OpenMetadataClient client, GlossaryTerm term, String name) {
    String body =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/glossaryTerms/" + term.getId() + "/propertyDefinitions/" + name + "/impact",
                null);
    return JsonUtils.readValue(body, GlossaryTermPropertyImpact.class);
  }

  @Test
  void impactCountsTheTermsBelowThatStoreAnEntryAndSamplesThem(TestNamespace ns) {
    Fixture fixture = fixture(ns, glossary(ns, "impact", null));

    GlossaryTermPropertyImpact impact = impact(admin, fixture.customer(), "regulatoryScope");

    assertEquals(2, impact.getTermsWithEntries());
    assertEquals(
        List.of(fixture.phone().getFullyQualifiedName(), fixture.mobile().getFullyQualifiedName()),
        impact.getSample().stream().map(ref -> ref.getFullyQualifiedName()).sorted().toList());
  }

  @Test
  void impactIsZeroForALocalPropertyAndNotFoundForAnUndeclaredOne(TestNamespace ns) {
    Fixture fixture = fixture(ns, glossary(ns, "impactlocal", null));

    assertEquals(0, impact(admin, fixture.customer(), "region").getTermsWithEntries());
    ApiException missing =
        assertThrows(ApiException.class, () -> impact(admin, fixture.customer(), "nope"));
    assertEquals(404, missing.getStatusCode());
  }

  @Test
  void impactSampleIsCappedAtTwentyAndCountsAllTerms(TestNamespace ns) {
    Glossary glossary = glossary(ns, "impactcap", null);
    GlossaryTerm root = term(glossary, null, "Root", List.of(regulatoryScope()), null);
    for (int index = 0; index < 23; index++) {
      term(glossary, root, "T" + index, null, Map.of("regulatoryScope", List.of("GDPR")));
    }

    GlossaryTermPropertyImpact impact = impact(admin, root, "regulatoryScope");

    assertEquals(23, impact.getTermsWithEntries());
    assertEquals(20, impact.getSample().size());
  }

  @Test
  void impactAfterDeletingTheEntriesBelowIsZero(TestNamespace ns) {
    Fixture fixture = fixture(ns, glossary(ns, "impactzero", null));
    patch(admin, fixture.phone(), removeOp("/propertyValues/regulatoryScope"));
    patch(admin, fixture.mobile(), removeOp("/propertyValues/regulatoryScope"));

    assertEquals(0, impact(admin, fixture.customer(), "regulatoryScope").getTermsWithEntries());
  }

  @Test
  void glossaryOwnerEditsDefinitionsAndValues(TestNamespace ns) {
    SharedEntities shared = SharedEntities.get();
    Glossary glossary = glossary(ns, "owned", shared.USER2_REF);
    Fixture fixture = fixture(ns, glossary);
    OpenMetadataClient owner = SdkClients.user2Client();

    GlossaryTerm withValue = patch(owner, fixture.phone(), SCOPE_VALUE_PATCH);
    GlossaryTerm withDefinition = patch(owner, fixture.customer(), NEW_DEFINITION_PATCH);

    assertEquals(List.of("CCPA"), withStored(withValue).getPropertyValues().get("regulatoryScope"));
    assertEquals(4, withStored(withDefinition).getPropertyDefinitions().size());
  }

  @Test
  void aUserWithNoGrantAndADefaultDataStewardCannotPatchEitherField(TestNamespace ns) {
    Fixture fixture = fixture(ns, glossary(ns, "denied", null));
    for (OpenMetadataClient client :
        List.of(userClient(ns, "plain", null), userClient(ns, "steward", "DataSteward"))) {
      assertThrows(
          ForbiddenException.class, () -> patch(client, fixture.phone(), SCOPE_VALUE_PATCH));
      assertThrows(
          ForbiddenException.class, () -> patch(client, fixture.customer(), NEW_DEFINITION_PATCH));
    }
  }

  @Test
  void aRuleGrantingOnlyTheOperationPatchesBothFieldsButNotTheDescription(TestNamespace ns) {
    Fixture fixture = fixture(ns, glossary(ns, "granted", null));
    OpenMetadataClient editor =
        clientWithRules(
            ns,
            "propsonly",
            rule("props", Rule.Effect.ALLOW, MetadataOperation.EDIT_GLOSSARY_TERM_PROPERTIES));

    patch(editor, fixture.phone(), SCOPE_VALUE_PATCH);
    patch(editor, fixture.customer(), NEW_DEFINITION_PATCH);
    patch(
        editor,
        fixture.customer(),
        op("replace", "/propertyDefinitions/0/displayName", "\"Scope\""));

    assertEquals(
        List.of("CCPA"), withStored(fixture.phone()).getPropertyValues().get("regulatoryScope"));
    assertEquals(4, withStored(fixture.customer()).getPropertyDefinitions().size());
    assertThrows(
        ForbiddenException.class,
        () -> patch(editor, fixture.customer(), op("replace", "/displayName", "\"changed\"")));
  }

  @Test
  void editAllImpliesTheOperationAndADenyOfTheOperationStillWins(TestNamespace ns) {
    Fixture fixture = fixture(ns, glossary(ns, "editall", null));
    Rule editAll = rule("editall", Rule.Effect.ALLOW, MetadataOperation.EDIT_ALL);
    OpenMetadataClient editor = clientWithRules(ns, "editall", editAll);
    OpenMetadataClient denied =
        clientWithRules(
            ns,
            "editalldeny",
            editAll,
            rule("noprops", Rule.Effect.DENY, MetadataOperation.EDIT_GLOSSARY_TERM_PROPERTIES));

    patch(editor, fixture.phone(), SCOPE_VALUE_PATCH);
    patch(denied, fixture.customer(), op("replace", "/description", "\"still editable\""));

    assertThrows(ForbiddenException.class, () -> patch(denied, fixture.phone(), SCOPE_VALUE_PATCH));
    assertThrows(
        ForbiddenException.class, () -> patch(denied, fixture.customer(), NEW_DEFINITION_PATCH));
  }

  @Test
  void aUserWithoutViewPermissionIsRefusedTheImpactPreview(TestNamespace ns) {
    Fixture fixture = fixture(ns, glossary(ns, "noview", null));
    OpenMetadataClient blind =
        clientWithRules(
            ns,
            "noview",
            rule(
                "noview",
                Rule.Effect.DENY,
                MetadataOperation.VIEW_ALL,
                MetadataOperation.VIEW_BASIC));

    assertThrows(
        ForbiddenException.class, () -> impact(blind, fixture.customer(), "regulatoryScope"));
  }

  @Test
  void aPlainViewerReadsEffectivePropertiesAndTheImpactPreview(TestNamespace ns) {
    Fixture fixture = fixture(ns, glossary(ns, "viewer", null));
    OpenMetadataClient viewer = userClient(ns, "viewer", null);

    GlossaryTerm read = withEffective(viewer, fixture.mobile());

    assertEquals(1, read.getEffectiveProperties().size());
    assertEquals(2, impact(viewer, fixture.customer(), "regulatoryScope").getTermsWithEntries());
  }

  @Test
  void putWithoutThePropertyFieldsKeepsThem(TestNamespace ns) {
    Fixture fixture = fixture(ns, glossary(ns, "putkeep", null));
    CreateGlossaryTerm withoutFields =
        createRequest(fixture.glossary(), null, "Customer", null, null)
            .withDescription("Changed by a PUT that knows nothing about properties");

    put(withoutFields);

    GlossaryTerm kept = withStored(fixture.customer());
    assertEquals(3, kept.getPropertyDefinitions().size());
    assertEquals(List.of("GDPR"), kept.getPropertyValues().get("regulatoryScope"));
    assertEquals(List.of("30"), kept.getPropertyValues().get("retentionDays"));
  }

  @Test
  void putWithEmptyDefinitionsClearsThemWithTheEntriesBelowAndTheStaleValues(TestNamespace ns) {
    Fixture fixture = fixture(ns, glossary(ns, "putclear", null));
    CreateGlossaryTerm clearing =
        createRequest(fixture.glossary(), null, "Customer", new ArrayList<>(), null);

    put(admin, clearing);

    GlossaryTerm customer = withStored(fixture.customer());
    assertTrue(listOrEmpty(customer.getPropertyDefinitions()).isEmpty());
    assertTrue(customer.getPropertyValues() == null || customer.getPropertyValues().isEmpty());
    assertNull(stored(fixture.phone().getId()).getPropertyValues());
    assertNull(stored(fixture.mobile().getId()).getPropertyValues());
  }

  @Test
  void putWithEmptyValuesClearsThemAndKeepsTheDefinitions(TestNamespace ns) {
    Fixture fixture = fixture(ns, glossary(ns, "putvalues", null));
    CreateGlossaryTerm clearing =
        createRequest(fixture.glossary(), null, "Customer", null, new LinkedHashMap<>());

    put(admin, clearing);

    GlossaryTerm customer = withStored(fixture.customer());
    assertEquals(3, customer.getPropertyDefinitions().size());
    assertTrue(customer.getPropertyValues() == null || customer.getPropertyValues().isEmpty());
    assertEquals(
        List.of("CCPA"), withStored(fixture.phone()).getPropertyValues().get("regulatoryScope"));
  }

  @Test
  void aBotPutWithEmptyListsKeepsWhatIsStoredAndOnlyAddsDefinitions(TestNamespace ns) {
    Fixture fixture = fixture(ns, glossary(ns, "putbot", null));
    OpenMetadataClient bot = SdkClients.ingestionBotClient();

    put(
        bot,
        createRequest(
            fixture.glossary(), null, "Customer", new ArrayList<>(), new LinkedHashMap<>()));

    GlossaryTerm kept = withStored(fixture.customer());
    assertEquals(3, kept.getPropertyDefinitions().size());
    assertEquals(List.of("GDPR"), kept.getPropertyValues().get("regulatoryScope"));

    put(
        bot,
        createRequest(
            fixture.glossary(),
            null,
            "Customer",
            new ArrayList<>(List.of(property("source", GlossaryTermPropertyDatatype.STRING))),
            null));

    assertEquals(4, withStored(fixture.customer()).getPropertyDefinitions().size());
  }

  @Test
  void getThenPutLeavesTheStoredFieldsAndVersionUnchanged(TestNamespace ns) {
    Fixture fixture = fixture(ns, glossary(ns, "putsame", null));
    GlossaryTerm read = withStored(fixture.phone());
    Double version = read.getVersion();
    CreateGlossaryTerm sameAsRead =
        createRequest(
                fixture.glossary(),
                fixture.customer(),
                "Phone",
                read.getPropertyDefinitions(),
                read.getPropertyValues())
            .withDescription(read.getDescription());

    put(sameAsRead);

    GlossaryTerm after = withStored(fixture.phone());
    assertEquals(version, after.getVersion());
    assertEquals(read.getPropertyValues(), after.getPropertyValues());
  }

  @Test
  void csvExportAndImportKeepStoredProperties(TestNamespace ns) {
    Fixture fixture = fixture(ns, glossary(ns, "csv", null));
    String csv = admin.glossaries().exportCsv(fixture.glossary().getName(), true);

    admin.glossaries().importCsv(fixture.glossary().getName(), csv, false, true);

    GlossaryTerm customer = withStored(fixture.customer());
    GlossaryTerm phone = withStored(fixture.phone());
    assertEquals(3, customer.getPropertyDefinitions().size());
    assertEquals(List.of("EU"), customer.getPropertyValues().get("region"));
    assertEquals(List.of("CCPA"), phone.getPropertyValues().get("regulatoryScope"));
  }

  @Test
  void csvRowThatMovesATermUnderAParentThatDoesNotCoverItsValuesFailsTheRow(TestNamespace ns) {
    Fixture fixture = fixture(ns, glossary(ns, "csvmove", null));
    GlossaryTerm bare = term(fixture.glossary(), null, "Bare", null, null);
    String csv = admin.glossaries().exportCsv(fixture.glossary().getName(), true);
    String moved = csv.replace(phoneRow(csv), movedUnder(phoneRow(csv), bare));

    String result = admin.glossaries().importCsv(fixture.glossary().getName(), moved, true, true);

    assertTrue(result.contains("Moving '" + fixture.phone().getFullyQualifiedName() + "'"), result);
    assertEquals(
        List.of("CCPA"), withStored(fixture.phone()).getPropertyValues().get("regulatoryScope"));
  }

  @Test
  void listingTermsWithEffectivePropertiesIssuesTheSameStatementsForFiveAndFiftyTerms(
      TestNamespace ns) {
    int five = termStatementsForListing(glossary(ns, "list5", null), 5);
    int fifty = termStatementsForListing(glossary(ns, "list50", null), 50);

    assertEquals(five, fifty);
    assertTrue(five > 0);
  }

  @Test
  void deletingAPropertyIssuesTheSameStatementsWhetherTwoOrTwoHundredTermsHoldIt(TestNamespace ns) {
    int two = termStatementsForDeletion(glossary(ns, "del2", null), 2);
    int twoHundred = termStatementsForDeletion(glossary(ns, "del200", null), 200);

    assertEquals(two, twoHundred);
  }

  private int termStatementsForListing(Glossary glossary, int children) {
    GlossaryTerm root = term(glossary, null, "Root", List.of(regulatoryScope()), null);
    for (int index = 0; index < children; index++) {
      term(glossary, root, "T" + index, null, Map.of("regulatoryScope", List.of("GDPR")));
    }
    try (SqlQueryCounter queries = countingGlossary(glossary)) {
      JsonNode page = listChildren(root);
      assertEquals(children, page.get("data").size());
      assertNotNull(page.get("data").get(0).get("effectiveProperties"));
      return queries.count();
    }
  }

  private int termStatementsForDeletion(Glossary glossary, int holders) {
    GlossaryTerm root = term(glossary, null, "Root", List.of(regulatoryScope()), null);
    List<CreateGlossaryTerm> batch = new ArrayList<>();
    for (int index = 0; index < holders; index++) {
      batch.add(
          createRequest(
              glossary, root, "T" + index, null, Map.of("regulatoryScope", List.of("GDPR"))));
    }
    batch.forEach(request -> admin.glossaryTerms().create(request));
    try (SqlQueryCounter queries = countingGlossary(glossary)) {
      patch(admin, root, removeOp("/propertyDefinitions/0"));
      assertEquals(0, impactCount(root));
      return queries.count();
    }
  }

  private int impactCount(GlossaryTerm root) {
    return Entity.getCollectionDAO()
        .glossaryTermDAO()
        .countPropertyEntries(
            root.getFullyQualifiedName(),
            GlossaryTermDAO.propertyEntryPath("regulatoryScope"),
            "regulatoryScope");
  }

  private SqlQueryCounter countingGlossary(Glossary glossary) {
    String hash = FullyQualifiedName.buildHash(glossary.getFullyQualifiedName());
    return SqlQueryCounter.forRequests(
        Entity.getJdbi(),
        "glossary_term_entity",
        context -> context.getBinding().toString().contains(hash));
  }

  private JsonNode listChildren(GlossaryTerm parent) {
    RequestOptions options =
        RequestOptions.builder()
            .queryParam("directChildrenOf", parent.getFullyQualifiedName())
            .queryParam("fields", "effectiveProperties")
            .queryParam("limit", "100")
            .build();
    return JsonUtils.readTree(
        admin.getHttpClient().executeForString(HttpMethod.GET, "/v1/glossaryTerms", null, options));
  }

  private void put(CreateGlossaryTerm request) {
    put(admin, request);
  }

  private void put(OpenMetadataClient client, CreateGlossaryTerm request) {
    client.getHttpClient().executeForString(HttpMethod.PUT, "/v1/glossaryTerms", request);
  }

  private static String phoneRow(String csv) {
    return csv.lines()
        .filter(line -> line.contains("Phone") && !line.contains("Mobile"))
        .findFirst()
        .orElseThrow();
  }

  private static String movedUnder(String row, GlossaryTerm newParent) {
    String oldParent = row.substring(0, row.indexOf(','));
    return newParent.getFullyQualifiedName() + row.substring(oldParent.length());
  }
}
