/*
 *  Copyright 2025 Collate.
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
package org.openmetadata.codegen;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;

/**
 * Emits a typed index-document class for an entity from the same per-entity
 * spec that drives {@link MappingGenerator}. Callers populate this class and
 * hand it to the ES/OS client directly — no {@code Map<String,Object>}. The
 * document shape is engine-independent; only the mapping forks per engine.
 */
final class IndexDocGenerator {
  private static final String PACKAGE = "org.openmetadata.schema.search";
  private static final String LICENSE =
      """
      /*
       *  Copyright 2025 Collate.
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
      """;

  private static final Set<String> JAVA_KEYWORDS =
      Set.of(
          "abstract",
          "assert",
          "boolean",
          "break",
          "byte",
          "case",
          "catch",
          "char",
          "class",
          "const",
          "continue",
          "default",
          "do",
          "double",
          "else",
          "enum",
          "extends",
          "final",
          "finally",
          "float",
          "for",
          "goto",
          "if",
          "implements",
          "import",
          "instanceof",
          "int",
          "interface",
          "long",
          "native",
          "new",
          "package",
          "private",
          "protected",
          "public",
          "return",
          "short",
          "static",
          "strictfp",
          "super",
          "switch",
          "synchronized",
          "this",
          "throw",
          "throws",
          "transient",
          "try",
          "void",
          "volatile",
          "while");

  private final JsonNode fieldTypes;
  private final JsonNode fragmentTypes;
  private final Spec spec;

  IndexDocGenerator(Spec spec) {
    this.spec = spec;
    this.fieldTypes = spec.fieldTypes();
    this.fragmentTypes = spec.fragmentJavaTypes();
  }

  static String className(String entity) {
    StringBuilder sb = new StringBuilder();
    for (String part : entity.split("_")) {
      if (!part.isEmpty()) {
        sb.append(capitalize(part));
      }
    }
    return sb.append("IndexDoc").toString();
  }

  String generate(String entity) {
    String className = className(entity);
    TreeSet<String> imports = new TreeSet<>();
    StringBuilder members = new StringBuilder();
    Set<String> usedNames = new HashSet<>();
    for (Map.Entry<String, JsonNode> field : spec.entity(entity).get("fields").properties()) {
      String esName = field.getKey();
      String javaName = uniqueName(sanitize(esName), usedNames);
      String javaType = javaType(field.getValue(), imports);
      appendMember(esName, javaName, javaType, className, members, imports);
    }
    return render(className, imports, members.toString());
  }

  /** Maps an ES field name to a valid, unique Java identifier (e.g. {@code @timestamp}). */
  private String sanitize(String name) {
    StringBuilder sb = new StringBuilder();
    boolean capitalizeNext = false;
    for (int i = 0; i < name.length(); i++) {
      char c = name.charAt(i);
      if (Character.isLetterOrDigit(c) || c == '_' || c == '$') {
        sb.append(capitalizeNext ? Character.toUpperCase(c) : c);
        capitalizeNext = false;
      } else {
        if (c == '@') {
          sb.append("at");
        }
        capitalizeNext = !sb.isEmpty();
      }
    }
    if (sb.isEmpty()) {
      sb.append("field");
    }
    if (Character.isDigit(sb.charAt(0))) {
      sb.insert(0, '_');
    }
    return JAVA_KEYWORDS.contains(sb.toString()) ? sb.append('_').toString() : sb.toString();
  }

  private String uniqueName(String base, Set<String> used) {
    String name = base;
    for (int suffix = 2; !used.add(name); suffix++) {
      name = base + suffix;
    }
    return name;
  }

  private String javaType(JsonNode fieldDef, TreeSet<String> imports) {
    String base = baseType(fieldDef);
    registerImport(base, imports);
    if (fieldDef.path("list").asBoolean(false)) {
      imports.add("java.util.List");
      return "List<" + simpleName(base) + ">";
    }
    return simpleName(base);
  }

  private String baseType(JsonNode fieldDef) {
    if (fieldDef.has("type")) {
      return fieldTypes.get(fieldDef.get("type").asText()).get("_javaType").asText();
    }
    if (fieldDef.has("fragment")) {
      return fragmentTypes.get(fieldDef.get("fragment").asText()).asText();
    }
    return "Object";
  }

  private void registerImport(String type, TreeSet<String> imports) {
    String raw = rawType(type);
    if (raw.contains(".")) {
      imports.add(raw);
    }
  }

  private String simpleName(String type) {
    String raw = rawType(type);
    int generics = type.indexOf('<');
    String suffix = generics < 0 ? "" : type.substring(generics);
    int dot = raw.lastIndexOf('.');
    return (dot < 0 ? raw : raw.substring(dot + 1)) + suffix;
  }

  private String rawType(String type) {
    int generics = type.indexOf('<');
    return generics < 0 ? type : type.substring(0, generics);
  }

  private void appendMember(
      String esName,
      String javaName,
      String type,
      String className,
      StringBuilder sb,
      TreeSet<String> imports) {
    String cap = capitalize(javaName);
    if (!javaName.equals(esName)) {
      imports.add("com.fasterxml.jackson.annotation.JsonProperty");
      sb.append("  @JsonProperty(\"").append(esName).append("\")\n");
    }
    sb.append("  private ").append(type).append(' ').append(javaName).append(";\n\n");
    sb.append("  public ").append(type).append(" get").append(cap).append("() {\n");
    sb.append("    return ").append(javaName).append(";\n  }\n\n");
    sb.append("  public ").append(className).append(" with").append(cap);
    sb.append('(').append(type).append(' ').append(javaName).append(") {\n");
    sb.append("    this.").append(javaName).append(" = ").append(javaName).append(";\n");
    sb.append("    return this;\n  }\n\n");
  }

  private String render(String className, TreeSet<String> imports, String members) {
    imports.add("com.fasterxml.jackson.annotation.JsonInclude");
    StringBuilder sb = new StringBuilder(LICENSE);
    sb.append("package ").append(PACKAGE).append(";\n\n");
    imports.forEach(imp -> sb.append("import ").append(imp).append(";\n"));
    sb.append("\n/** Generated index document — do not edit. Source: elasticsearch/spec/.\n");
    sb.append(" *  The same spec drives the ES/OS mappings, so doc and mapping cannot drift. */\n");
    sb.append("@JsonInclude(JsonInclude.Include.NON_NULL)\n");
    sb.append("public class ").append(className).append(" {\n\n");
    sb.append(members).append("}\n");
    return sb.toString();
  }

  private static String capitalize(String value) {
    return Character.toUpperCase(value.charAt(0)) + value.substring(1);
  }
}
