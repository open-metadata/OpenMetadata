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

import com.github.jknack.handlebars.Handlebars;
import java.io.IOException;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelper;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelperMetadata;

class NotificationTemplateHelperCoreTest {

  @Test
  void logicalAndComparisonHelpersRenderExpectedResults() throws IOException {
    String rendered =
        render(
            """
            {{#if (and first second third)}}and-true{{else}}and-false{{/if}}|
            {{#if (or missing alsoMissing fallback)}}or-true{{else}}or-false{{/if}}|
            {{#if (not zero)}}not-true{{else}}not-false{{/if}}|
            {{#if (eq left right)}}eq-true{{else}}eq-false{{/if}}|
            {{#if (gt current limit)}}gt-true{{else}}gt-false{{/if}}|
            {{#if (startsWith field prefix)}}starts-true{{else}}starts-false{{/if}}|
            {{#if (endsWith field suffix)}}ends-true{{else}}ends-false{{/if}}
            """,
            Map.ofEntries(
                Map.entry("first", true),
                Map.entry("second", "value"),
                Map.entry("third", 1),
                Map.entry("missing", false),
                Map.entry("alsoMissing", ""),
                Map.entry("fallback", "present"),
                Map.entry("zero", 0),
                Map.entry("left", "OpenMetadata"),
                Map.entry("right", "OpenMetadata"),
                Map.entry("current", "7"),
                Map.entry("limit", 3),
                Map.entry("field", "columns.owner"),
                Map.entry("prefix", "columns"),
                Map.entry("suffix", "owner")),
            new AndHelper(),
            new OrHelper(),
            new NotHelper(),
            new EqHelper(),
            new GtHelper(),
            new StartsWithHelper(),
            new EndsWithHelper());

    assertEquals(
        "and-true|or-true|not-true|eq-true|gt-true|starts-true|ends-true", compact(rendered));
  }

  @Test
  void collectionAndStringHelpersHandleSplittingSizingTruncationAndMath() throws IOException {
    String rendered =
        render(
            """
            {{#each (split path '.')}}{{this}}|{{/each}};
            {{length items}};
            {{#each (limit items 2)}}{{this}}|{{/each}};
            {{#each (limit items invalidLimit)}}{{this}}|{{/each}};
            {{truncate summary 8}};
            {{truncate summary 1}};
            {{math 7 '+' 5}};
            {{math 7 '/' 2}};
            {{math 3.14159 'round' 2}};
            {{camelCaseToTitle fieldName}}
            """,
            Map.of(
                "path", "service.database.table",
                "items", List.of("alpha", "beta", "gamma"),
                "invalidLimit", "not-a-number",
                "summary", "OpenMetadata",
                "fieldName", "testCaseStatus"),
            new SplitHelper(),
            new LengthHelper(),
            new LimitHelper(),
            new TruncateHelper(),
            new MathHelper(),
            new CamelCaseToTitleHelper());

    assertEquals(
        "service|database|table|;3;alpha|beta|;alpha|beta|gamma|;OpenMet…;…;12;3.5;3.14;Test Case Status",
        compact(rendered));
  }

  @Test
  void filterAndPluckHelpersSupportMapsJsonAndSingleObjects() throws IOException {
    String rendered =
        render(
            """
            {{#each (filter results status='Failed')}}{{name}}|{{/each}};
            {{#each (pluck tags 'tagFQN')}}{{this}}|{{/each}};
            {{#each (pluck jsonTags)}}{{name}}|{{/each}};
            {{pluck certification 'name'}}
            """,
            Map.of(
                "results",
                List.of(
                    Map.of("name", "freshness", "status", "Failed"),
                    Map.of("name", "row-count", "status", "Success"),
                    Map.of("name", "null-check", "status", "Failed")),
                "tags",
                List.of(
                    Map.of("tagFQN", "Tier.Tier1"),
                    Map.of("tagFQN", "PII.Sensitive"),
                    Map.of("tagFQN", "")),
                "jsonTags",
                """
                [{"name":"alpha"},{"name":"beta"}]
                """,
                "certification",
                new Certification("Gold", "A")),
            new FilterHelper(),
            new PluckHelper());

    assertEquals(
        "freshness|null-check|;Tier.Tier1|PII.Sensitive|;alpha|beta|;Gold", compact(rendered));
  }

  @Test
  void formatDateHelperFormatsTimestampsAndFallsBackForInvalidValues() throws IOException {
    long timestamp = 1_735_689_600_000L;
    String expected =
        DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")
            .withZone(ZoneId.systemDefault())
            .format(Instant.ofEpochMilli(timestamp));

    String rendered =
        render(
            "{{formatDate longTimestamp}}|{{formatDate stringTimestamp}}|{{formatDate invalidValue}}",
            Map.of(
                "longTimestamp",
                timestamp,
                "stringTimestamp",
                Long.toString(timestamp),
                "invalidValue",
                "not-a-timestamp"),
            new FormatDateHelper());

    assertEquals(expected + "|" + expected + "|not-a-timestamp", rendered);
  }

  @ParameterizedTest
  @MethodSource("coreHelpers")
  void helperMetadataRemainsAvailableForEditorDocumentation(HandlebarsHelper helper) {
    HandlebarsHelperMetadata metadata = helper.getMetadata();

    assertEquals(helper.getName(), metadata.getName());
    assertNotNull(metadata.getDescription());
    assertFalse(metadata.getDescription().isBlank());
    assertNotNull(metadata.getUsages());
    assertFalse(metadata.getUsages().isEmpty());
    assertTrue(metadata.getCursorOffset() > 0);
  }

  private static Stream<HandlebarsHelper> coreHelpers() {
    return Stream.of(
        new AndHelper(),
        new OrHelper(),
        new NotHelper(),
        new EqHelper(),
        new GtHelper(),
        new StartsWithHelper(),
        new EndsWithHelper(),
        new SplitHelper(),
        new LengthHelper(),
        new LimitHelper(),
        new TruncateHelper(),
        new MathHelper(),
        new CamelCaseToTitleHelper(),
        new FilterHelper(),
        new PluckHelper(),
        new FormatDateHelper());
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

  private record Certification(String name, String level) {}
}
