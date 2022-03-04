/* eslint-disable @typescript-eslint/no-explicit-any */
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

/**
 * This schema defines the Thread entity. A Thread is a collection of posts made by the
 * users. The first post that starts a thread is **about** a data asset **from** a user.
 * Other users can respond to this post by creating new posts in the thread. Note that bot
 * users can also interact with a thread. A post can contains links that mention Users or
 * other Data Assets.
 */
export interface Thread {
  /**
   * Data asset about which this thread is created for with format
   * <#E/{entities}/{entityName}/{field}/{fieldValue}.
   */
  about: string;
  /**
   * User or team this thread is addressed to in format
   * <#E/{entities}/{entityName}/{field}/{fieldValue}.
   */
  addressedTo?: string;
  /**
   * User who created the thread.
   */
  createdBy?: string;
  /**
   * Entity Id of the entity that the thread belongs to.
   */
  entityId?: string;
  /**
   * Link to the resource corresponding to this entity.
   */
  href?: string;
  /**
   * Unique identifier that identifies an entity instance.
   */
  id: string;
  /**
   * The main message of the thread in markdown format
   */
  message?: string;
  posts: Post[];
  /**
   * The total count of posts in the thread
   */
  postsCount?: number;
  /**
   * When `true` indicates the thread has been resolved
   */
  resolved?: boolean;
  /**
   * Timestamp of the when the first post created the thread in Unix epoch time milliseconds.
   */
  threadTs?: number;
  /**
   * Last update time corresponding to the new version of the entity in Unix epoch time
   * milliseconds.
   */
  updatedAt?: number;
  /**
   * User who made the update.
   */
  updatedBy?: string;
}

/**
 * Post within a feed.
 */
export interface Post {
  /**
   * Name of the User posting the message
   */
  from: string;
  /**
   * Message in markdown format. See markdown support for more details.
   */
  message: string;
  /**
   * Timestamp of the post in Unix epoch time milliseconds.
   */
  postTs?: number;
}
