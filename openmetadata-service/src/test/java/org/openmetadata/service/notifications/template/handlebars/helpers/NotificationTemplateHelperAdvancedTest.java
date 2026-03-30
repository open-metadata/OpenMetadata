/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.notifications.template.handlebars.helpers;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mockConstruction;
import static org.mockito.Mockito.mockStatic;

import com.github.jknack.handlebars.Handlebars;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.MockedConstruction;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.configuration.OpenMetadataBaseUrlConfiguration;
import org.openmetadata.schema.email.SmtpSettings;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.SystemRepository;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelper;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelperMetadata;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.util.email.DefaultTemplateProvider;

class NotificationTemplateHelperAdvancedTest {

  @Test
  void buildEntityUrlHelperMatchesLegacyRoutingForSpecialEntities() throws IOException {
    String rendered =
        render(
            """
            {{{buildEntityUrl tableType tableFqn}}}|
            {{{buildEntityUrl tagType tagFqn}}}|
            {{{buildEntityUrl pipelineType profilerPipeline}}}|
            {{{buildEntityUrl pipelineType qualityPipeline}}}|
            {{{buildEntityUrl queryType queryEntity}}}
            """,
            Map.of(
                "tableType",
                Entity.TABLE,
                "tableFqn",
                "service.sales.orders",
                "tagType",
                Entity.TAG,
                "tagFqn",
                "PII.Sensitive",
                "pipelineType",
                Entity.INGESTION_PIPELINE,
                "profilerPipeline",
                Map.of(
                    "fullyQualifiedName", "service.metadata.profiler",
                    "pipelineType", PipelineType.METADATA.value(),
                    "service",
                        Map.of(
                            "fullyQualifiedName",
                            "service.sales",
                            "type",
                            Entity.DATABASE_SERVICE)),
                "qualityPipeline",
                Map.of(
                    "fullyQualifiedName", "service.sales.orders.daily_test",
                    "pipelineType", PipelineType.TEST_SUITE.value(),
                    "service",
                        Map.of(
                            "fullyQualifiedName",
                            "service.sales.orders.testSuite",
                            "type",
                            Entity.TABLE)),
                "queryType",
                Entity.QUERY,
                "queryEntity",
                Map.of(
                    "fullyQualifiedName", "service.sales.orders.top_queries",
                    "id", "query-id",
                    "queryUsedIn",
                        List.of(
                            Map.of(
                                "id", "table-id", "fullyQualifiedName", "service.sales.orders")))),
            buildEntityUrlHelper("https://openmetadata.example"));

    assertEquals(
        "https://openmetadata.example/table/service.sales.orders|"
            + "https://openmetadata.example/tags/PII|"
            + "https://openmetadata.example/service/databaseServices/service.sales/ingestions|"
            + "https://openmetadata.example/table/service.sales.orders/profiler?activeTab=Data%20Quality|"
            + "https://openmetadata.example/table/service.sales.orders/table_queries?tableId=table-id&query=query-id&queryFrom=1",
        compact(rendered));
  }

  @Test
  void buildEntityUrlHelperReturnsBlankWhenRequiredInputIsMissing() throws IOException {
    String rendered =
        render(
            "{{buildEntityUrl entityType entity}}|{{buildEntityUrl entityType emptyFqn}}",
            Map.of(
                "entityType",
                Entity.TABLE,
                "entity",
                Map.of("fullyQualifiedName", "service.sales.orders"),
                "emptyFqn",
                ""),
            buildEntityUrlHelper(""));

    assertEquals("|", rendered);
  }

  @Test
  void groupEventChangesAndHasFieldInChangesMergeMatchingAddsAndDeletes() throws IOException {
    ChangeDescription changeDescription =
        new ChangeDescription()
            .withFieldsUpdated(
                List.of(
                    new FieldChange()
                        .withName("owner")
                        .withOldValue("old-owner")
                        .withNewValue("new-owner")))
            .withFieldsAdded(
                List.of(
                    new FieldChange().withName("owner").withNewValue("replacement-owner"),
                    new FieldChange().withName("owner").withNewValue("replacement-owner"),
                    new FieldChange().withName("tags").withNewValue("Tier.Tier1")))
            .withFieldsDeleted(
                List.of(
                    new FieldChange().withName("owner").withOldValue("deleted-owner"),
                    new FieldChange().withName("description").withOldValue("old description")));

    String rendered =
        render(
            """
            {{#with (groupEventChanges changeDescription) as |changes|}}
            {{length changes.updates}}|{{length changes.adds}}|{{length changes.deletes}}|
            {{#if (hasFieldInChanges changes 'owner')}}owner{{/if}}|
            {{#if (hasFieldInChanges changes 'description')}}description{{/if}}
            {{/with}}
            """,
            Map.of("changeDescription", changeDescription),
            new GroupEventChangesHelper(),
            new HasFieldInChangesHelper(),
            new LengthHelper());

    assertEquals("2|1|1|owner|description", compact(rendered));
  }

  @Test
  void parseEntityLinkAndResolveDomainHelpersHandleStructuredAndLookupInputs() throws IOException {
    UUID domainId = UUID.randomUUID();
    Domain domain = new Domain().withFullyQualifiedName("Business.Finance");

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity
          .when(() -> Entity.getEntity(Entity.DOMAIN, domainId, "id", Include.NON_DELETED))
          .thenReturn(domain);

      String rendered =
          render(
              """
              {{#with (parseEntityLink entityLink) as |link|}}
              {{link.entityType}}|{{link.entityFQN}}|{{link.field}}|{{link.arrayField}}|{{link.arrayValue}}
              {{/with}};
              {{resolveDomain displayDomain}};
              {{resolveDomain lookupDomain}};
              {{resolveDomain invalidDomain}}
              """,
              Map.of(
                  "entityLink",
                  "<#E::table::service.sales.orders::columns::order_id::description>",
                  "displayDomain",
                  Map.of("displayName", "Customer Success"),
                  "lookupDomain",
                  domainId.toString(),
                  "invalidDomain",
                  "not-a-domain-id"),
              new ParseEntityLinkHelper(),
              new ResolveDomainHelper());

      assertEquals(
          "table|service.sales.orders|columns|order_id|description;Customer Success;Business.Finance;not-a-domain-id",
          compact(rendered));
    }
  }

  @Test
  void processMentionsAndTextDiffPreserveRichTextOutput() throws IOException {
    String rendered =
        render(
            """
            {{{processMentions rawMention}}};
            {{{processMentions duplicatedAnchor}}};
            {{{textDiff oldText newText}}};
            {{{textDiff oldHtml newHtml insTag='mark' delTag='del'}}}
            """,
            Map.of(
                "rawMention",
                "Hello <#E::team::Legal Admin|[@Legal Admin](https://openmetadata.example/settings/members/teams/Legal%20Admin)>",
                "duplicatedAnchor",
                "<a href=\"https://openmetadata.example/users/alice\"></a><a href=\"https://openmetadata.example/users/alice\">@Alice</a>",
                "oldText",
                "alpha beta",
                "newText",
                "alpha gamma",
                "oldHtml",
                "<p>old</p>",
                "newHtml",
                "<p>new</p>"),
            new ProcessMentionsHelper(),
            new TextDiffHelper());

    assertEquals(
        "Hello <a href=\"https://openmetadata.example/settings/members/teams/Legal%20Admin\">@Legal Admin</a>;"
            + "<a href=\"https://openmetadata.example/users/alice\">@Alice</a>;"
            + "alpha <s>beta</s> <b>gamma</b>;"
            + "<p><del>old</del> <mark>new</mark></p>",
        compact(rendered));
  }

  @Test
  void renderTableSampleHelperHighlightsTargetColumnAndReportsOverflow() throws IOException {
    String longCell = "x".repeat(80);
    String rendered =
        render(
            "{{{renderTableSample sample targetColumn 3 2}}}",
            Map.of(
                "targetColumn",
                "status",
                "sample",
                Map.of(
                    "columns", List.of("id", "name", "description", "status"),
                    "rows",
                        List.of(
                            List.of("1", "<unsafe>", "orders table", longCell),
                            List.of("2", "beta", "customers table", "FAILED"),
                            List.of("3", "gamma", "payments table", "SUCCESS"),
                            List.of("4", "delta", "returns table", "SUCCESS")))),
            new RenderTableSampleHelper());

    assertTrue(rendered.contains("<strong>status</strong>"));
    assertTrue(rendered.contains("... and 1 more column(s)"));
    assertTrue(rendered.contains("... and 2 more record(s)"));
    assertTrue(rendered.contains("&lt;unsafe&gt;"));
    assertFalse(rendered.contains("<unsafe>"));
    assertTrue(rendered.contains("..."));
  }

  @ParameterizedTest
  @MethodSource("advancedHelpers")
  void advancedHelperMetadataRemainsAvailableForEditorDocumentation(HandlebarsHelper helper) {
    HandlebarsHelperMetadata metadata = helper.getMetadata();

    assertEquals(helper.getName(), metadata.getName());
    assertNotNull(metadata.getDescription());
    assertFalse(metadata.getDescription().isBlank());
    assertNotNull(metadata.getUsages());
    assertFalse(metadata.getUsages().isEmpty());
    assertTrue(metadata.getCursorOffset() > 0);
  }

  @Test
  void buildEntityUrlHelperDefaultBaseUrlDelegatesToEmailUtil() {
    try (MockedStatic<SettingsCache> settingsCache = mockStatic(SettingsCache.class);
        MockedConstruction<DefaultTemplateProvider> ignoredTemplateProvider =
            mockConstruction(DefaultTemplateProvider.class);
        MockedConstruction<SystemRepository> ignored =
            mockConstruction(
                SystemRepository.class,
                (repository, context) ->
                    org.mockito.Mockito.when(
                            repository.getConfigWithKey(
                                SettingsType.OPEN_METADATA_BASE_URL_CONFIGURATION.value()))
                        .thenReturn(
                            new Settings()
                                .withConfigType(SettingsType.OPEN_METADATA_BASE_URL_CONFIGURATION)
                                .withConfigValue(
                                    new OpenMetadataBaseUrlConfiguration()
                                        .withOpenMetadataUrl("https://openmetadata.example/"))))) {
      settingsCache
          .when(
              () -> SettingsCache.getSetting(SettingsType.EMAIL_CONFIGURATION, SmtpSettings.class))
          .thenReturn(new SmtpSettings().withEnableSmtpServer(false));

      class ExposedBuildEntityUrlHelper extends BuildEntityUrlHelper {
        private String exposedBaseUrl() {
          return getBaseUrl();
        }
      }

      assertEquals(
          "https://openmetadata.example", new ExposedBuildEntityUrlHelper().exposedBaseUrl());
    }
  }

  private static Stream<HandlebarsHelper> advancedHelpers() {
    return Stream.of(
        buildEntityUrlHelper("https://openmetadata.example"),
        new ResolveDomainHelper(),
        new ParseEntityLinkHelper(),
        new GroupEventChangesHelper(),
        new HasFieldInChangesHelper(),
        new ProcessMentionsHelper(),
        new RenderTableSampleHelper(),
        new TextDiffHelper());
  }

  private static BuildEntityUrlHelper buildEntityUrlHelper(String baseUrl) {
    return new BuildEntityUrlHelper() {
      @Override
      protected String getBaseUrl() {
        return baseUrl;
      }
    };
  }

  private static String render(String template, Object context, HandlebarsHelper... helpers)
      throws IOException {
    Handlebars handlebars = new Handlebars();
    for (HandlebarsHelper helper : helpers) {
      helper.register(handlebars);
    }
    return handlebars.compileInline(template).apply(context);
  }

  private static String compact(String text) {
    return text.replaceAll("\\s*\\n\\s*", "").trim();
  }
}
