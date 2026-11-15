package org.openmetadata.service.glossary;

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.GlossaryTermProperty;
import org.openmetadata.schema.type.GlossaryTermPropertyDatatype;

final class GlossaryTermPropertyTestFixtures {
  private GlossaryTermPropertyTestFixtures() {}

  static GlossaryTermProperty property(
      final String name, final GlossaryTermPropertyDatatype datatype) {
    return new GlossaryTermProperty().withName(name).withDatatype(datatype);
  }

  static GlossaryTermProperty enumProperty(
      final String name,
      final boolean multiValued,
      final boolean inheritable,
      final String... values) {
    return property(name, GlossaryTermPropertyDatatype.ENUM)
        .withEnumValues(new LinkedHashSet<>(List.of(values)))
        .withMultiValued(multiValued)
        .withInheritable(inheritable);
  }

  static GlossaryTerm term(
      final String fqn,
      final List<GlossaryTermProperty> definitions,
      final Map<String, List<String>> values) {
    final String[] parts = fqn.split("\\.");
    return new GlossaryTerm()
        .withId(UUID.nameUUIDFromBytes(fqn.getBytes()))
        .withName(parts[parts.length - 1])
        .withFullyQualifiedName(fqn)
        .withPropertyDefinitions(definitions)
        .withPropertyValues(values == null ? null : new LinkedHashMap<>(values));
  }
}
