package org.openmetadata.service.search;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;
import lombok.Getter;
import org.openmetadata.schema.type.TagLabel;

@Getter
public class ParseTags {
  TagLabel tierTag;
  final List<TagLabel> tags;
  private List<String> classificationTagFQNs;
  private List<String> glossaryTermFQNs;

  public ParseTags(List<TagLabel> tags) {
    if (!tags.isEmpty()) {
      List<TagLabel> tagsList = new ArrayList<>(tags);
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
      this.tags = tagsList;
      // Compute separated FQN lists by tag source
      this.classificationTagFQNs =
          tagsList.stream()
              .filter(
                  t ->
                      t.getSource() != null
                          && t.getSource().value().equalsIgnoreCase("Classification"))
              .map(TagLabel::getTagFQN)
              .collect(Collectors.toList());
      this.glossaryTermFQNs =
          tagsList.stream()
              .filter(
                  t -> t.getSource() != null && t.getSource().value().equalsIgnoreCase("Glossary"))
              .map(TagLabel::getTagFQN)
              .collect(Collectors.toList());
    } else {
      this.tags = tags;
      this.classificationTagFQNs = new ArrayList<>();
      this.glossaryTermFQNs = new ArrayList<>();
    }
  }

  public List<String> getClassificationTagFQNs() {
    return classificationTagFQNs;
  }

  public List<String> getGlossaryTermFQNs() {
    return glossaryTermFQNs;
  }
}
