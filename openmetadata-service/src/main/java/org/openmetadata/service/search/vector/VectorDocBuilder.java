package org.openmetadata.service.search.vector;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.experimental.UtilityClass;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.data.MetricExpression;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.AssetCertification;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.search.vector.client.EmbeddingClient;
import org.openmetadata.service.search.vector.utils.TextChunkManager;

@Slf4j
@UtilityClass
public class VectorDocBuilder {

  /**
   * Generate embedding fields to merge into an entity's search index document. Returns a map with:
   * embedding, textToEmbed, chunkIndex, chunkCount, parentId, fingerprint.
   */
  public static Map<String, Object> buildEmbeddingFields(
      EntityInterface entity, EmbeddingClient embeddingClient) {
    String parentId = entity.getId().toString();
    String entityType = entity.getEntityReference().getType();

    String metaLight = buildMetaLightText(entity, entityType);
    String body = buildBodyText(entity, entityType);
    String fingerprint = computeFingerprintForEntity(entity);

    List<String> chunks = TextChunkManager.chunk(body);
    int chunkCount = chunks.size();

    // Use the first chunk for the entity's embedding
    String contTag = "";
    String textToEmbed =
        String.format("%s%s%s | chunk %d/%d", metaLight, contTag, chunks.get(0), 1, chunkCount);

    float[] embedding = embeddingClient.embed(textToEmbed);

    Map<String, Object> fields = new HashMap<>();
    fields.put("embedding", embedding);
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
            .filter(n -> n != null)
            .collect(Collectors.toList());

    List<EntityReference> domainsPojo =
        entity.getDomains() != null ? entity.getDomains() : Collections.emptyList();
    List<String> domainFqns =
        domainsPojo.stream()
            .map(EntityReference::getFullyQualifiedName)
            .filter(fqn -> fqn != null)
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
      List<EntityReference> relatedTerms =
          term.getRelatedTerms() != null ? term.getRelatedTerms() : Collections.emptyList();
      List<String> relatedTermFqns =
          relatedTerms.stream()
              .map(EntityReference::getFullyQualifiedName)
              .filter(fqn -> fqn != null)
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
                .filter(fqn -> fqn != null)
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
    List<String> bodyParts = new ArrayList<>();
    bodyParts.add("description: " + removeHtml(orEmpty(entity.getDescription())));

    if (entity instanceof Table table) {
      bodyParts.add("columns: " + columnsToString(table.getColumns()));
    }

    return String.join("; ", bodyParts);
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
