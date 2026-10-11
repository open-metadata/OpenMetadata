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

package org.openmetadata.service.rdf;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.networknt.schema.Error;
import com.networknt.schema.Schema;
import com.networknt.schema.SchemaLocation;
import com.networknt.schema.SchemaRegistry;
import com.networknt.schema.SpecificationVersion;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;
import java.util.stream.Stream;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.schema.api.rdf.RdfReasoningCapabilities;
import org.openmetadata.schema.api.rdf.RdfReasoningJob;
import org.openmetadata.schema.api.rdf.RdfReasoningJobRequest;
import org.openmetadata.schema.api.rdf.RdfReasoningSnapshot;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * The reasoning protocol between OpenMetadata and the RDF store. Each example under {@code
 * rdf/reasoning/} must satisfy its JSON Schema and survive the generated Java model unchanged,
 * because the store implements the protocol from the schemas, not from these classes.
 */
class RdfReasoningContractTest {
  private static final String SCHEMA_BASE = "https://open-metadata.org/schema/";
  private static final SchemaRegistry SCHEMAS =
      SchemaRegistry.withDefaultDialect(
          SpecificationVersion.DRAFT_2020_12,
          builder ->
              builder.schemaIdResolvers(
                  ids -> ids.mapPrefix(SCHEMA_BASE, "classpath:json/schema/")));

  private enum Contract {
    REQUEST("rdfReasoningJobRequest", RdfReasoningJobRequest.class),
    JOB("rdfReasoningJob", RdfReasoningJob.class),
    CAPABILITIES("rdfReasoningCapabilities", RdfReasoningCapabilities.class),
    SNAPSHOT("rdfReasoningSnapshot", RdfReasoningSnapshot.class);

    private final String schemaName;
    private final Class<?> model;

    Contract(final String schemaName, final Class<?> model) {
      this.schemaName = schemaName;
      this.model = model;
    }

    List<Error> validate(final JsonNode document) {
      final Schema schema =
          SCHEMAS.getSchema(SchemaLocation.of(SCHEMA_BASE + "api/rdf/" + schemaName + ".json"));
      return schema.validate(document);
    }
  }

  static Stream<Arguments> examples() {
    return Stream.of(
        Arguments.of("refresh-request", Contract.REQUEST),
        Arguments.of("refresh-request-with-rule", Contract.REQUEST),
        Arguments.of("check-subsumption-request", Contract.REQUEST),
        Arguments.of("explain-request", Contract.REQUEST),
        Arguments.of("succeeded-refresh-job", Contract.JOB),
        Arguments.of("incomplete-check-job", Contract.JOB),
        Arguments.of("generation-mismatch-job", Contract.JOB),
        Arguments.of("cancel-requested-job", Contract.JOB),
        Arguments.of("interrupted-job", Contract.JOB),
        Arguments.of("ready-capabilities", Contract.CAPABILITIES),
        Arguments.of("not-ready-capabilities", Contract.CAPABILITIES),
        Arguments.of("stale-snapshot", Contract.SNAPSHOT));
  }

  @ParameterizedTest(name = "{0}")
  @MethodSource("examples")
  void everyExampleConformsToItsContract(final String example, final Contract contract) {
    assertEquals(List.of(), messages(contract.validate(read(example))));
  }

  @ParameterizedTest(name = "{0}")
  @MethodSource("examples")
  void theGeneratedModelKeepsEveryFieldAndWritesValidJson(
      final String example, final Contract contract) {
    final JsonNode sent = read(example);

    final JsonNode written = JsonUtils.valueToTree(JsonUtils.convertValue(sent, contract.model));

    assertContains(sent, written, "$");
    assertEquals(List.of(), messages(contract.validate(written)));
  }

  static Stream<Arguments> violations() {
    return Stream.of(
        violation(
            "a digest that is not a SHA-256",
            "refresh-request",
            Contract.REQUEST,
            request -> request.put("ruleBundleDigest", "sha256:example"),
            "pattern"),
        violation(
            "a negative live-write watermark",
            "refresh-request",
            Contract.REQUEST,
            request -> object(request, "sourceRevision").put("liveWriteWatermark", -1),
            "minimum"),
        violation(
            "a request without a source revision",
            "refresh-request",
            Contract.REQUEST,
            request -> request.remove("sourceRevision"),
            "required"),
        violation(
            "a request field the protocol does not define",
            "refresh-request",
            Contract.REQUEST,
            request -> request.put("ontologyUrl", "https://example.org/remote.owl"),
            "additionalProperties"),
        violation(
            "more rules than one bundle may carry",
            "refresh-request-with-rule",
            Contract.REQUEST,
            request -> {
              final ArrayNode rules = (ArrayNode) request.get("rules");
              final JsonNode rule = rules.get(0);
              while (rules.size() <= 256) {
                rules.add(rule.deepCopy());
              }
            },
            "maxItems"),
        violation(
            "INCOMPLETE as an execution state",
            "incomplete-check-job",
            Contract.JOB,
            job -> job.put("state", "INCOMPLETE"),
            "enum"),
        violation(
            "STALE as the answer of a check",
            "incomplete-check-job",
            Contract.JOB,
            job -> job.put("outcome", "STALE"),
            "enum"),
        violation(
            "SUCCEEDED as a freshness",
            "stale-snapshot",
            Contract.SNAPSHOT,
            snapshot -> snapshot.put("freshness", "SUCCEEDED"),
            "enum"),
        violation(
            "a problem without a code",
            "generation-mismatch-job",
            Contract.JOB,
            job -> object(job, "problem").remove("code"),
            "required"),
        violation(
            "a protocol version that is not a number",
            "ready-capabilities",
            Contract.CAPABILITIES,
            capabilities -> capabilities.put("protocolVersion", "v1"),
            "pattern"));
  }

  @ParameterizedTest(name = "{0}")
  @MethodSource("violations")
  void theContractRejects(
      final String violation,
      final String example,
      final Contract contract,
      final Consumer<ObjectNode> change,
      final String keyword) {
    final ObjectNode document = (ObjectNode) read(example);
    change.accept(document);

    final List<Error> errors = contract.validate(document);

    assertTrue(
        errors.stream().anyMatch(error -> keyword.equals(error.getKeyword())),
        () -> "Expected a '" + keyword + "' violation, got " + messages(errors));
  }

  private static Arguments violation(
      final String violation,
      final String example,
      final Contract contract,
      final Consumer<ObjectNode> change,
      final String keyword) {
    return Arguments.of(violation, example, contract, change, keyword);
  }

  private static ObjectNode object(final ObjectNode parent, final String field) {
    return (ObjectNode) parent.get(field);
  }

  private static JsonNode read(final String example) {
    final String path = "/rdf/reasoning/" + example + ".json";
    try (InputStream input = RdfReasoningContractTest.class.getResourceAsStream(path)) {
      if (input == null) {
        throw new IllegalStateException("Missing example " + path);
      }
      return JsonUtils.readTree(new String(input.readAllBytes(), StandardCharsets.UTF_8));
    } catch (IOException e) {
      throw new UncheckedIOException(e);
    }
  }

  private static List<String> messages(final List<Error> errors) {
    return errors.stream().map(Error::getMessage).toList();
  }

  /** Every value in {@code expected} is in {@code actual}; defaults the model adds are allowed. */
  private static void assertContains(
      final JsonNode expected, final JsonNode actual, final String path) {
    if (expected.isObject()) {
      for (final Map.Entry<String, JsonNode> field : expected.properties()) {
        final String fieldPath = path + "." + field.getKey();
        assertTrue(actual.has(field.getKey()), fieldPath + " was dropped");
        assertContains(field.getValue(), actual.get(field.getKey()), fieldPath);
      }
    } else if (expected.isArray()) {
      assertEquals(expected.size(), actual.size(), path + " changed length");
      for (int i = 0; i < expected.size(); i++) {
        assertContains(expected.get(i), actual.get(i), path + "[" + i + "]");
      }
    } else if (expected.isNumber()) {
      assertTrue(actual.isNumber(), path + " is no longer a number: " + actual);
      assertEquals(
          0,
          expected.decimalValue().compareTo(actual.decimalValue()),
          path + " changed from " + expected + " to " + actual);
    } else {
      assertEquals(expected, actual, path);
    }
  }
}
