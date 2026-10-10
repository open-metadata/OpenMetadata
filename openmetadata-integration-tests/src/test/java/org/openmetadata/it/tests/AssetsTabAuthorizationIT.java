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

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.function.Predicate;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.DatabaseTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.AddGlossaryToAssetsRequest;
import org.openmetadata.schema.api.AddTagToAssetsRequest;
import org.openmetadata.schema.api.classification.CreateClassification;
import org.openmetadata.schema.api.classification.CreateTag;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.domains.CreateDataProduct;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.domains.CreateDomain.DomainType;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.api.BulkAssets;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.type.api.BulkResponse;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;

/**
 * Each asset an Assets tab edit touches is authorized as the PATCH the user could make on that
 * asset's own page: the operations come from the patch, and the rules are evaluated against the
 * asset itself, so ownership and tag conditions apply. An asset the user may not edit is reported
 * as a failed row and keeps no change; the others in the same call go through.
 *
 * <p>Every user inherits the organization policy (an owner may do anything to what they own) and
 * the data consumer role (anyone may edit tags and glossary terms), so the cases below narrow those
 * with deny rules, or rely on ownership for the domain and data product fields, which only an owner
 * may change.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class AssetsTabAuthorizationIT {

  private static final Double CREATED_VERSION = 0.1;
  private static final Double FIRST_EDIT_VERSION = 0.2;
  private static final String FIELDS = "tags,domains,dataProducts";
  private static final Duration ASYNC_TIMEOUT = Duration.ofSeconds(60);
  private static final Duration QUIET_WINDOW = Duration.ofSeconds(8);

  /** An Assets tab, and what its edit does to an asset. */
  enum AssetsTab {
    TAG,
    GLOSSARY_TERM,
    DOMAIN,
    DATA_PRODUCT
  }

  private record Requester(User user, OpenMetadataClient client) {}

  /** What the tab adds: one of a tag, a glossary term, a domain or a data product. */
  private record Target(AssetsTab tab, String path, String fqn, UUID id) {}

  @ParameterizedTest
  @EnumSource(
      value = AssetsTab.class,
      names = {"TAG", "GLOSSARY_TERM"})
  void aLabelEditorLimitedToTheirOwnAssets_labelsTheirsAndIsRefusedTheOther(
      AssetsTab tab, TestNamespace ns) throws Exception {
    Rule onlyOwnTables =
        new Rule()
            .withName(ns.shortPrefix("ownonly"))
            .withResources(List.of(Entity.TABLE))
            .withOperations(
                List.of(MetadataOperation.EDIT_TAGS, MetadataOperation.EDIT_GLOSSARY_TERMS))
            .withEffect(Rule.Effect.DENY)
            .withCondition("!isOwner()");
    Requester requester = requester(ns, "ownonly", List.of(onlyOwnTables));
    Target target = target(ns, tab, null, null);
    DatabaseSchema schema = createSchema(ns, null);
    Table owned = createTable(ns, schema, "owned", requester.user(), null, null);
    Table other = createTable(ns, schema, "other", null, null, null);

    BulkOperationResult result = add(requester, target, owned, other);

    assertOnlyFirstChanged(requester, target, result, owned, other);
  }

  @ParameterizedTest
  @EnumSource(
      value = AssetsTab.class,
      names = {"DOMAIN", "DATA_PRODUCT"})
  void aDomainEditor_movesTheAssetsTheyMayEditAndNotTheOthers(AssetsTab tab, TestNamespace ns)
      throws Exception {
    Requester requester = requester(ns, "editor", List.of());
    Domain domain = createDomain(ns, "editor", domainOwner(tab, requester));
    Target target = target(ns, tab, domain, requester.user());
    DatabaseSchema schema = createSchema(ns, null);
    Domain tableDomain = tab == AssetsTab.DATA_PRODUCT ? domain : null;
    Table owned = createTable(ns, schema, "owned", requester.user(), tableDomain, null);
    Table other = createTable(ns, schema, "other", null, tableDomain, null);

    BulkOperationResult result = add(requester, target, owned, other);

    assertOnlyFirstChanged(requester, target, result, owned, other);
  }

  @ParameterizedTest
  @EnumSource(AssetsTab.class)
  void aDenyRuleOnOneAsset_failsThatRowOnly(AssetsTab tab, TestNamespace ns) throws Exception {
    Tag restricted = createTag(ns, "restricted");
    Rule denyRestricted =
        new Rule()
            .withName(ns.shortPrefix("deny"))
            .withResources(List.of("All"))
            .withOperations(
                List.of(
                    MetadataOperation.EDIT_ALL,
                    MetadataOperation.EDIT_TAGS,
                    MetadataOperation.EDIT_GLOSSARY_TERMS))
            .withEffect(Rule.Effect.DENY)
            .withCondition("matchAnyTag('" + restricted.getFullyQualifiedName() + "')");
    Requester requester = requester(ns, "deny", List.of(denyRestricted));
    Domain domain =
        holdsDomains(tab) ? createDomain(ns, "deny", domainOwner(tab, requester)) : null;
    Target target = target(ns, tab, domain, requester.user());
    DatabaseSchema schema = createSchema(ns, null);
    Domain tableDomain = tab == AssetsTab.DATA_PRODUCT ? domain : null;
    Table allowed = createTable(ns, schema, "allowed", requester.user(), tableDomain, null);
    Table denied =
        createTable(ns, schema, "denied", requester.user(), tableDomain, label(restricted));

    BulkOperationResult result = add(requester, target, allowed, denied);

    assertOnlyFirstChanged(requester, target, result, allowed, denied);
  }

  // ---------------------------------------------------------------------------------------------
  // The call and its checks
  // ---------------------------------------------------------------------------------------------

  private static BulkOperationResult add(Requester requester, Target target, Table... tables) {
    List<EntityReference> assets = new ArrayList<>();
    for (Table table : tables) {
      assets.add(table.getEntityReference());
    }
    Object request =
        switch (target.tab()) {
          case TAG -> new AddTagToAssetsRequest().withAssets(assets).withDryRun(false);
          case GLOSSARY_TERM -> new AddGlossaryToAssetsRequest()
              .withAssets(assets)
              .withDryRun(false);
          case DOMAIN, DATA_PRODUCT -> new BulkAssets().withAssets(assets).withDryRun(false);
        };
    Class<?> responseType = target.tab() == AssetsTab.TAG ? Void.class : BulkOperationResult.class;
    Object response =
        requester
            .client()
            .getHttpClient()
            .execute(HttpMethod.PUT, target.path() + "/assets/add", request, responseType);
    return response instanceof BulkOperationResult result ? result : null;
  }

  /**
   * The first table carries the change at a new version; the second is reported as refused (on the
   * synchronous tabs) and keeps no change.
   */
  private static void assertOnlyFirstChanged(
      Requester requester,
      Target target,
      BulkOperationResult result,
      Table changed,
      Table refused) {
    if (result != null) {
      assertEquals(ApiStatus.PARTIAL_SUCCESS, result.getStatus(), JsonUtils.pojoToJson(result));
      assertEquals(List.of(changed.getId()), requestIds(result.getSuccessRequest()));
      assertEquals(List.of(refused.getId()), requestIds(result.getFailedRequest()));
      String message = result.getFailedRequest().getFirst().getMessage();
      assertTrue(message.contains(requester.user().getName()), message);
    }
    Table after =
        Awaitility.await("the allowed asset is changed")
            .pollInterval(Duration.ofMillis(500))
            .atMost(ASYNC_TIMEOUT)
            .until(() -> fetch(changed), table -> FIRST_EDIT_VERSION.equals(table.getVersion()));
    assertTrue(carries(target).test(after), "the allowed asset carries the change");
    Awaitility.await("the refused asset keeps no change")
        .pollDelay(Duration.ofSeconds(1))
        .pollInterval(Duration.ofSeconds(1))
        .during(QUIET_WINDOW)
        .atMost(QUIET_WINDOW.plusSeconds(15))
        .until(() -> fetch(refused), table -> CREATED_VERSION.equals(table.getVersion()));
    assertFalse(carries(target).test(fetch(refused)), "the refused asset keeps no change");
  }

  private static boolean holdsDomains(AssetsTab tab) {
    return tab == AssetsTab.DOMAIN || tab == AssetsTab.DATA_PRODUCT;
  }

  // The requester owns the domain whose Assets tab they use, which lets them edit it.
  private static User domainOwner(AssetsTab tab, Requester requester) {
    return tab == AssetsTab.DOMAIN ? requester.user() : null;
  }

  private static Predicate<Table> carries(Target target) {
    return table ->
        switch (target.tab()) {
          case TAG, GLOSSARY_TERM -> table.getTags().stream()
              .anyMatch(label -> target.fqn().equals(label.getTagFQN()));
          case DOMAIN -> holds(table.getDomains(), target.id());
          case DATA_PRODUCT -> holds(table.getDataProducts(), target.id());
        };
  }

  private static boolean holds(List<EntityReference> refs, UUID id) {
    return refs != null && refs.stream().anyMatch(ref -> id.equals(ref.getId()));
  }

  private static Table fetch(Table table) {
    return SdkClients.adminClient().tables().get(table.getId().toString(), FIELDS);
  }

  private static List<UUID> requestIds(List<BulkResponse> responses) {
    List<UUID> ids = new ArrayList<>();
    for (BulkResponse response : responses == null ? List.<BulkResponse>of() : responses) {
      ids.add(JsonUtils.convertValue(response.getRequest(), EntityReference.class).getId());
    }
    return ids;
  }

  // ---------------------------------------------------------------------------------------------
  // Fixtures
  // ---------------------------------------------------------------------------------------------

  private static Requester requester(TestNamespace ns, String name, List<Rule> rules) {
    OpenMetadataClient admin = SdkClients.adminClient();
    String userName = ns.shortPrefix("u_" + name).toLowerCase();
    CreateUser createUser =
        new CreateUser().withName(userName).withEmail(userName + "@test.openmetadata.org");
    if (!rules.isEmpty()) {
      Policy policy =
          admin
              .policies()
              .create(
                  new CreatePolicy()
                      .withName(ns.shortPrefix("p_" + name))
                      .withDescription("Assets tab authorization")
                      .withRules(rules));
      Role role =
          admin
              .roles()
              .create(
                  new CreateRole()
                      .withName(ns.shortPrefix("r_" + name))
                      .withPolicies(List.of(policy.getFullyQualifiedName())));
      createUser.withRoles(List.of(role.getId()));
    }
    User user = admin.users().create(createUser);
    return new Requester(
        user, SdkClients.createClient(user.getName(), user.getEmail(), new String[] {}));
  }

  private static Target target(TestNamespace ns, AssetsTab tab, Domain domain, User owner) {
    return switch (tab) {
      case TAG -> {
        Tag tag = createTag(ns, "added");
        yield new Target(tab, "/v1/tags/" + tag.getId(), tag.getFullyQualifiedName(), null);
      }
      case GLOSSARY_TERM -> {
        GlossaryTerm term = createTerm(ns);
        yield new Target(
            tab, "/v1/glossaryTerms/" + term.getId(), term.getFullyQualifiedName(), null);
      }
      case DOMAIN -> new Target(
          tab,
          "/v1/domains/" + domain.getFullyQualifiedName(),
          domain.getFullyQualifiedName(),
          domain.getId());
      case DATA_PRODUCT -> {
        DataProduct product = createDataProduct(ns, domain, owner);
        yield new Target(
            tab,
            "/v1/dataProducts/" + product.getFullyQualifiedName(),
            product.getFullyQualifiedName(),
            product.getId());
      }
    };
  }

  private static Tag createTag(TestNamespace ns, String name) {
    OpenMetadataClient admin = SdkClients.adminClient();
    Classification classification =
        ns.trackRoot(
            Entity.CLASSIFICATION,
            admin
                .classifications()
                .create(
                    new CreateClassification()
                        .withName(ns.shortPrefix("cls_" + name))
                        .withDescription("Assets tab authorization")));
    return admin
        .tags()
        .create(
            new CreateTag()
                .withName(ns.shortPrefix("tag_" + name))
                .withClassification(classification.getFullyQualifiedName())
                .withDescription("Assets tab authorization"));
  }

  private static GlossaryTerm createTerm(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    Glossary glossary =
        ns.trackRoot(
            Entity.GLOSSARY,
            admin
                .glossaries()
                .create(
                    new CreateGlossary()
                        .withName(ns.shortPrefix("g_auth"))
                        .withDescription("Assets tab authorization")));
    return admin
        .glossaryTerms()
        .create(
            new CreateGlossaryTerm()
                .withName("term")
                .withGlossary(glossary.getFullyQualifiedName())
                .withDescription("Assets tab authorization"));
  }

  private static Domain createDomain(TestNamespace ns, String name, User owner) {
    return ns.trackRoot(
        Entity.DOMAIN,
        SdkClients.adminClient()
            .domains()
            .create(
                new CreateDomain()
                    .withName(ns.shortPrefix("dom_" + name))
                    .withDomainType(DomainType.AGGREGATE)
                    .withDescription("Assets tab authorization")
                    .withOwners(owners(owner))));
  }

  private static DataProduct createDataProduct(TestNamespace ns, Domain domain, User owner) {
    return SdkClients.adminClient()
        .dataProducts()
        .create(
            new CreateDataProduct()
                .withName(ns.shortPrefix("dp_auth"))
                .withDomains(List.of(domain.getFullyQualifiedName()))
                .withDescription("Assets tab authorization")
                .withOwners(owners(owner)));
  }

  private static DatabaseSchema createSchema(TestNamespace ns, Domain domain) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    Database database = DatabaseTestFactory.create(ns, service.getFullyQualifiedName());
    return SdkClients.adminClient()
        .databaseSchemas()
        .create(
            new CreateDatabaseSchema()
                .withName(ns.shortPrefix("schema"))
                .withDatabase(database.getFullyQualifiedName())
                .withDomains(domain == null ? null : List.of(domain.getFullyQualifiedName())));
  }

  private static Table createTable(
      TestNamespace ns,
      DatabaseSchema schema,
      String name,
      User owner,
      Domain domain,
      TagLabel label) {
    return SdkClients.adminClient()
        .tables()
        .create(
            new CreateTable()
                .withName(ns.shortPrefix(name))
                .withDatabaseSchema(schema.getFullyQualifiedName())
                .withColumns(
                    List.of(new Column().withName("id").withDataType(ColumnDataType.BIGINT)))
                .withOwners(owners(owner))
                .withDomains(domain == null ? null : List.of(domain.getFullyQualifiedName()))
                .withTags(label == null ? null : List.of(label)));
  }

  private static List<EntityReference> owners(User owner) {
    return owner == null ? null : List.of(owner.getEntityReference());
  }

  private static TagLabel label(Tag tag) {
    return new TagLabel()
        .withTagFQN(tag.getFullyQualifiedName())
        .withSource(TagLabel.TagSource.CLASSIFICATION)
        .withLabelType(TagLabel.LabelType.MANUAL)
        .withState(TagLabel.State.CONFIRMED);
  }
}
