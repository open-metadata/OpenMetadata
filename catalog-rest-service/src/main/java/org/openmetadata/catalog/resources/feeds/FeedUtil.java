/*
 *  Copyright 2021 Collate 
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.catalog.resources.feeds;

import org.openmetadata.catalog.entity.feed.Thread;
import org.openmetadata.catalog.type.Post;

import java.util.Collections;
import java.util.Date;

public final class FeedUtil {

  private FeedUtil() {

  }

  public static void addPost(Thread thread, Post post) {
    if (thread.getPosts() == null || thread.getPosts().isEmpty()) {
      // First post in the thread
      post.setPostTs(thread.getThreadTs());
      thread.setPosts(Collections.singletonList(post));
    } else {
      // Add new post to the thread
      post.setPostTs(new Date());
      thread.getPosts().add(post);
    }
  }
}
