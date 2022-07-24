package org.openmetadata.catalog.elasticsearch;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.data.Topic;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.JsonUtils;

public class TopicIndex implements ElasticSearchIndex {
  final List<String> excludeTopicFields = List.of("sampleData");
  Topic topic;

  public TopicIndex(Topic topic) {
    this.topic = topic;
  }

  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(topic);
    List<TagLabel> tags = new ArrayList<>();
    List<ElasticSearchSuggest> suggest = new ArrayList<>();
    List<ElasticSearchSuggest> serviceSuggest = new ArrayList<>();
    suggest.add(ElasticSearchSuggest.builder().input(topic.getFullyQualifiedName()).weight(5).build());
    suggest.add(ElasticSearchSuggest.builder().input(topic.getName()).weight(10).build());
    serviceSuggest.add(ElasticSearchSuggest.builder().input(topic.getService().getName()).weight(5).build());
    ElasticSearchIndexUtils.removeNonIndexableFields(doc, excludeTopicFields);
    if (topic.getTags() != null) {
      tags.addAll(topic.getTags());
    }
    ParseTags parseTags = new ParseTags(tags);
    doc.put("tags", parseTags.tags);
    doc.put("tier", parseTags.tierTag);
    doc.put("followers", ElasticSearchIndexUtils.parseFollowers(topic.getFollowers()));
    doc.put("suggest", suggest);
    doc.put("service_suggest", serviceSuggest);
    doc.put("entityType", Entity.TOPIC);
    doc.put("serviceType", topic.getServiceType());
    return doc;
  }
}
