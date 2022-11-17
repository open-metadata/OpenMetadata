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

package org.openmetadata.service.resources.tags;

import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheLoader;
import com.google.common.cache.LoadingCache;
import com.google.common.util.concurrent.UncheckedExecutionException;
import java.io.IOException;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import javax.annotation.CheckForNull;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.tags.Tag;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TagLabel.TagSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.util.EntityUtil.Fields;

/**
 * Both GlossaryTerm and Tags are used for labeling entity. This class caches GlossaryTerm and Tags for quick look up.
 */
@Slf4j
public class TagLabelCache {
  private static final TagLabelCache INSTANCE = new TagLabelCache();
  private static volatile boolean INITIALIZED = false;
  protected static EntityRepository<Tag> TAG_REPOSITORY;
  protected static EntityRepository<GlossaryTerm> GLOSSARY_TERM_REPOSITORY;

  // Tag fqn to Tag information
  protected static LoadingCache<String, Tag> TAG_CACHE;

  // Glossary fqn to GlossaryTerm information
  protected static LoadingCache<String, GlossaryTerm> GLOSSARY_CACHE;

  // Expected to be called only once from the TagResource during initialization
  public static void initialize() {
    if (!INITIALIZED) {
      TAG_CACHE =
          CacheBuilder.newBuilder().maximumSize(1000).expireAfterAccess(1, TimeUnit.MINUTES).build(new TagLoader());
      GLOSSARY_CACHE =
          CacheBuilder.newBuilder()
              .maximumSize(1000)
              .expireAfterAccess(1, TimeUnit.MINUTES)
              .build(new GlossaryTermLoader());
      TAG_REPOSITORY = Entity.getEntityRepository(Entity.TAG);
      GLOSSARY_TERM_REPOSITORY = Entity.getEntityRepository(Entity.GLOSSARY_TERM);
      INITIALIZED = true;
    } else {
      LOG.info("Subject cache is already initialized");
    }
  }

  public static TagLabelCache getInstance() {
    return INSTANCE;
  }

  public Tag getTag(String tagFqn) {
    try {
      return TAG_CACHE.get(tagFqn);
    } catch (ExecutionException | UncheckedExecutionException ex) {
      throw new EntityNotFoundException(ex.getMessage());
    }
  }

  public GlossaryTerm getGlossaryTerm(String glossaryTermFqn) {
    try {
      return GLOSSARY_CACHE.get(glossaryTermFqn);
    } catch (ExecutionException | UncheckedExecutionException ex) {
      throw new EntityNotFoundException(ex.getMessage());
    }
  }

  public String getDescription(TagLabel label) {
    if (label.getSource() == TagSource.TAG) {
      return getTag(label.getTagFQN()).getDescription();
    } else if (label.getSource() == TagSource.GLOSSARY) {
      return getGlossaryTerm(label.getTagFQN()).getDescription();
    } else {
      throw new IllegalArgumentException("Invalid source type " + label.getSource());
    }
  }

  static class TagLoader extends CacheLoader<String, Tag> {
    @Override
    public Tag load(@CheckForNull String tagName) throws IOException {
      Tag tag = TAG_REPOSITORY.getByName(null, tagName, Fields.EMPTY_FIELDS);
      LOG.info("Loaded user {}:{}", tag.getName(), tag.getId());
      return tag;
    }
  }

  static class GlossaryTermLoader extends CacheLoader<String, GlossaryTerm> {
    @Override
    public GlossaryTerm load(@CheckForNull String glossaryTermName) throws IOException {
      GlossaryTerm glossaryTerm = GLOSSARY_TERM_REPOSITORY.getByName(null, glossaryTermName, Fields.EMPTY_FIELDS);
      LOG.info("Loaded user {}:{}", glossaryTerm.getName(), glossaryTerm.getId());
      return glossaryTerm;
    }
  }
}
