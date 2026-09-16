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

package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.mock;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.FieldDataType;
import org.openmetadata.schema.type.MessageSchema;
import org.openmetadata.schema.utils.JsonUtils;

class EntityRepositoryStorageSerializationTest {

  @Test
  void serializeForStorage_removesNulBeforeDatabaseAndCacheWrites() {
    TopicRepository repository = mock(TopicRepository.class, CALLS_REAL_METHODS);
    Topic topic =
        new Topic()
            .withMessageSchema(
                new MessageSchema()
                    .withSchemaFields(
                        List.of(
                            new Field()
                                .withName("id")
                                .withDataType(FieldDataType.STRING)
                                .withDescription("nested >\u0000< NUL"))));

    String serialized = repository.serializeForStorage(topic);

    assertEquals(
        "nested >< NUL",
        JsonUtils.readTree(serialized).at("/messageSchema/schemaFields/0/description").asText());
  }
}
