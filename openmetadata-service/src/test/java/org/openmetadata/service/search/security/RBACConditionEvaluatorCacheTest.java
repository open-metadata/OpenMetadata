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
package org.openmetadata.service.search.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

import com.github.benmanes.caffeine.cache.Cache;
import java.lang.reflect.Field;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.search.queries.QueryBuilderFactory;
import org.springframework.expression.spel.standard.SpelExpression;

class RBACConditionEvaluatorCacheTest {

  private RBACConditionEvaluator evaluator;

  @BeforeEach
  void setUp() {
    evaluator = new RBACConditionEvaluator(mock(QueryBuilderFactory.class));
  }

  @Test
  void cachesExpressionsByCondition() {
    SpelExpression first = evaluator.parseCondition("isOwner()");
    SpelExpression second = evaluator.parseCondition(new String("isOwner()"));

    assertSame(first, second);
  }

  @Test
  void boundsExpressionCache() throws ReflectiveOperationException {
    for (int i = 0; i < 1_024; i++) {
      evaluator.parseCondition("'condition-" + i + "'");
    }

    Cache<?, ?> cache = getExpressionCache();
    cache.cleanUp();

    assertTrue(cache.estimatedSize() <= 512);
  }

  @Test
  void preservesLegacySpelParsingSemantics() {
    SpelExpression expression = evaluator.parseCondition("T(java.lang.String).valueOf('legacy')");

    assertEquals("legacy", expression.getValue());
  }

  private Cache<?, ?> getExpressionCache() throws ReflectiveOperationException {
    Field field = RBACConditionEvaluator.class.getDeclaredField("expressionCache");
    field.setAccessible(true);
    return (Cache<?, ?>) field.get(evaluator);
  }
}
