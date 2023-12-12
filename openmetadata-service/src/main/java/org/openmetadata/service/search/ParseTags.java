package org.openmetadata.service.search;

import java.util.ArrayList;
import java.util.List;
import lombok.Getter;
import org.openmetadata.schema.type.TagLabel;

@Getter
public class ParseTags {

  TagLabel tierTag;
  final List<TagLabel> tags;

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
    } else {
      this.tags = tags;
    }
  }
}
