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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.Tables;
import org.openmetadata.sdk.fluent.wrappers.FluentTable;

/**
 * End-to-end regression IT for the Java SDK fluent-wrapper {@code addTag().save()} PATCH
 * silent-tag-data-loss bug. Mirrors the manual reproduction in the test plan's T9 procedure
 * against a real OpenMetadata server.
 *
 * <p>The bug: when an entity schema's top-level {@code tags} property declared {@code
 * "default": null} (Table, Pipeline, MlModel, SearchIndex), the SDK's {@link
 * org.openmetadata.sdk.services.EntityServiceBase#update} computed a JSON-Patch against an
 * in-memory snapshot that omitted the {@code tags} member, so a fluent {@code addTag().save()}
 * emitted a wholesale {@code add /tags} op that the server applied as an array replacement,
 * silently deleting every previously saved tag while returning HTTP 200. The fix set the schema
 * {@code tags} default to {@code []} so the snapshot carries {@code "tags": []} and the diff
 * emits index-level {@code add /tags/N} ops that insert into the stored array.
 *
 * <p>Scenario:
 *
 * <ol>
 *   <li>Create a table.
 *   <li>Apply a pre-existing classification tag {@code PII.PersonalData} directly via the SDK
 *       (the stored entity has one pre-existing user-applied tag).
 *   <li>Fetch the table with NO {@code fields} parameter (the documented fluent fetch; the SDK
 *       snapshot omits {@code tags} on the wire).
 *   <li>Call {@code new FluentTable(table, client).addTag("PII.Sensitive").save()}.
 *   <li>Re-fetch with {@code fields=tags} and assert BOTH {@code PII.PersonalData} (the
 *       pre-existing tag) AND {@code PII.Sensitive} (the new tag) are present — no data loss.
 * </ol>
 *
 * <p>Pre-fix: step 5 would show only {@code PII.Sensitive} — the pre-existing tag would have been
 * silently deleted. This IT pins the fixed contract: pre-existing tags survive the fluent
 * {@code addTag().save()} flow.
 */
@ExtendWith(TestNamespaceExtension.class)
class FluentAddTagPatchIT {

  private static String existingTagFqn;
  private static String newTagFqn;

  @BeforeAll
  static void setupSdkDefaultClient() {
    OpenMetadataClient admin = SdkClients.adminClient();
    Tables.setDefaultClient(admin);
    existingTagFqn = SharedEntities.get().PERSONAL_DATA_TAG_LABEL.getTagFQN();
    newTagFqn = SharedEntities.get().PII_SENSITIVE_TAG_LABEL.getTagFQN();
    assertNotNull(existingTagFqn, "SharedEntities must expose a pre-existing classification tag");
    assertNotNull(newTagFqn, "SharedEntities must expose a second classification tag for the add");
  }

  @AfterAll
  static void clearSdkDefaultClient() {
    Tables.setDefaultClient(null);
  }

  @Test
  void fluentAddTag_preservesExistingStoredTags(TestNamespace ns) throws Exception {
    // 1. Create a fresh table with NO tags.
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);
    OpenMetadataClient admin = SdkClients.adminClient();
    Table table =
        admin
            .tables()
            .create(
                new CreateTable()
                    .withName(ns.shortPrefix("fluent_addtag"))
                    .withDatabaseSchema(schema.getFullyQualifiedName())
                    .withColumns(
                        List.of(new Column().withName("id").withDataType(ColumnDataType.BIGINT))));

    // 2. Apply a pre-existing classification tag directly via a JSON-Patch (this is what a user
    //    or governance process would have done previously — the stored entity has one tag).
    com.fasterxml.jackson.databind.node.ArrayNode patch =
        com.fasterxml.jackson.databind.node.JsonNodeFactory.instance.arrayNode();
    patch.add(
        com.fasterxml.jackson.databind.node.JsonNodeFactory.instance
            .objectNode()
            .put("op", "add")
            .put("path", "/tags/-")
            .set("value", org.openmetadata.schema.utils.JsonUtils.valueToTree(classificationTag(existingTagFqn))));
    admin.tables().patch(table.getId(), patch);

    // Sanity: stored entity now carries exactly the pre-existing tag.
    Table stored = admin.tables().get(table.getId().toString(), "tags");
    assertEquals(
        List.of(existingTagFqn),
        tagFqns(stored.getTags()),
        "precondition: stored table must carry the pre-existing tag");

    // 3. Fetch with NO fields=tags. This is the documented fluent-fetch pattern; the server
    //    omits tags from the response. Pre-fix POJO has tags == null; post-fix POJO has [].
    Table fetchedNoFields = admin.tables().get(table.getId().toString());

    // 4. THE BUG-TRIGGERING STEP: add one tag via the fluent API and save (PATCH).
    new FluentTable(fetchedNoFields, admin).addTag(newTagFqn).save();

    // 5. Re-fetch WITH fields=tags and assert BOTH tags survived (the fix) — no silent data
    //    loss. Pre-fix this asserted only [newTagFqn] and the existing tag was gone.
    Table refetched = admin.tables().get(table.getId().toString(), "tags");
    Set<String> finalTagFqns = tagFqns(refetched.getTags()).stream().collect(Collectors.toSet());
    assertTrue(
        finalTagFqns.contains(newTagFqn),
        "the new tag added via FluentTable.addTag().save() must be on the table; got "
            + finalTagFqns);
    assertTrue(
        finalTagFqns.contains(existingTagFqn),
        "the pre-existing stored tag MUST survive the fluent addTag().save() PATCH (the bug "
            + "would delete it); got "
            + finalTagFqns);
    assertEquals(
        2,
        finalTagFqns.size(),
        "exactly the pre-existing tag + the newly added tag should be present; got "
            + finalTagFqns);
  }

  private static TagLabel classificationTag(String tagFqn) {
    return new TagLabel()
        .withTagFQN(tagFqn)
        .withSource(TagLabel.TagSource.CLASSIFICATION)
        .withLabelType(TagLabel.LabelType.MANUAL)
        .withState(TagLabel.State.CONFIRMED);
  }

  private static List<String> tagFqns(List<TagLabel> tags) {
    if (tags == null) return List.of();
    return tags.stream().map(TagLabel::getTagFQN).toList();
  }
}
