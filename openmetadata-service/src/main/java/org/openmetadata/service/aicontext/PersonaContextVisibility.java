/*
 *  Copyright 2026 Collate
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
package org.openmetadata.service.aicontext;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import jakarta.ws.rs.core.SecurityContext;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.data.Page;
import org.openmetadata.schema.type.AIContext;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.aicontext.AssetContext;
import org.openmetadata.schema.type.aicontext.FieldContext;
import org.openmetadata.schema.type.aicontext.KnowledgeItem;
import org.openmetadata.schema.type.personaContext.SharedKnowledge;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.security.Authorizer;

/** Per-read authorization and copying of shared, unfiltered persona source data. */
final class PersonaContextVisibility {
  private final Authorizer authorizer;
  private final SecurityContext securityContext;
  private final Cache<AssetKey, Boolean> permissions =
      Caffeine.newBuilder().maximumSize(1000).build();

  PersonaContextVisibility(Authorizer authorizer, SecurityContext securityContext) {
    this.authorizer = authorizer;
    this.securityContext = securityContext;
  }

  boolean canView(String entityType, String fqn) {
    return canView(
        entityType,
        fqn,
        entityType != null && PersonaContextBuilder.isKnowledgeEntityType(entityType)
            ? MetadataOperation.VIEW_BASIC
            : MetadataOperation.VIEW_ALL);
  }

  private boolean canView(String entityType, String fqn, MetadataOperation operation) {
    return !nullOrEmpty(entityType)
        && !nullOrEmpty(fqn)
        && permissions.get(
            new AssetKey(entityType, fqn, operation),
            ignored ->
                AIContextBuilder.canViewKnowledge(
                    authorizer, securityContext, entityType, fqn, operation));
  }

  PersonaContextBuilder.SelectedEntity filter(PersonaContextBuilder.SelectedEntity source) {
    AIContext context = JsonUtils.deepCopy(source.context(), AIContext.class);
    EntityInterface<?> entity = copyKnowledgeEntity(source.knowledgeEntity());
    if (authorizer != null) {
      context
          .withGlossaryTerms(knowledge(context.getGlossaryTerms()))
          .withArticles(knowledge(context.getArticles()))
          .withMetrics(knowledge(context.getMetrics()));
      filterFields(context.getAssetContext());
      filterLineage(context, source.lineageNodes());
      filterObservability(context);
      filterKnowledgeReferences(entity);
    }
    return new PersonaContextBuilder.SelectedEntity(
        source.id(),
        source.document(),
        context,
        source.knowledgeItem(),
        entity,
        source.lineageNodes());
  }

  SharedKnowledge filterSharedKnowledge(
      SharedKnowledge source, List<PersonaContextBuilder.RuleMaterialization> rules) {
    Set<String> referenced = new HashSet<>();
    for (PersonaContextBuilder.RuleMaterialization rule : rules) {
      if (!PersonaContextBuilder.isKnowledgeEntityType(rule.rule().getEntityType())) {
        for (PersonaContextBuilder.SelectedEntity entity : rule.entities()) {
          addReferences(referenced, entity.context().getGlossaryTerms());
          addReferences(referenced, entity.context().getArticles());
          addReferences(referenced, entity.context().getMetrics());
        }
      }
    }
    return new SharedKnowledge()
        .withGlossaryTerms(referencedKnowledge(source.getGlossaryTerms(), referenced))
        .withArticles(referencedKnowledge(source.getArticles(), referenced))
        .withMetrics(referencedKnowledge(source.getMetrics(), referenced));
  }

  private List<KnowledgeItem> referencedKnowledge(
      List<KnowledgeItem> items, Set<String> referenced) {
    return listOrEmpty(knowledge(items)).stream()
        .filter(item -> referenced.contains(key(item)))
        .map(item -> JsonUtils.deepCopy(item, KnowledgeItem.class))
        .toList();
  }

  private static void addReferences(Set<String> references, List<KnowledgeItem> items) {
    listOrEmpty(items).forEach(item -> references.add(key(item)));
  }

  private static String key(KnowledgeItem item) {
    return item.getType().value() + ':' + item.getFullyQualifiedName();
  }

  private List<KnowledgeItem> knowledge(List<KnowledgeItem> items) {
    return items == null
        ? null
        : items.stream()
            .filter(Objects::nonNull)
            .filter(item -> item.getType() != null)
            .filter(item -> item.getType() != KnowledgeItem.Type.CONTEXT_MEMORY)
            .filter(item -> canView(item.getType().value(), item.getFullyQualifiedName()))
            .toList();
  }

  private void filterFields(AssetContext asset) {
    List<FieldContext> fields = new ArrayList<>();
    if (asset != null) {
      if (asset.getTable() != null) {
        fields.addAll(listOrEmpty(asset.getTable().getColumns()));
      }
      if (asset.getTopic() != null) {
        fields.addAll(listOrEmpty(asset.getTopic().getSchemaFields()));
      }
      if (asset.getPipeline() != null) {
        fields.addAll(listOrEmpty(asset.getPipeline().getTasks()));
      }
      if (asset.getGeneric() != null) {
        fields.addAll(listOrEmpty(asset.getGeneric().getFields()));
      }
    }
    fields.forEach(field -> field.withGlossaryTerms(knowledge(field.getGlossaryTerms())));
  }

  private void filterLineage(AIContext context, List<EntityReference> nodes) {
    Map<String, EntityReference> references = new HashMap<>();
    for (EntityReference node : listOrEmpty(nodes)) {
      references.merge(
          node.getFullyQualifiedName(),
          node,
          (left, right) ->
              Objects.equals(left.getType(), right.getType()) ? left : new EntityReference());
    }
    Set<String> visible = new HashSet<>();
    references.forEach(
        (fqn, reference) -> {
          if (canView(reference)) {
            visible.add(fqn);
          }
        });
    context
        .withUpstream(
            listOrEmpty(context.getUpstream()).stream().filter(visible::contains).toList())
        .withDownstream(
            listOrEmpty(context.getDownstream()).stream().filter(visible::contains).toList())
        .withUpstreamEdges(
            listOrEmpty(context.getUpstreamEdges()).stream()
                .filter(edge -> visible.contains(edge.getFullyQualifiedName()))
                .toList())
        .withDownstreamEdges(
            listOrEmpty(context.getDownstreamEdges()).stream()
                .filter(edge -> visible.contains(edge.getFullyQualifiedName()))
                .toList());
  }

  private boolean canView(EntityReference reference) {
    return reference != null && canView(reference.getType(), reference.getFullyQualifiedName());
  }

  private void filterObservability(AIContext context) {
    if (context.getObservability() != null && Entity.TABLE.equals(context.getEntityType())) {
      if (!canView(
          Entity.TABLE, context.getFullyQualifiedName(), MetadataOperation.VIEW_DATA_PROFILE)) {
        context.getObservability().withRowCount(null).withProfiledAt(null);
      }
      if (!canView(Entity.TABLE, context.getFullyQualifiedName(), MetadataOperation.VIEW_TESTS)) {
        context.getObservability().withDataQuality(null);
      }
    }
  }

  private List<EntityReference> references(List<EntityReference> values) {
    return listOrEmpty(values).stream().filter(this::canView).toList();
  }

  private static EntityInterface<?> copyKnowledgeEntity(EntityInterface<?> entity) {
    return switch (entity) {
      case null -> null;
      case Page page -> JsonUtils.deepCopy(page, Page.class);
      case Metric metric -> JsonUtils.deepCopy(metric, Metric.class);
      case GlossaryTerm term -> JsonUtils.deepCopy(term, GlossaryTerm.class);
      default -> throw new IllegalArgumentException("Unsupported persona knowledge entity");
    };
  }

  private void filterKnowledgeReferences(EntityInterface<?> entity) {
    switch (entity) {
      case null -> {}
      case Page page -> page.withRelatedEntities(references(page.getRelatedEntities()));
      case Metric metric -> metric
          .withAssets(references(metric.getAssets()))
          .withRelatedMetrics(references(metric.getRelatedMetrics()));
      case GlossaryTerm term -> term.withRelatedTerms(
          listOrEmpty(term.getRelatedTerms()).stream()
              .filter(relation -> canView(relation.getTerm()))
              .toList());
      default -> throw new IllegalArgumentException("Unsupported persona knowledge entity");
    }
  }

  private record AssetKey(String entityType, String fqn, MetadataOperation operation) {}
}
