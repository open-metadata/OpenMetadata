package org.openmetadata.service.search.models;

import lombok.Builder;
import lombok.Getter;
import lombok.Setter;
import org.openmetadata.schema.type.TagLabel;

import java.util.List;

@Getter
@Builder
public class FlattenColumn {
  String name;
  String fullyQualifiedName;
  String description;
  @Setter List<TagLabel> tags;
}
