package org.openmetadata.service.search.indexes;

import static org.openmetadata.service.Entity.FIELD_DESCRIPTION;
import static org.openmetadata.service.Entity.FIELD_DISPLAY_NAME;
import static org.openmetadata.service.Entity.FIELD_NAME;
import static org.openmetadata.service.search.EntityBuilderConstant.DISPLAY_NAME_KEYWORD;
import static org.openmetadata.service.search.EntityBuilderConstant.ES_MESSAGE_SCHEMA_FIELD;
import static org.openmetadata.service.search.EntityBuilderConstant.FIELD_DISPLAY_NAME_NGRAM;
import static org.openmetadata.service.search.EntityBuilderConstant.FIELD_NAME_NGRAM;
import static org.openmetadata.service.search.EntityBuilderConstant.FULLY_QUALIFIED_NAME_PARTS;
import static org.openmetadata.service.search.EntityBuilderConstant.NAME_KEYWORD;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Predicate;
import java.util.stream.Collectors;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.ParseTags;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.FlattenSchemaField;
import org.openmetadata.service.search.models.SearchSuggest;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.JsonUtils;

public class TopicIndex implements SearchIndex {
  final List<String> excludeTopicFields = List.of("sampleData", "changeDescription", "messageSchema");
  final Topic topic;

  public TopicIndex(Topic topic) {
    this.topic = topic;
  }

  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(topic);
    List<SearchSuggest> suggest = new ArrayList<>();
    List<SearchSuggest> fieldSuggest = new ArrayList<>();
    List<SearchSuggest> serviceSuggest = new ArrayList<>();
    suggest.add(SearchSuggest.builder().input(topic.getFullyQualifiedName()).weight(5).build());
    suggest.add(SearchSuggest.builder().input(topic.getName()).weight(10).build());
    serviceSuggest.add(SearchSuggest.builder().input(topic.getService().getName()).weight(5).build());
    SearchIndexUtils.removeNonIndexableFields(doc, excludeTopicFields);

    if (topic.getMessageSchema() != null
        && topic.getMessageSchema().getSchemaFields() != null
        && !topic.getMessageSchema().getSchemaFields().isEmpty()) {
      List<FlattenSchemaField> flattenFields = new ArrayList<>();
      parseSchemaFields(topic.getMessageSchema().getSchemaFields(), flattenFields, null);

      for (FlattenSchemaField field : flattenFields) {
        fieldSuggest.add(SearchSuggest.builder().input(field.getName()).weight(5).build());
      }
    }

    ParseTags parseTags = new ParseTags(Entity.getEntityTags(Entity.TOPIC, topic));
    doc.put("displayName", topic.getDisplayName() != null ? topic.getDisplayName() : topic.getName());
    doc.put("tags", parseTags.getTags());
    doc.put("tier", parseTags.getTierTag());
    doc.put("followers", SearchIndexUtils.parseFollowers(topic.getFollowers()));
    doc.put("suggest", suggest);
    doc.put("field_suggest", fieldSuggest);
    doc.put("service_suggest", serviceSuggest);
    doc.put("entityType", Entity.TOPIC);
    doc.put("serviceType", topic.getServiceType());
    doc.put("messageSchema", topic.getMessageSchema() != null ? topic.getMessageSchema() : null);
    doc.put(
        "fqnParts",
        getFQNParts(
            topic.getFullyQualifiedName(), suggest.stream().map(SearchSuggest::getInput).collect(Collectors.toList())));
    if (topic.getOwner() != null) {
      doc.put("owner", getOwnerWithDisplayName(topic.getOwner()));
    }
    if (topic.getDomain() != null) {
      doc.put("domain", getDomainWithDisplayName(topic.getDomain()));
    }
    return doc;
  }

  private void parseSchemaFields(
      List<Field> fields, List<FlattenSchemaField> flattenSchemaFields, String parentSchemaField) {
    Optional<String> optParentField = Optional.ofNullable(parentSchemaField).filter(Predicate.not(String::isEmpty));
    List<TagLabel> tags = new ArrayList<>();
    for (Field field : fields) {
      String fieldName = field.getName();
      if (optParentField.isPresent()) {
        fieldName = FullyQualifiedName.add(optParentField.get(), fieldName);
      }
      if (field.getTags() != null) {
        tags = field.getTags();
      }

      FlattenSchemaField flattenSchemaField =
          FlattenSchemaField.builder().name(fieldName).description(field.getDescription()).build();

      if (!tags.isEmpty()) {
        flattenSchemaField.setTags(tags);
      }
      flattenSchemaFields.add(flattenSchemaField);
      if (field.getChildren() != null) {
        parseSchemaFields(field.getChildren(), flattenSchemaFields, field.getName());
      }
    }
  }

  public static Map<String, Float> getFields() {
    Map<String, Float> fields = new HashMap<>();
    fields.put(FIELD_DISPLAY_NAME, 15.0f);
    fields.put(FIELD_DISPLAY_NAME_NGRAM, 1.0f);
    fields.put(FIELD_NAME, 15.0f);
    fields.put(FIELD_NAME_NGRAM, 1.0f);
    fields.put(DISPLAY_NAME_KEYWORD, 25.0f);
    fields.put(NAME_KEYWORD, 25.0f);
    fields.put(FULLY_QUALIFIED_NAME_PARTS, 10.0f);
    fields.put(FIELD_DESCRIPTION, 1.0f);
    fields.put(ES_MESSAGE_SCHEMA_FIELD, 2.0f);
    fields.put("messageSchema.schemaFields.description", 1.0f);
    fields.put("messageSchema.schemaFields.children.name", 2.0f);
    return fields;
  }
}
