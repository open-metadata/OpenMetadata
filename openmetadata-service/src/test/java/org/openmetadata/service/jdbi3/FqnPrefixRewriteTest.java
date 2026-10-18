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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.util.FullyQualifiedName;

class FqnPrefixRewriteTest {
  @Test
  void prefixesAreBoundAsLiteralJsonStringsAndHashedSegments() {
    final String before = FullyQualifiedName.build("svc", "a'b\\東京.$1");
    final String after = FullyQualifiedName.build("svc", "next\\雪.$2");
    final var rewrite = new FqnPrefixRewrite(before, after, FqnPrefixRewrite.Scope.ENTITY);
    assertEquals(before + ".", rewrite.oldPrefixWithSeparator());
    assertEquals(after + ".", rewrite.newPrefixWithSeparator());
    assertEquals(
        before + ".",
        JsonUtils.readTree(
                rewrite.oldJsonPrefix().substring(rewrite.oldJsonPrefix().indexOf(':') + 2) + "\"")
            .asText());
    assertEquals(
        after + ".",
        JsonUtils.readTree(
                rewrite.newJsonPrefix().substring(rewrite.newJsonPrefix().indexOf(':') + 2) + "\"")
            .asText());
    assertEquals(FullyQualifiedName.buildHash(before) + ".%", rewrite.pattern());
    assertEquals(FullyQualifiedName.buildHash(after) + ".", rewrite.newHashPrefix());
    assertFalse(rewrite.nested());
    assertTrue(new FqnPrefixRewrite(before, after, FqnPrefixRewrite.Scope.NESTED).nested());
  }

  @Test
  void incompleteRewriteIsRejectedBeforeExecutingSql() {
    assertThrows(
        IllegalArgumentException.class,
        () -> new FqnPrefixRewrite(null, "b", FqnPrefixRewrite.Scope.ENTITY));
    assertThrows(
        IllegalArgumentException.class,
        () -> new FqnPrefixRewrite("a", " ", FqnPrefixRewrite.Scope.ENTITY));
    assertThrows(NullPointerException.class, () -> new FqnPrefixRewrite("a", "b", null));
  }
}
