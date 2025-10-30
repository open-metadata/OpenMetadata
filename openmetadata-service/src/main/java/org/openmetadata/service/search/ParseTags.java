package org.openmetadata.service.search;

import java.util.ArrayList;
import java.util.List;
import lombok.Getter;
import org.openmetadata.schema.type.TagLabel;

@Getter
public class ParseTags {
  TagLabel tierTag;
  final List<TagLabel> tags;
  final List<String> classificationTags;
  final List<String> glossaryTags;

  public ParseTags(List<TagLabel> tags) {
    if (!tags.isEmpty()) {
      List<TagLabel> tagsList = new ArrayList<>(tags);
      List<String> classificationTagsList = new ArrayList<>();
      List<String> glossaryTagsList = new ArrayList<>();

      for (TagLabel tag : tagsList) {
        String tier = tag.getTagFQN().split("\\.")[0];
        if (tier.equalsIgnoreCase("tier")) {
          tierTag = tag;
          break;
        }
      }
      if (tierTag != null) {
        tagsList.remove(tierTag);
      }

      // Separate classification and glossary tags
      for (TagLabel tag : tags) {
        if (tag.getSource() == TagLabel.TagSource.CLASSIFICATION) {
          classificationTagsList.add(tag.getTagFQN());
        } else if (tag.getSource() == TagLabel.TagSource.GLOSSARY) {
          glossaryTagsList.add(tag.getTagFQN());
        }
      }

      this.tags = tagsList;
      this.classificationTags = classificationTagsList;
      this.glossaryTags = glossaryTagsList;
    } else {
      this.tags = tags;
      this.classificationTags = new ArrayList<>();
      this.glossaryTags = new ArrayList<>();
    }
  }
}
