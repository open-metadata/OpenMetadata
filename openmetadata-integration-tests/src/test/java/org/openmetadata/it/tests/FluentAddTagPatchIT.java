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

import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.wrappers.FluentTable;

@ExtendWith(TestNamespaceExtension.class)
class FluentAddTagPatchIT {
  @Test
  void fluentAddTagPreservesExistingStoredTags(TestNamespace ns) {
    TagLabel existing = SharedEntities.get().PERSONAL_DATA_TAG_LABEL;
    String added = SharedEntities.get().PII_SENSITIVE_TAG_LABEL.getTagFQN();
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
                        List.of(new Column().withName("id").withDataType(ColumnDataType.BIGINT)))
                    .withTags(List.of(existing)));

    String id = table.getId().toString();
    assertEquals(List.of(existing.getTagFQN()), tagFqns(admin.tables().get(id, "tags")));
    Table fetched = admin.tables().get(id);
    assertEquals(List.of(), fetched.getTags(), "partial GET must omit the stored tag");
    new FluentTable(fetched, admin).addTag(added).save();

    Table withTags = admin.tables().get(id, "tags");
    assertEquals(
        List.of(existing.getTagFQN(), added).stream().sorted().toList(), tagFqns(withTags));

    new FluentTable(withTags, admin).removeTag(added).save();
    assertEquals(List.of(existing.getTagFQN()), tagFqns(admin.tables().get(id, "tags")));
  }

  private static List<String> tagFqns(Table table) {
    return table.getTags().stream().map(TagLabel::getTagFQN).sorted().toList();
  }
}
