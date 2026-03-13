package org.openmetadata.service.resources.feeds;

import static org.openmetadata.service.util.InputSanitizer.sanitize;

import java.util.Collections;
import java.util.UUID;
import org.openmetadata.schema.api.feed.CreatePost;
import org.openmetadata.schema.type.Post;

public class PostMapper {
  public Post createToEntity(CreatePost create, String user) {
    return new Post()
        .withId(UUID.randomUUID())
        .withMessage(sanitize(create.getMessage()))
        .withFrom(create.getFrom())
        .withReactions(Collections.emptyList())
        .withPostTs(System.currentTimeMillis());
  }
}
