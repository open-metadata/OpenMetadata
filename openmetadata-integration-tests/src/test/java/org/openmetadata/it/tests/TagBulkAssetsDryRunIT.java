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

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.List;
import java.util.UUID;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.AddTagToAssetsRequest;
import org.openmetadata.schema.api.classification.CreateClassification;
import org.openmetadata.schema.api.classification.CreateTag;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TagLabel.TagSource;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.Databases;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * Integration tests for dryRun support on tag bulk asset add/remove operations
 * (PUT /v1/tags/{id}/assets/add and PUT /v1/tags/{id}/assets/remove).
 *
 * <p>Covers the fix for issue #27954 where dryRun=true on the remove endpoint
 * still removed the tag from the target asset.
 *
 * <p>Notes on async behavior: the tag bulk asset endpoints are async — the HTTP
 * response is a job id, and the actual mutation runs on a background executor.
 * Tests use Awaitility with {@code during(...)} to assert that no mutation occurs
 * during a sustained window for dryRun=true, and {@code untilAsserted(...)} to wait
 * for the mutation to land for dryRun=false.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class TagBulkAssetsDryRunIT {

  private static final Duration DRY_RUN_NO_OP_WINDOW = Duration.ofSeconds(5);
  private static final Duration ASYNC_COMPLETION_TIMEOUT = Duration.ofSeconds(30);

  @Test
  void test_dryRunRemove_doesNotRemoveTagFromAsset(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Tag tag = createTag(ns, client, "dry_run_remove");
    TagLabel tagLabel = toTagLabel(tag);
    Table table = createTableWithTag(ns, tagLabel);

    AddTagToAssetsRequest dryRunRemove =
        new AddTagToAssetsRequest()
            .withDryRun(true)
            .withAssets(List.of(table.getEntityReference()));
    String removePath = "/v1/tags/" + tag.getId() + "/assets/remove";
    client.getHttpClient().execute(HttpMethod.PUT, removePath, dryRunRemove, Void.class);

    UUID tableId = table.getId();
    String tagFqn = tag.getFullyQualifiedName();
    Awaitility.await("Tag must remain on the asset throughout the dryRun window")
        .pollDelay(Duration.ofMillis(500))
        .pollInterval(Duration.ofSeconds(1))
        .atMost(DRY_RUN_NO_OP_WINDOW.plusSeconds(5))
        .during(DRY_RUN_NO_OP_WINDOW)
        .until(() -> hasTag(client, tableId, tagFqn));
  }

  @Test
  void test_dryRunRemove_defaultDryRunTrue_doesNotRemoveTagFromAsset(TestNamespace ns)
      throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Tag tag = createTag(ns, client, "default_dry_run");
    TagLabel tagLabel = toTagLabel(tag);
    Table table = createTableWithTag(ns, tagLabel);

    AddTagToAssetsRequest defaultDryRun =
        new AddTagToAssetsRequest().withAssets(List.of(table.getEntityReference()));
    String removePath = "/v1/tags/" + tag.getId() + "/assets/remove";
    client.getHttpClient().execute(HttpMethod.PUT, removePath, defaultDryRun, Void.class);

    UUID tableId = table.getId();
    String tagFqn = tag.getFullyQualifiedName();
    Awaitility.await("Tag must remain on the asset when dryRun field is omitted (defaults to true)")
        .pollDelay(Duration.ofMillis(500))
        .pollInterval(Duration.ofSeconds(1))
        .atMost(DRY_RUN_NO_OP_WINDOW.plusSeconds(5))
        .during(DRY_RUN_NO_OP_WINDOW)
        .until(() -> hasTag(client, tableId, tagFqn));
  }

  @Test
  void test_actualRemove_withoutDryRun_removesTagFromAsset(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Tag tag = createTag(ns, client, "real_remove");
    TagLabel tagLabel = toTagLabel(tag);
    Table table = createTableWithTag(ns, tagLabel);

    AddTagToAssetsRequest realRemove =
        new AddTagToAssetsRequest()
            .withDryRun(false)
            .withAssets(List.of(table.getEntityReference()));
    String removePath = "/v1/tags/" + tag.getId() + "/assets/remove";
    client.getHttpClient().execute(HttpMethod.PUT, removePath, realRemove, Void.class);

    UUID tableId = table.getId();
    String tagFqn = tag.getFullyQualifiedName();
    Awaitility.await("Tag should be removed from the asset when dryRun=false")
        .pollDelay(Duration.ofMillis(500))
        .pollInterval(Duration.ofSeconds(1))
        .atMost(ASYNC_COMPLETION_TIMEOUT)
        .untilAsserted(() -> assertFalse(hasTag(client, tableId, tagFqn)));
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private Tag createTag(TestNamespace ns, OpenMetadataClient client, String suffix) {
    Classification classification =
        client
            .classifications()
            .create(
                new CreateClassification()
                    .withName(ns.prefix("classification_" + suffix))
                    .withDescription("Classification for dryRun remove test"));

    return client
        .tags()
        .create(
            new CreateTag()
                .withName(ns.prefix("tag_" + suffix))
                .withClassification(classification.getFullyQualifiedName())
                .withDescription("Tag for dryRun remove test"));
  }

  private TagLabel toTagLabel(Tag tag) {
    return new TagLabel()
        .withTagFQN(tag.getFullyQualifiedName())
        .withSource(TagSource.CLASSIFICATION)
        .withLabelType(TagLabel.LabelType.MANUAL);
  }

  private Table createTableWithTag(TestNamespace ns, TagLabel tagLabel) throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    Database database =
        Databases.create().name(ns.prefix("db")).in(service.getFullyQualifiedName()).execute();
    DatabaseSchema schema = DatabaseSchemaTestFactory.create(ns, database.getFullyQualifiedName());

    CreateTable createTable =
        new CreateTable()
            .withName(ns.prefix("table"))
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withColumns(
                List.of(
                    new Column()
                        .withName("id")
                        .withDataType(ColumnDataType.BIGINT)
                        .withDescription("ID column")))
            .withTags(List.of(tagLabel));

    Table created = SdkClients.adminClient().tables().create(createTable);
    Table fetched = SdkClients.adminClient().tables().get(created.getId().toString(), "tags");
    assertNotNull(fetched.getTags(), "Newly created table should expose its tags");
    assertTrue(
        fetched.getTags().stream().anyMatch(t -> tagLabel.getTagFQN().equals(t.getTagFQN())),
        "Newly created table should already have the test tag applied");
    return fetched;
  }

  private boolean hasTag(OpenMetadataClient client, UUID tableId, String tagFqn) {
    Table refreshed = client.tables().get(tableId.toString(), "tags");
    return refreshed.getTags() != null
        && refreshed.getTags().stream().anyMatch(t -> tagFqn.equals(t.getTagFQN()));
  }
}
