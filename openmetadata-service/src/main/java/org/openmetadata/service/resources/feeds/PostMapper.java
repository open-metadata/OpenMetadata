package org.openmetadata.service.resources.feeds;

import java.util.Collections;
import java.util.UUID;
import org.openmetadata.schema.api.feed.CreatePost;
import org.openmetadata.schema.type.Post;

public class PostMapper {
  public Post createToEntity(CreatePost create, String user) {
    return new Post()
        .withId(UUID.randomUUID())
        .withMessage(create.getMessage())
        .withFrom(create.getFrom())
        .withReactions(Collections.emptyList())
        .withPostTs(System.currentTimeMillis());
  }
}
