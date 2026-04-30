package org.openmetadata.service.search.vector;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.BiConsumer;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.experimental.UtilityClass;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.data.MetricExpression;
import org.openmetadata.schema.entity.data.APICollection;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.type.AssetCertification;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TermRelation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.vector.client.EmbeddingClient;
import org.openmetadata.service.search.vector.utils.TextChunkManager;

@Slf4j
@UtilityClass
public class VectorDocBuilder {

  /**
   * Strategy for producing the semantic "body text" of an entity that will be chunked and fed to
   * the embedding model. The default implementation concatenates {@code description} and, for
   * tables, the column names — which works for every entity type whose semantic payload lives in
   * {@code description}. Entity types whose payload is spread across other fields (for example
   * Collate's {@code ContextMemory}, with title/question/answer/summary) can provide a typed
   * extractor via {@link #registerBodyTextExtractor(String, BodyTextExtractor)} so the embedding
   * pipeline uses their fields instead of an empty description.
   */
  @FunctionalInterface
  public interface BodyTextExtractor {
    /**
     * Returns the body text for the given entity, or {@code null} to fall back to the default
     * behavior. Implementations should be fast and side-effect free; they run on the hot path of
     * every create/update and every reembed iteration.
     */
    String extract(EntityInterface entity);
  }

  private static final Map<String, BodyTextExtractor> BODY_TEXT_EXTRACTORS =
      new ConcurrentHashMap<>();

  private static final int MAX_CHILD_NAMES_IN_CONTEXT = 20;

  /**
   * Child-entity enumeration spec for container-like types. When an entity has children on the
   * object (populated during reindexing via {@code fields=*}), their names are joined into a
   * short natural-language phrase and appended to the semantic body, so queries match against
   * what a container actually contains. The cast inside each getter is guarded by the map key:
   * an entry keyed by {@link Entity#DATABASE} is only consulted for {@link Database} entities.
   */
  private record SemanticChildrenSpec(
      Function<EntityInterface, List<EntityReference>> childGetter, String phrasePrefix) {}

  private static final Map<String, SemanticChildrenSpec> SEMANTIC_CHILDREN_SPECS =
      Map.of(
          Entity.DATABASE,
              new SemanticChildrenSpec(
                  e -> ((Database) e).getDatabaseSchemas(), "Contains schemas"),
          Entity.DATABASE_SCHEMA,
              new SemanticChildrenSpec(e -> ((DatabaseSchema) e).getTables(), "Contains tables"),
          Entity.API_COLLECTION,
              new SemanticChildrenSpec(
                  e -> ((APICollection) e).getApiEndpoints(), "Contains endpoints"),
          Entity.CONTAINER,
              new SemanticChildrenSpec(e -> ((Container) e).getChildren(), "Contains"),
          Entity.DATA_PRODUCT,
              new SemanticChildrenSpec(e -> ((DataProduct) e).getAssets(), "Contains assets"));

  /**
   * Entity-type-specific enrichments appended to {@link #buildSemanticMetaLightText} after the
   * shared subject/type phrase. Table-driven so new type enrichers are one map entry rather than
   * another {@code instanceof} branch.
   */
  private static final Map<String, BiConsumer<List<String>, EntityInterface>> SEMANTIC_ENRICHERS =
      Map.of(
          Entity.GLOSSARY_TERM,
              (phrases, e) -> appendGlossaryTermPhrases(phrases, (GlossaryTerm) e),
          Entity.METRIC, (phrases, e) -> appendMetricPhrases(phrases, (Metric) e));

  /**
   * Register a custom {@link BodyTextExtractor} for an entity type. The registry is consulted by
   * {@link #buildBodyText(EntityInterface, String)} before the default description-based logic,
   * so callers can cleanly override body text for their own entity types without patching this
   * class. Registration is idempotent (last writer wins) and thread-safe.
   */
  public static void registerBodyTextExtractor(String entityType, BodyTextExtractor extractor) {
    if (entityType == null || entityType.isBlank() || extractor == null) {
      return;
    }
    BODY_TEXT_EXTRACTORS.put(entityType, extractor);
  }

  public static List<Map<String, Object>> fromEntity(
      EntityInterface entity, EmbeddingClient embeddingClient) {
    Map<String, Object> doc = new HashMap<>(buildEmbeddingFields(entity, embeddingClient));

    if (entity instanceof GlossaryTerm term) {
      List<TermRelation> relatedTerms = term.getRelatedTerms();
      if (relatedTerms != null && !relatedTerms.isEmpty()) {
        List<Map<String, Object>> relatedTermDocs = new ArrayList<>();
        for (TermRelation rel : relatedTerms) {
          EntityReference ref = rel.getTerm();
          if (ref == null) continue;
          Map<String, Object> refMap = new HashMap<>();
          if (ref.getId() != null) refMap.put("id", ref.getId().toString());
          if (ref.getName() != null) refMap.put("name", ref.getName());
          if (ref.getType() != null) refMap.put("type", ref.getType());
          if (ref.getFullyQualifiedName() != null)
            refMap.put("fullyQualifiedName", ref.getFullyQualifiedName());
          relatedTermDocs.add(refMap);
        }
        doc.put("relatedTerms", relatedTermDocs);
      }
    }

    return List.of(doc);
  }

  /**
   * Generate embedding fields to merge into an entity's search index document. Returns a map with:
   * embedding, textToLLMContext, textToEmbed, chunkIndex, chunkCount, parentId, fingerprint.
   *
   * <p>{@code textToLLMContext} preserves the legacy rich-context format (empty fields rendered as
   * {@code []}) and is consumed by agent tooling as LLM context. {@code textToEmbed} is
   * the compact variant that omits empty fields and is the actual input fed to the embedding
   * model.
   */
  public static Map<String, Object> buildEmbeddingFields(
      EntityInterface entity, EmbeddingClient embeddingClient) {
    String parentId = entity.getId().toString();
    String entityType = entity.getEntityReference().getType();

    String metaLight = buildMetaLightText(entity, entityType);
    String body = buildBodyText(entity, entityType);
    String semanticMetaLight = buildSemanticMetaLightText(entity, entityType);
    String semanticBody = buildSemanticBodyText(entity, entityType);
    String fingerprint = computeFingerprintForEntity(entity);

    List<String> chunks = TextChunkManager.chunk(body);
    int chunkCount = chunks.size();
    List<String> semanticChunks = TextChunkManager.chunk(semanticBody);

    String contTag = "";
    String textToLLMContext =
        String.format("%s%s%s | chunk %d/%d", metaLight, contTag, chunks.get(0), 1, chunkCount);
    String semanticBodyChunk = semanticChunks.get(0);
    String textToEmbed = joinSemanticParts(semanticMetaLight, semanticBodyChunk);

    float[] embedding = embeddingClient.embed(textToEmbed);

    Map<String, Object> fields = new HashMap<>();
    fields.put("embedding", embedding);
    fields.put("textToLLMContext", textToLLMContext);
    fields.put("textToEmbed", textToEmbed);
    fields.put("chunkIndex", 0);
    fields.put("chunkCount", chunkCount);
    fields.put("parentId", parentId);
    fields.put("fingerprint", fingerprint);

    return fields;
  }

  public static String computeFingerprintForEntity(EntityInterface entity) {
    String entityType = entity.getEntityReference().getType();
    String metaLight = buildMetaLightText(entity, entityType);
    String body = buildBodyText(entity, entityType);
    return TextChunkManager.computeFingerprint(metaLight + "|" + body);
  }

  static String buildMetaLightText(EntityInterface entity, String entityType) {
    boolean isGlossary = entity instanceof Glossary;
    boolean isGlossaryTerm = entity instanceof GlossaryTerm;
    boolean isMetric = entity instanceof Metric;

    List<TagLabel> tagsPojo = entity.getTags() != null ? entity.getTags() : Collections.emptyList();

    List<String> classificationTagFqns =
        tagsPojo.stream()
            .filter(tag -> tag.getSource() == null || !"Glossary".equals(tag.getSource().value()))
            .filter(tag -> !tag.getTagFQN().startsWith("Tier."))
            .map(TagLabel::getTagFQN)
            .collect(Collectors.toList());
    List<String> glossaryTermFqns =
        tagsPojo.stream()
            .filter(tag -> tag.getSource() != null && "Glossary".equals(tag.getSource().value()))
            .map(TagLabel::getTagFQN)
            .collect(Collectors.toList());

    List<EntityReference> ownersPojo =
        entity.getOwners() != null ? entity.getOwners() : Collections.emptyList();
    List<String> ownerNames =
        ownersPojo.stream()
            .map(
                owner -> {
                  String type = owner.getType();
                  String name = owner.getName();
                  if (type != null && name != null) {
                    return type.toLowerCase() + "." + name;
                  }
                  return name;
                })
            .filter(Objects::nonNull)
            .collect(Collectors.toList());

    List<EntityReference> domainsPojo =
        entity.getDomains() != null ? entity.getDomains() : Collections.emptyList();
    List<String> domainFqns =
        domainsPojo.stream()
            .map(EntityReference::getFullyQualifiedName)
            .filter(Objects::nonNull)
            .collect(Collectors.toList());

    List<String> parts = new ArrayList<>();
    parts.add("name: " + orEmpty(entity.getName()));
    parts.add("displayName: " + orEmpty(entity.getDisplayName()));
    parts.add("entityType: " + entityType);
    parts.add("serviceType: " + orEmpty(extractServiceType(entity)));
    parts.add("fullyQualifiedName: " + orEmpty(entity.getFullyQualifiedName()));

    if (isGlossaryTerm) {
      GlossaryTerm term = (GlossaryTerm) entity;
      List<String> synonyms =
          term.getSynonyms() != null ? term.getSynonyms() : Collections.emptyList();
      parts.add("synonyms: " + joinOrEmpty(synonyms));
      List<TermRelation> relatedTerms =
          term.getRelatedTerms() != null ? term.getRelatedTerms() : Collections.emptyList();
      List<String> relatedTermFqns =
          relatedTerms.stream()
              .map(tr -> tr.getTerm().getFullyQualifiedName())
              .filter(Objects::nonNull)
              .collect(Collectors.toList());
      parts.add("relatedTerms: " + joinOrEmpty(relatedTermFqns));
    }

    if (isMetric) {
      Metric metric = (Metric) entity;
      if (metric.getMetricType() != null) {
        parts.add("metricType: " + metric.getMetricType().value());
      }
      if (metric.getUnitOfMeasurement() != null) {
        String unit = metric.getUnitOfMeasurement().value();
        if ("OTHER".equals(unit) && metric.getCustomUnitOfMeasurement() != null) {
          parts.add("unitOfMeasurement: " + metric.getCustomUnitOfMeasurement());
        } else {
          parts.add("unitOfMeasurement: " + unit);
        }
      }
      if (metric.getGranularity() != null) {
        parts.add("granularity: " + metric.getGranularity().toString());
      }
      MetricExpression metricExpression = metric.getMetricExpression();
      if (metricExpression != null && metricExpression.getCode() != null) {
        String lang =
            metricExpression.getLanguage() != null ? metricExpression.getLanguage().toString() : "";
        parts.add(String.format("metricCode: ```%s\n%s\n```", lang, metricExpression.getCode()));
      }
      List<EntityReference> relatedMetrics =
          metric.getRelatedMetrics() != null ? metric.getRelatedMetrics() : Collections.emptyList();
      if (!relatedMetrics.isEmpty()) {
        List<String> relatedMetricFqns =
            relatedMetrics.stream()
                .map(EntityReference::getFullyQualifiedName)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
        parts.add("relatedMetrics: " + joinOrEmpty(relatedMetricFqns));
      }
    }

    if (!isGlossary && !isGlossaryTerm) {
      parts.add("tier: " + orEmpty(extractTierLabel(entity)));
      parts.add("certification: " + orEmpty(extractCertificationLabel(entity)));
    }

    parts.add("domains: " + joinOrEmpty(domainFqns));
    parts.add("tags: " + joinOrEmpty(classificationTagFqns));

    if (!isGlossary && !isGlossaryTerm) {
      parts.add("Associated glossary terms: " + joinOrEmpty(glossaryTermFqns));
    }

    parts.add("owners: " + joinOrEmpty(ownerNames));

    Object customProperties = entity.getExtension();
    parts.add(
        "customProperties: "
            + (customProperties != null && !String.valueOf(customProperties).isBlank()
                ? String.valueOf(customProperties)
                : "[]"));

    return String.join("; ", parts) + " | ";
  }

  static String buildBodyText(EntityInterface entity, String entityType) {
    if (entityType != null) {
      BodyTextExtractor customExtractor = BODY_TEXT_EXTRACTORS.get(entityType);
      if (customExtractor != null) {
        try {
          String custom = customExtractor.extract(entity);
          if (custom != null) {
            return custom;
          }
        } catch (Exception e) {
          LOG.warn(
              "Custom BodyTextExtractor failed for [{}], falling back to default", entityType, e);
        }
      }
    }

    List<String> bodyParts = new ArrayList<>();
    bodyParts.add("description: " + removeHtml(orEmpty(entity.getDescription())));

    if (entity instanceof Table table) {
      bodyParts.add("columns: " + columnsToString(table.getColumns()));
    }

    return String.join("; ", bodyParts);
  }

  /**
   * Natural-language metadata for the semantic embedding input. Emits content as sentence-like
   * phrases without {@code key: value;} label scaffolding, and drops high-noise/low-signal fields
   * (FQN, entityType, serviceType, owners, customProperties, chunk marker) so the pooled vector
   * isn't dominated by structural tokens that appear in every document.
   */
  static String buildSemanticMetaLightText(EntityInterface entity, String entityType) {
    boolean isGlossary = entity instanceof Glossary;
    boolean isGlossaryTerm = entity instanceof GlossaryTerm;

    List<String> phrases = new ArrayList<>();
    appendSubjectPhrase(phrases, entity, entityType);

    BiConsumer<List<String>, EntityInterface> enricher = SEMANTIC_ENRICHERS.get(entityType);
    if (enricher != null) {
      enricher.accept(phrases, entity);
    }

    appendTagPhrases(phrases, entity, isGlossary, isGlossaryTerm);
    appendDomainPhrase(phrases, entity);

    if (!isGlossary && !isGlossaryTerm) {
      appendTierAndCertificationPhrases(phrases, entity);
    }

    return String.join(". ", phrases);
  }

  private static void appendSubjectPhrase(
      List<String> phrases, EntityInterface entity, String entityType) {
    String name = entity.getName();
    String displayName = entity.getDisplayName();
    String subject = null;
    if (displayName != null && !displayName.isBlank() && !displayName.equals(name)) {
      subject = (name == null || name.isBlank()) ? displayName : displayName + " (" + name + ")";
    } else if (name != null && !name.isBlank()) {
      subject = name;
    }
    String typeLabel = humanizeEntityType(entityType);
    if (!typeLabel.isEmpty() && subject != null) {
      phrases.add(typeLabel + " " + subject);
    } else if (!typeLabel.isEmpty()) {
      phrases.add(typeLabel);
    } else if (subject != null) {
      phrases.add(subject);
    }
  }

  private static void appendTierAndCertificationPhrases(
      List<String> phrases, EntityInterface entity) {
    String tier = extractTierLabel(entity);
    if (tier != null) {
      phrases.add(tier.replace('.', ' '));
    }
    String cert = extractCertificationLabel(entity);
    if (cert != null) {
      phrases.add(cert.replace('.', ' '));
    }
  }

  private static void appendGlossaryTermPhrases(List<String> phrases, GlossaryTerm term) {
    List<String> synonyms = term.getSynonyms();
    if (synonyms != null && !synonyms.isEmpty()) {
      phrases.add("Also known as " + String.join(", ", synonyms));
    }
    List<TermRelation> relatedTerms = term.getRelatedTerms();
    if (relatedTerms != null && !relatedTerms.isEmpty()) {
      List<String> relatedNames =
          relatedTerms.stream()
              .map(tr -> tr.getTerm() == null ? null : tr.getTerm().getName())
              .filter(Objects::nonNull)
              .collect(Collectors.toList());
      if (!relatedNames.isEmpty()) {
        phrases.add("Related to " + String.join(", ", relatedNames));
      }
    }
  }

  private static void appendMetricPhrases(List<String> phrases, Metric metric) {
    List<String> parts = new ArrayList<>();
    if (metric.getMetricType() != null) {
      parts.add(metric.getMetricType().value() + " metric");
    }
    if (metric.getUnitOfMeasurement() != null) {
      String unit = metric.getUnitOfMeasurement().value();
      String value =
          "OTHER".equals(unit) && metric.getCustomUnitOfMeasurement() != null
              ? metric.getCustomUnitOfMeasurement()
              : unit;
      parts.add("measured in " + value);
    }
    if (metric.getGranularity() != null) {
      parts.add("granularity " + metric.getGranularity());
    }
    if (!parts.isEmpty()) {
      phrases.add(String.join(", ", parts));
    }
    MetricExpression expr = metric.getMetricExpression();
    if (expr != null && expr.getCode() != null) {
      phrases.add(expr.getCode());
    }
  }

  private static void appendTagPhrases(
      List<String> phrases, EntityInterface entity, boolean isGlossary, boolean isGlossaryTerm) {
    List<TagLabel> tagsPojo = entity.getTags() != null ? entity.getTags() : Collections.emptyList();
    List<String> classificationTagNames =
        tagsPojo.stream()
            .filter(tag -> tag.getSource() == null || !"Glossary".equals(tag.getSource().value()))
            .filter(tag -> !tag.getTagFQN().startsWith("Tier."))
            .map(tag -> tag.getTagFQN().replace('.', ' '))
            .collect(Collectors.toList());
    if (!classificationTagNames.isEmpty()) {
      phrases.add("Tagged as " + String.join(", ", classificationTagNames));
    }
    if (!isGlossary && !isGlossaryTerm) {
      List<String> glossaryTermNames =
          tagsPojo.stream()
              .filter(tag -> tag.getSource() != null && "Glossary".equals(tag.getSource().value()))
              .map(tag -> tag.getName() != null ? tag.getName() : tag.getTagFQN())
              .collect(Collectors.toList());
      if (!glossaryTermNames.isEmpty()) {
        phrases.add("Related glossary terms " + String.join(", ", glossaryTermNames));
      }
    }
  }

  private static void appendDomainPhrase(List<String> phrases, EntityInterface entity) {
    List<EntityReference> domainsPojo =
        entity.getDomains() != null ? entity.getDomains() : Collections.emptyList();
    List<String> domainNames =
        domainsPojo.stream()
            .map(d -> d.getDisplayName() != null ? d.getDisplayName() : d.getName())
            .filter(Objects::nonNull)
            .collect(Collectors.toList());
    if (!domainNames.isEmpty()) {
      phrases.add("In domain " + String.join(", ", domainNames));
    }
  }

  private static String joinSemanticParts(String metaLight, String body) {
    if (metaLight.isEmpty()) {
      return body;
    }
    if (body.isEmpty()) {
      return metaLight;
    }
    return metaLight + ". " + body;
  }

  static String buildSemanticBodyText(EntityInterface entity, String entityType) {
    if (entityType != null) {
      BodyTextExtractor customExtractor = BODY_TEXT_EXTRACTORS.get(entityType);
      if (customExtractor != null) {
        try {
          String custom = customExtractor.extract(entity);
          if (custom != null) {
            return custom;
          }
        } catch (Exception e) {
          LOG.warn(
              "Custom BodyTextExtractor failed for [{}], falling back to default", entityType, e);
        }
      }
    }

    List<String> bodyParts = new ArrayList<>();
    String description = removeHtml(entity.getDescription() == null ? "" : entity.getDescription());
    if (!description.isEmpty()) {
      bodyParts.add(description);
    }

    if (entity instanceof Table table) {
      List<Column> columns = table.getColumns();
      if (columns != null && !columns.isEmpty()) {
        bodyParts.add("Columns include " + columnsToString(columns));
      }
    }

    String childContext = buildChildContextPhrase(entity, entityType);
    if (childContext != null) {
      bodyParts.add(childContext);
    }

    return String.join(". ", bodyParts);
  }

  /**
   * Convert an entity type identifier into a natural-language label by inserting spaces at every
   * lowercase→uppercase boundary. {@code dataProduct} becomes {@code "data Product"},
   * {@code databaseSchema} becomes {@code "database Schema"}, {@code table} stays {@code "table"}.
   * Returns an empty string for null or blank input so callers can trivially skip the prefix.
   */
  static String humanizeEntityType(String entityType) {
    if (entityType == null || entityType.isBlank()) {
      return "";
    }
    return entityType.replaceAll("([a-z])([A-Z])", "$1 $2");
  }

  /**
   * Produce a "Contains X, Y, Z" phrase listing the names of a container entity's direct
   * children (database schemas, tables, endpoints, charts, etc.). The per-type getter is looked
   * up in {@link #SEMANTIC_CHILDREN_SPECS} as a typed method reference, so this stays
   * compile-time checked. Returns null when the entity is not a known container or when the
   * child list is empty.
   */
  static String buildChildContextPhrase(EntityInterface entity, String entityType) {
    if (entityType == null) {
      return null;
    }
    SemanticChildrenSpec spec = SEMANTIC_CHILDREN_SPECS.get(entityType);
    if (spec == null) {
      return null;
    }
    List<String> childNames = readChildNames(spec.childGetter().apply(entity));
    if (childNames.isEmpty()) {
      return null;
    }
    List<String> limited =
        childNames.size() > MAX_CHILD_NAMES_IN_CONTEXT
            ? childNames.subList(0, MAX_CHILD_NAMES_IN_CONTEXT)
            : childNames;
    return spec.phrasePrefix() + " " + String.join(", ", limited);
  }

  private static List<String> readChildNames(List<EntityReference> refs) {
    if (refs == null || refs.isEmpty()) {
      return Collections.emptyList();
    }
    List<String> names = new ArrayList<>(refs.size());
    for (EntityReference ref : refs) {
      String displayName = ref.getDisplayName();
      String name = displayName != null && !displayName.isBlank() ? displayName : ref.getName();
      if (name != null && !name.isBlank()) {
        names.add(name);
      }
    }
    return names;
  }

  static String extractServiceType(EntityInterface entity) {
    try {
      Method method = entity.getClass().getMethod("getServiceType");
      Object result = method.invoke(entity);
      return result != null ? result.toString() : null;
    } catch (Exception e) {
      return null;
    }
  }

  static String extractTierLabel(EntityInterface entity) {
    if (entity.getTags() == null) return null;
    for (TagLabel tag : entity.getTags()) {
      if (tag.getTagFQN() != null && tag.getTagFQN().startsWith("Tier.")) {
        return tag.getTagFQN();
      }
    }
    return null;
  }

  static String extractCertificationLabel(EntityInterface entity) {
    AssetCertification cert = entity.getCertification();
    if (cert != null && cert.getTagLabel() != null) {
      return cert.getTagLabel().getTagFQN();
    }
    return null;
  }

  static String removeHtml(String text) {
    if (text == null || text.isEmpty()) return "";
    return text.replaceAll("<[^>]+>", " ").replaceAll("\\s+", " ").trim();
  }

  static String orEmpty(Object value) {
    return (value == null || String.valueOf(value).isBlank()) ? "[]" : String.valueOf(value);
  }

  static String stringOrEmpty(String value) {
    return value != null ? value : "";
  }

  static String joinOrEmpty(List<String> values) {
    if (values == null || values.isEmpty()) return "[]";
    return String.join(", ", values);
  }

  static String columnsToString(List<Column> columns) {
    if (columns == null || columns.isEmpty()) return "[]";
    return columns.stream()
        .map(
            col -> {
              String name = col.getName();
              String desc = col.getDescription();
              desc = desc == null ? "" : desc.trim();
              return desc.isEmpty() || "null".equalsIgnoreCase(desc)
                  ? name
                  : name + " (" + desc + ")";
            })
        .collect(Collectors.joining(", "));
  }
}
