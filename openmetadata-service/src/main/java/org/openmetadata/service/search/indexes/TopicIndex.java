package org.openmetadata.service.search.indexes;

import static org.openmetadata.service.search.EntityBuilderConstant.ES_MESSAGE_SCHEMA_FIELD;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.models.FlattenSchemaField;

public class TopicIndex implements DataAssetIndex {
  final Set<String> excludeTopicFields = Set.of("sampleData");
  final Topic topic;

  public TopicIndex(Topic topic) {
    this.topic = topic;
  }

  @Override
  public Object getEntity() {
    return topic;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.TOPIC;
  }

  @Override
  public Set<String> getExcludedFields() {
    return excludeTopicFields;
  }

  @Override
  public Object getIndexServiceType() {
    return topic.getServiceType();
  }

  @Override
  public Set<String> getRequiredReindexFields() {
    Set<String> fields = new java.util.HashSet<>(DataAssetIndex.super.getRequiredReindexFields());
    // TopicRepository.bulkPopulateEntityFieldTags only fires when fields.contains("messageSchema");
    // without it nested schema-field tags are not hydrated and _source.tags loses the merge.
    fields.add("messageSchema");
    return java.util.Collections.unmodifiableSet(fields);
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    if (topic.getMessageSchema() != null
        && topic.getMessageSchema().getSchemaFields() != null
        && !topic.getMessageSchema().getSchemaFields().isEmpty()) {
      List<FlattenSchemaField> flattenFields = new ArrayList<>();
      SchemaFieldFlattener.parseSchemaFields(
          topic.getMessageSchema().getSchemaFields(), flattenFields, null);

      List<String> fieldsWithChildrenName = new ArrayList<>();
      Set<List<TagLabel>> childTags = new HashSet<>();
      for (FlattenSchemaField field : flattenFields) {
        fieldsWithChildrenName.add(field.getName());
        if (field.getTags() != null) {
          childTags.add(field.getTags());
        }
      }
      doc.put("fieldNames", fieldsWithChildrenName);
      doc.put("fieldNamesFuzzy", String.join(" ", fieldsWithChildrenName));
      mergeChildTags(doc, childTags);
    }

    doc.put("messageSchema", topic.getMessageSchema() != null ? topic.getMessageSchema() : null);
    return doc;
  }

  public static Map<String, Float> getFields() {
    Map<String, Float> fields = SearchIndex.getDefaultFields();
    fields.put(ES_MESSAGE_SCHEMA_FIELD, 7.0f);
    fields.put("messageSchema.schemaFields.name.keyword", 5.0f);
    fields.put("messageSchema.schemaFields.description", 1.0f);
    fields.put("fieldNamesFuzzy", 7.0f);
    return fields;
  }
}
