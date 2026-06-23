package org.openmetadata.service.rdf.extension;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.configuration.rdf.CustomOntology;
import org.openmetadata.schema.api.configuration.rdf.CustomOntologyClass;
import org.openmetadata.schema.api.configuration.rdf.CustomOntologyProperty;

/**
 * Validates a {@link CustomOntology} extension before it is registered with the server.
 *
 * <p>Hard rules — the validator must reject any of these:
 *
 * <ol>
 *   <li>The extension has a non-blank name and at least one class or property.
 *   <li>Every custom class / property URI is in the {@code om-extension:} namespace. The
 *       canonical {@code om:} namespace is read-only — extensions cannot redefine
 *       {@code om:Column}, {@code om:Table}, etc.
 *   <li>No two classes (or two properties) share the same URI within the same extension.
 *   <li>Each class declares at least one parent in {@code subClassOf}; the parent must reference
 *       a known canonical OpenMetadata class or another class declared in this same extension.
 *   <li>The class hierarchy contains no cycles ({@code A → B → A}).
 *   <li>Object/Datatype property domain/range URIs reference either a canonical class or a class
 *       in this extension.
 * </ol>
 */
@Slf4j
public final class CustomOntologyValidator {

  private static final String EXTENSION_NS = "https://open-metadata.org/ontology-extension/";
  private static final String CANONICAL_NS = "https://open-metadata.org/ontology/";

  /**
   * The canonical class URIs that admins are allowed to reference as parents / domains / ranges.
   * Pulled from {@code openmetadata-spec/src/main/resources/rdf/ontology/openmetadata.ttl}; the
   * list is intentionally small — anything outside it must be a class declared in the same
   * extension.
   */
  private static final Set<String> KNOWN_CANONICAL_CLASSES =
      Set.of(
          "Entity",
          "DataAsset",
          "Service",
          "Database",
          "DatabaseSchema",
          "Table",
          "Column",
          "TableConstraint",
          "Pipeline",
          "Topic",
          "Dashboard",
          "Chart",
          "MLModel",
          "Container",
          "SearchIndex",
          "APICollection",
          "APIEndpoint",
          "Glossary",
          "GlossaryTerm",
          "Tag",
          "Classification",
          "Domain",
          "DataProduct",
          "DataContract",
          "Persona",
          "User",
          "Team",
          "LineageDetails",
          "ColumnLineage",
          "LLMModel",
          "AIApplication",
          "McpServer",
          "AgentExecution",
          "PromptTemplate",
          "Workflow",
          "Automation");

  private CustomOntologyValidator() {}

  /** @return list of validation errors. Empty list means the extension is valid. */
  public static List<String> validate(CustomOntology extension) {
    List<String> errors = new ArrayList<>();
    if (extension == null) {
      errors.add("extension must not be null");
      return errors;
    }
    if (isBlank(extension.getName())) {
      errors.add("'name' must not be blank");
    } else if (!extension.getName().matches("^[a-z][a-z0-9-]{1,62}[a-z0-9]$")) {
      errors.add(
          "'name' must be 3-64 chars, lowercase letters / digits / hyphen, start with a letter");
    }
    List<CustomOntologyClass> classes =
        extension.getClasses() == null ? List.of() : extension.getClasses();
    List<CustomOntologyProperty> properties =
        extension.getProperties() == null ? List.of() : extension.getProperties();
    if (classes.isEmpty() && properties.isEmpty()) {
      errors.add("extension must declare at least one class or property");
    }

    // Collect every declared class URI up front so subClassOf parent references resolve
    // regardless of declaration order (a class may legitimately reference a parent declared
    // later in the list). The duplicate-URI check uses a separate set populated as we go.
    Set<String> declaredClassUris = collectClassUris(classes);
    Set<String> seenClassUris = new HashSet<>();
    for (CustomOntologyClass cls : classes) {
      validateClass(cls, declaredClassUris, seenClassUris, errors);
    }

    Set<String> propertyUris = new HashSet<>();
    for (CustomOntologyProperty prop : properties) {
      validateProperty(prop, propertyUris, declaredClassUris, errors);
    }

    detectClassHierarchyCycles(classes, errors);

    return errors;
  }

  /** @return true if validation passed; false otherwise (errors are logged at WARN). */
  public static boolean isValid(CustomOntology extension) {
    List<String> errors = validate(extension);
    if (!errors.isEmpty()) {
      LOG.warn(
          "Custom ontology '{}' failed validation: {}",
          extension == null ? "<null>" : extension.getName(),
          errors);
    }
    return errors.isEmpty();
  }

  private static Set<String> collectClassUris(List<CustomOntologyClass> classes) {
    Set<String> classUris = new HashSet<>();
    for (CustomOntologyClass cls : classes) {
      if (cls != null && cls.getUri() != null && !cls.getUri().isBlank()) {
        classUris.add(cls.getUri());
      }
    }
    return classUris;
  }

  private static void validateClass(
      CustomOntologyClass cls,
      Set<String> declaredClassUris,
      Set<String> seenUris,
      List<String> errors) {
    if (cls == null) {
      errors.add("null class entry");
      return;
    }
    if (cls.getUri() == null || cls.getUri().isBlank()) {
      errors.add("class missing 'uri'");
      return;
    }
    if (!isExtensionUri(cls.getUri())) {
      errors.add(
          "class URI '"
              + cls.getUri()
              + "' must be in the om-extension namespace ("
              + EXTENSION_NS
              + "); the canonical om: namespace is read-only");
    }
    if (!seenUris.add(cls.getUri())) {
      errors.add("duplicate class URI in this extension: " + cls.getUri());
    }
    if (cls.getSubClassOf() == null || cls.getSubClassOf().isEmpty()) {
      errors.add("class '" + cls.getUri() + "' must declare at least one subClassOf parent");
    } else {
      for (String parent : cls.getSubClassOf()) {
        if (!isKnownClassReference(parent, declaredClassUris)) {
          errors.add(
              "class '"
                  + cls.getUri()
                  + "' references unknown parent class '"
                  + parent
                  + "'; expected canonical om: class or another class in this extension");
        }
      }
    }
  }

  private static void validateProperty(
      CustomOntologyProperty prop,
      Set<String> seenUris,
      Set<String> declaredClassUris,
      List<String> errors) {
    if (prop == null) {
      errors.add("null property entry");
      return;
    }
    if (prop.getUri() == null || prop.getUri().isBlank()) {
      errors.add("property missing 'uri'");
      return;
    }
    if (!isExtensionUri(prop.getUri())) {
      errors.add("property URI '" + prop.getUri() + "' must be in the om-extension namespace");
    }
    if (!seenUris.add(prop.getUri())) {
      errors.add("duplicate property URI in this extension: " + prop.getUri());
    }
    if (prop.getDomain() == null || prop.getDomain().isBlank()) {
      errors.add("property '" + prop.getUri() + "' missing 'domain'");
    } else if (!isKnownClassReference(prop.getDomain(), declaredClassUris)) {
      errors.add(
          "property '"
              + prop.getUri()
              + "' has domain '"
              + prop.getDomain()
              + "' which is not a known canonical class or a class in this extension");
    }
    if (prop.getRange() == null || prop.getRange().isBlank()) {
      errors.add("property '" + prop.getUri() + "' missing 'range'");
    } else if (prop.getType() == CustomOntologyProperty.Type.OBJECT_PROPERTY) {
      if (!isKnownClassReference(prop.getRange(), declaredClassUris)) {
        errors.add(
            "ObjectProperty '"
                + prop.getUri()
                + "' has range '"
                + prop.getRange()
                + "' which is not a known canonical class or a class in this extension");
      }
    } else if (prop.getType() == CustomOntologyProperty.Type.DATATYPE_PROPERTY) {
      if (!prop.getRange().startsWith("http://www.w3.org/2001/XMLSchema#")) {
        errors.add(
            "DatatypeProperty '"
                + prop.getUri()
                + "' range must be an xsd: datatype URI (got '"
                + prop.getRange()
                + "')");
      }
    }
  }

  /**
   * Detect a cycle in the subClassOf graph using iterative DFS. A cycle is any path that returns
   * to a node already on the current path stack.
   */
  private static void detectClassHierarchyCycles(
      List<CustomOntologyClass> classes, List<String> errors) {
    Map<String, List<String>> graph = new HashMap<>();
    for (CustomOntologyClass cls : classes) {
      if (cls != null && cls.getUri() != null) {
        graph.put(cls.getUri(), cls.getSubClassOf() == null ? List.of() : cls.getSubClassOf());
      }
    }
    Set<String> visited = new HashSet<>();
    Set<String> onStack = new HashSet<>();
    for (String node : graph.keySet()) {
      if (hasCycle(node, graph, visited, onStack)) {
        errors.add("class hierarchy contains a cycle through " + node);
      }
    }
  }

  private static boolean hasCycle(
      String node, Map<String, List<String>> graph, Set<String> visited, Set<String> onStack) {
    if (onStack.contains(node)) return true;
    if (visited.contains(node)) return false;
    onStack.add(node);
    visited.add(node);
    for (String parent : graph.getOrDefault(node, List.of())) {
      if (graph.containsKey(parent) && hasCycle(parent, graph, visited, onStack)) {
        return true;
      }
    }
    onStack.remove(node);
    return false;
  }

  private static boolean isExtensionUri(String uri) {
    return uri != null && uri.startsWith(EXTENSION_NS);
  }

  /**
   * @return true if the URI references either a canonical om: class on the allowlist or a class
   *     declared inside the current extension.
   */
  private static boolean isKnownClassReference(String uri, Set<String> extensionClassUris) {
    if (uri == null) return false;
    if (extensionClassUris.contains(uri)) return true;
    if (uri.startsWith(CANONICAL_NS)) {
      String localName = uri.substring(CANONICAL_NS.length());
      return KNOWN_CANONICAL_CLASSES.contains(localName);
    }
    // Allow short-form prefixed names like "om:Table".
    if (uri.startsWith("om:")) {
      return KNOWN_CANONICAL_CLASSES.contains(uri.substring(3));
    }
    return false;
  }

  private static boolean isBlank(String s) {
    return s == null || s.isBlank();
  }
}
