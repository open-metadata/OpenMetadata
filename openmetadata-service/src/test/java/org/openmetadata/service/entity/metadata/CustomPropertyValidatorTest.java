package org.openmetadata.service.entity.metadata;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.networknt.schema.Schema;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.entity.metadata.CustomPropertyValidator.Definition;

class CustomPropertyValidatorTest {
  private static final String ENUM_CONFIG = "{\"multiSelect\":true,\"values\":[\"a\",\"b\"]}";
  private static final Schema ANY_VALUE = JsonUtils.getJsonSchema("{}");

  @Test
  void validationAndTransformationShareOneInputSnapshot() {
    final CountingInput input = new CountingInput();
    final var validator = validator(new Definition("string", null));

    final Object result = validator.validateAndTransform(input, "table");

    assertEquals(Map.of("note", "retained"), result);
    assertEquals(1, input.reads);
  }

  @Test
  void unknownFieldsAndSchemaViolationsRetainTheirValidationErrors() {
    final var validator =
        new CustomPropertyValidator(
            (type, field) ->
                field.equals("note") ? JsonUtils.getJsonSchema("{\"type\":\"string\"}") : null,
            (type, field) -> new Definition("string", null),
            (value, field) -> {},
            (value, field) -> {});

    assertThrows(
        IllegalArgumentException.class, () -> validator.validate(Map.of("unknown", 1), "table"));
    assertThrows(
        IllegalArgumentException.class,
        () -> validator.validateAndTransform(Map.of("note", 1), "table"));
    validator.validate(Map.of("note", "valid"), "table");
    assertNull(validator.validateAndTransform(null, "table"));
    assertNull(validator.validateAndTransform(List.of(), "table"));
  }

  @Test
  void enumValuesAreSortedWithoutChangingInputOrDroppingDuplicates() {
    final var input = JsonUtils.readTree("{\"note\":[\"b\",\"a\",\"a\"]}");
    final var validator = validator(new Definition("enum", ENUM_CONFIG));

    final Object result = validator.validateAndTransform(input, "table");

    assertEquals(Map.of("note", List.of("a", "a", "b")), result);
    assertEquals("b", input.get("note").get(0).asText());
    assertThrows(
        IllegalArgumentException.class,
        () -> validator.validateAndTransform(Map.of("note", List.of("c")), "table"));
    assertThrows(
        IllegalArgumentException.class,
        () ->
            CustomPropertyValidator.validateEnumKeys(
                "note", input.get("note"), "{\"multiSelect\":false,\"values\":[\"a\",\"b\"]}"));
  }

  @ParameterizedTest
  @CsvSource({
    "date-cp,yyyy-MM-dd,2026-09-10",
    "dateTime-cp,yyyy-MM-dd HH:mm:ss,2026-09-10 15:30:00",
    "time-cp,HH:mm,15:30"
  })
  void dateAndTimeValuesUseTheirConfiguredFormat(
      final String type, final String format, final String value) {
    final var validator = validator(new Definition(type, format));

    assertEquals(
        Map.of("note", value), validator.validateAndTransform(Map.of("note", value), "table"));
    assertThrows(
        IllegalArgumentException.class,
        () -> validator.validateAndTransform(Map.of("note", "invalid"), "table"));
  }

  @Test
  void hyperlinksAcceptHttpAndHttpsAndRejectOtherProtocolsOrMalformedUris() {
    final var validator = validator(new Definition("hyperlink-cp", null));
    for (final String url : List.of("https://example.com/path", "http://example.com/path")) {
      final var input = Map.of("note", Map.of("url", url));
      assertEquals(input, validator.validateAndTransform(input, "table"));
    }
    assertEquals(
        Map.of("note", Map.of()),
        validator.validateAndTransform(Map.of("note", Map.of()), "table"));
    for (final String url : List.of("ftp://example.com", "/relative", "https://invalid host")) {
      assertThrows(
          IllegalArgumentException.class,
          () -> validator.validateAndTransform(Map.of("note", Map.of("url", url)), "table"));
    }
  }

  @Test
  void tableValuesRejectUndefinedColumnsAndRowKeys() {
    final var validator = validator(new Definition("table-cp", "{\"columns\":[\"name\"]}"));
    final var valid =
        Map.of(
            "note", Map.of("columns", List.of("name"), "rows", List.of(Map.of("name", "value"))));
    assertEquals(valid, validator.validateAndTransform(valid, "table"));
    assertThrows(
        IllegalArgumentException.class,
        () ->
            validator.validateAndTransform(
                Map.of(
                    "note",
                    Map.of("columns", List.of("extra"), "rows", List.of(Map.of("extra", "value")))),
                "table"));
    assertThrows(
        IllegalArgumentException.class,
        () ->
            validator.validateAndTransform(
                Map.of(
                    "note",
                    Map.of("columns", List.of("name"), "rows", List.of(Map.of("extra", "value")))),
                "table"));
  }

  @Test
  void tableSchemaViolationsRetainThePropertyAndInvalidFieldInTheError() {
    final var validator = validator(new Definition("table-cp", "{\"columns\":[\"name\"]}"));
    final var invalid = Map.of("note", Map.of("columns", List.of(), "rows", List.of()));
    final var failure =
        assertThrows(
            IllegalArgumentException.class, () -> validator.validateAndTransform(invalid, "table"));
    assertTrue(failure.getMessage().contains("note"));
    assertTrue(failure.getMessage().contains("columns"));
  }

  @Test
  void aNullableHyperlinkRetainsItsExplicitNullValue() {
    final var validator = validator(new Definition("hyperlink-cp", null));
    final var input = JsonUtils.readTree("{\"note\":null}");
    final Object transformed = validator.validateAndTransform(input, "table");
    assertEquals(input, JsonUtils.valueToTree(transformed));
    assertTrue(input.get("note").isNull());
  }

  @Test
  void referenceFailuresAreNotSuppressed() {
    final var validator =
        new CustomPropertyValidator(
            (type, field) -> ANY_VALUE,
            (type, field) -> new Definition(field, null),
            (value, field) -> {
              throw new IllegalArgumentException("Missing reference");
            },
            (value, field) -> {
              throw new IllegalArgumentException("Missing reference list");
            });

    assertTrue(
        assertThrows(
                IllegalArgumentException.class,
                () ->
                    validator.validateAndTransform(
                        Map.of("entityReference", Map.of("id", "missing")), "table"))
            .getMessage()
            .contains("Missing reference"));
    assertTrue(
        assertThrows(
                IllegalArgumentException.class,
                () ->
                    validator.validateAndTransform(
                        Map.of("entityReferenceList", List.of()), "table"))
            .getMessage()
            .contains("Missing reference list"));
  }

  private CustomPropertyValidator validator(final Definition definition) {
    return new CustomPropertyValidator(
        (type, field) -> ANY_VALUE,
        (type, field) -> definition,
        (value, field) -> {},
        (value, field) -> {});
  }

  private static final class CountingInput {
    @JsonIgnore private int reads;

    public String getNote() {
      reads++;
      return "retained";
    }
  }
}
