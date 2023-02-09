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
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TagLabel.TagSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.ClassificationRepository;
import org.openmetadata.service.jdbi3.GlossaryRepository;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;
import org.openmetadata.service.jdbi3.TagRepository;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Both GlossaryTerm and Tags are used for labeling entity. This class caches GlossaryTerm and Tags for quick look up.
 */
@Slf4j
public class TagLabelCache {
  private static final TagLabelCache INSTANCE = new TagLabelCache();
  private static volatile boolean INITIALIZED = false;

  protected static TagRepository TAG_REPOSITORY;
  protected static ClassificationRepository TAG_CLASSIFICATION_REPOSITORY;
  protected static LoadingCache<String, Tag> TAG_CACHE; // Tag fqn to Tag
  protected static LoadingCache<String, Classification> TAG_CATEGORY_CACHE; // Classification name to Classification

  protected static GlossaryTermRepository GLOSSARY_TERM_REPOSITORY;
  protected static GlossaryRepository GLOSSARY_REPOSITORY;
  protected static LoadingCache<String, GlossaryTerm> GLOSSARY_TERM_CACHE; // Glossary term fqn to GlossaryTerm
  protected static LoadingCache<String, Glossary> GLOSSARY_CACHE; // Glossary fqn to Glossary

  // Expected to be called only once from the TagResource during initialization
  public static void initialize() {
    if (!INITIALIZED) {
      TAG_CATEGORY_CACHE =
          CacheBuilder.newBuilder()
              .maximumSize(25)
              .expireAfterWrite(2, TimeUnit.MINUTES)
              .build(new ClassificationLoader());
      TAG_CACHE =
          CacheBuilder.newBuilder().maximumSize(100).expireAfterWrite(2, TimeUnit.MINUTES).build(new TagLoader());
      TAG_REPOSITORY = (TagRepository) Entity.getEntityRepository(Entity.TAG);
      TAG_CLASSIFICATION_REPOSITORY = (ClassificationRepository) Entity.getEntityRepository(Entity.CLASSIFICATION);

      GLOSSARY_CACHE =
          CacheBuilder.newBuilder().maximumSize(25).expireAfterWrite(2, TimeUnit.MINUTES).build(new GlossaryLoader());
      GLOSSARY_TERM_CACHE =
          CacheBuilder.newBuilder()
              .maximumSize(100)
              .expireAfterWrite(2, TimeUnit.MINUTES)
              .build(new GlossaryTermLoader());
      GLOSSARY_TERM_REPOSITORY = (GlossaryTermRepository) Entity.getEntityRepository(Entity.GLOSSARY_TERM);
      GLOSSARY_REPOSITORY = (GlossaryRepository) Entity.getEntityRepository(Entity.GLOSSARY);
      INITIALIZED = true;
    } else {
      LOG.info("Subject cache is already initialized");
    }
  }

  public static TagLabelCache getInstance() {
    return INSTANCE;
  }

  public Classification getClassification(String categoryName) {
    try {
      return TAG_CATEGORY_CACHE.get(categoryName);
    } catch (ExecutionException | UncheckedExecutionException ex) {
      throw new EntityNotFoundException(ex.getMessage());
    }
  }

  public Tag getTag(String tagFqn) {
    try {
      return TAG_CACHE.get(tagFqn);
    } catch (ExecutionException | UncheckedExecutionException ex) {
      throw new EntityNotFoundException(ex.getMessage());
    }
  }

  public Glossary getGlossary(String glossaryName) {
    try {
      return GLOSSARY_CACHE.get(glossaryName);
    } catch (ExecutionException | UncheckedExecutionException ex) {
      throw new EntityNotFoundException(ex.getMessage());
    }
  }

  public GlossaryTerm getGlossaryTerm(String glossaryTermFqn) {
    try {
      return GLOSSARY_TERM_CACHE.get(glossaryTermFqn);
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

  /** Returns true if the parent of the tag label is mutually exclusive */
  public boolean mutuallyExclusive(TagLabel label) {
    String[] fqnParts = FullyQualifiedName.split(label.getTagFQN());
    String parentFqn = FullyQualifiedName.getParent(fqnParts);
    boolean rootParent = fqnParts.length == 2;
    if (label.getSource() == TagSource.TAG) {
      return rootParent
          ? getClassification(parentFqn).getMutuallyExclusive()
          : getTag(parentFqn).getMutuallyExclusive();
    } else if (label.getSource() == TagSource.GLOSSARY) {
      return rootParent
          ? getGlossary(parentFqn).getMutuallyExclusive()
          : getGlossaryTerm(parentFqn).getMutuallyExclusive();
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

  static class ClassificationLoader extends CacheLoader<String, Classification> {
    @Override
    public Classification load(@CheckForNull String categoryName) throws IOException {
      Classification category = TAG_CLASSIFICATION_REPOSITORY.getByName(null, categoryName, Fields.EMPTY_FIELDS);
      LOG.info("Loaded user {}:{}", category.getName(), category.getId());
      return category;
    }
  }

  static class GlossaryTermLoader extends CacheLoader<String, GlossaryTerm> {
    @Override
    public GlossaryTerm load(@CheckForNull String glossaryTermName) throws IOException {
      GlossaryTerm glossaryTerm = GLOSSARY_TERM_REPOSITORY.getByName(null, glossaryTermName, Fields.EMPTY_FIELDS);
      LOG.info("Loaded glossaryTerm {}:{}", glossaryTerm.getName(), glossaryTerm.getId());
      return glossaryTerm;
    }
  }

  static class GlossaryLoader extends CacheLoader<String, Glossary> {
    @Override
    public Glossary load(@CheckForNull String glossaryName) throws IOException {
      Glossary glossary = GLOSSARY_REPOSITORY.getByName(null, glossaryName, Fields.EMPTY_FIELDS);
      LOG.info("Loaded glossary {}:{}", glossary.getName(), glossary.getId());
      return glossary;
    }
  }
}
