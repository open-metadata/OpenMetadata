package org.openmetadata.service.rdf.extension;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

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
    } else {
      validateExtension(extension, errors);
    }
    return errors;
  }

  private static void validateExtension(CustomOntology extension, List<String> errors) {
    if (isBlank(extension.getName())) {
      errors.add("'name' must not be blank");
    } else if (!extension.getName().matches("^[a-z][a-z0-9-]{1,62}[a-z0-9]$")) {
      errors.add(
          "'name' must be 3-64 chars, lowercase letters / digits / hyphen, start with a letter");
    }
    List<CustomOntologyClass> classes = listOrEmpty(extension.getClasses());
    List<CustomOntologyProperty> properties = listOrEmpty(extension.getProperties());
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
  }

  /** @return true if validation passed; false otherwise (errors are logged at WARN). */
  public static boolean isValid(CustomOntology extension) {
    List<String> errors = validate(extension);
    if (!nullOrEmpty(errors)) {
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
      if (cls != null && !isBlank(cls.getUri())) {
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
    } else if (isBlank(cls.getUri())) {
      errors.add("class missing 'uri'");
    } else {
      validateClassDefinition(cls, declaredClassUris, seenUris, errors);
    }
  }

  private static void validateClassDefinition(
      CustomOntologyClass ontologyClass,
      Set<String> declaredClassUris,
      Set<String> seenUris,
      List<String> errors) {
    String uri = ontologyClass.getUri();
    if (!isExtensionUri(uri)) {
      errors.add(
          "class URI '"
              + uri
              + "' must be in the om-extension namespace ("
              + EXTENSION_NS
              + "); the canonical om: namespace is read-only");
    }
    if (!seenUris.add(uri)) {
      errors.add("duplicate class URI in this extension: " + uri);
    }
    List<String> parentUris = listOrEmpty(ontologyClass.getSubClassOf());
    if (parentUris.isEmpty()) {
      errors.add("class '" + uri + "' must declare at least one subClassOf parent");
    } else {
      parentUris.stream()
          .filter(parent -> !isKnownClassReference(parent, declaredClassUris))
          .map(
              parent ->
                  "class '"
                      + uri
                      + "' references unknown parent class '"
                      + parent
                      + "'; expected canonical om: class or another class in this extension")
          .forEach(errors::add);
    }
  }

  private static void validateProperty(
      CustomOntologyProperty prop,
      Set<String> seenUris,
      Set<String> declaredClassUris,
      List<String> errors) {
    if (prop == null) {
      errors.add("null property entry");
    } else if (isBlank(prop.getUri())) {
      errors.add("property missing 'uri'");
    } else {
      validatePropertyDefinition(prop, seenUris, declaredClassUris, errors);
    }
  }

  private static void validatePropertyDefinition(
      CustomOntologyProperty property,
      Set<String> seenUris,
      Set<String> declaredClassUris,
      List<String> errors) {
    String uri = property.getUri();
    if (!isExtensionUri(uri)) {
      errors.add("property URI '" + uri + "' must be in the om-extension namespace");
    }
    if (!seenUris.add(uri)) {
      errors.add("duplicate property URI in this extension: " + uri);
    }
    validatePropertyDomain(property, declaredClassUris, errors);
    validatePropertyRange(property, declaredClassUris, errors);
  }

  private static void validatePropertyDomain(
      CustomOntologyProperty property, Set<String> declaredClassUris, List<String> errors) {
    if (isBlank(property.getDomain())) {
      errors.add("property '" + property.getUri() + "' missing 'domain'");
    } else if (!isKnownClassReference(property.getDomain(), declaredClassUris)) {
      errors.add(
          "property '"
              + property.getUri()
              + "' has domain '"
              + property.getDomain()
              + "' which is not a known canonical class or a class in this extension");
    }
  }

  private static void validatePropertyRange(
      CustomOntologyProperty property, Set<String> declaredClassUris, List<String> errors) {
    String range = property.getRange();
    if (isBlank(range)) {
      errors.add("property '" + property.getUri() + "' missing 'range'");
    } else if (property.getType() == CustomOntologyProperty.Type.OBJECT_PROPERTY
        && !isKnownClassReference(range, declaredClassUris)) {
      errors.add(
          "ObjectProperty '"
              + property.getUri()
              + "' has range '"
              + range
              + "' which is not a known canonical class or a class in this extension");
    } else if (property.getType() == CustomOntologyProperty.Type.DATATYPE_PROPERTY
        && !range.startsWith("http://www.w3.org/2001/XMLSchema#")) {
      errors.add(
          "DatatypeProperty '"
              + property.getUri()
              + "' range must be an xsd: datatype URI (got '"
              + range
              + "')");
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
        graph.put(cls.getUri(), listOrEmpty(cls.getSubClassOf()));
      }
    }
    Set<String> visited = new HashSet<>();
    Set<String> onStack = new HashSet<>();
    for (String node : graph.keySet()) {
      // hasCycle returns early on a back-edge without unwinding onStack, so reset it per root.
      // visited still prevents re-processing nodes already proven (a)cyclic, so clearing onStack
      // only drops the stale recursion frames and avoids false positives across roots.
      onStack.clear();
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
    return !nullOrEmpty(uri) && uri.startsWith(EXTENSION_NS);
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
    return nullOrEmpty(s) || s.isBlank();
  }
}
