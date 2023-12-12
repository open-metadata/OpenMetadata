package org.openmetadata.service.search.models;

import java.util.List;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;
import org.openmetadata.schema.type.TagLabel;

@Getter
@Builder
public class FlattenSchemaField {

  String name;
  String description;

  @Setter
  List<TagLabel> tags;
}
