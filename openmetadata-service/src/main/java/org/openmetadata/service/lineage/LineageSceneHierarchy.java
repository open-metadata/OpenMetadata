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

package org.openmetadata.service.lineage;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.lineage.LineageSceneMapper.fqn;
import static org.openmetadata.service.lineage.LineageSceneMapper.nullableList;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import org.openmetadata.schema.api.lineage.LineageBand;
import org.openmetadata.schema.api.lineage.LineageLens;
import org.openmetadata.schema.api.lineage.LineageLevelKind;
import org.openmetadata.schema.api.lineage.LineageSceneBreadcrumb;
import org.openmetadata.service.lineage.LineageSceneMapper.Ref;
import org.openmetadata.service.lineage.LineageSceneMapper.SceneAsset;

final class LineageSceneHierarchy {
  private LineageSceneHierarchy() {}

  static SceneAsset findFocusAsset(Collection<SceneAsset> assets, String focusFqn) {
    if (nullOrEmpty(focusFqn)) {
      return null;
    }
    for (SceneAsset asset : assets) {
      if (asset.hasFqn(focusFqn)) {
        return asset;
      }
    }
    return null;
  }

  static boolean isFocusedContainerScene(LineageBand band, Ref focusRef) {
    return band == LineageBand.ASSET && focusRef != null && !isAssetKind(focusRef.kind());
  }

  static boolean shouldSeedRootLayerNodes(LineageBand band, Ref focusRef) {
    return band == LineageBand.LAYER && focusRef == null;
  }

  static boolean isContainedChild(SceneAsset asset, Ref focusRef) {
    return asset.isDescendantOf(focusRef) && !Objects.equals(asset.self().fqn(), focusRef.fqn());
  }

  static boolean isParentRollupEdge(Ref focusRef, Ref fromRef, Ref toRef) {
    return Objects.equals(fqn(fromRef), fqn(focusRef)) || Objects.equals(fqn(toRef), fqn(focusRef));
  }

  static Ref selectRef(
      SceneAsset asset,
      LineageLens lens,
      LineageBand band,
      Ref focusRef,
      SelectionLevel selectionLevel) {
    if (band == LineageBand.LAYER) {
      return lensRef(asset, lens).orElse(asset.self());
    }
    if (band == LineageBand.FIELD || focusRef == null || isAssetKind(focusRef.kind())) {
      return refForLevel(asset, selectionLevel.kind()).orElse(asset.self());
    }
    if (!asset.isDescendantOf(focusRef)) {
      return lensRef(asset, lens).orElse(asset.self());
    }
    if (focusRef.kind() == LineageLevelKind.DOMAIN
        || focusRef.kind() == LineageLevelKind.DATA_PRODUCT) {
      return asset.self();
    }
    return refForLevel(asset, selectionLevel.kind()).orElse(asset.self());
  }

  static SelectionLevel selectionLevel(
      Collection<SceneAsset> assets, LineageLens lens, LineageBand band, Ref focusRef) {
    if (band == LineageBand.FIELD) {
      return new SelectionLevel(LineageLevelKind.ASSET);
    }
    if (band == LineageBand.LAYER) {
      return new SelectionLevel(lensKind(lens));
    }
    List<LineageLevelKind> candidates = descendantLevelCandidates(lens, focusRef);
    for (LineageLevelKind candidate : candidates) {
      boolean hasReferences =
          assets.stream()
              .filter(asset -> focusRef == null || asset.isDescendantOf(focusRef))
              .anyMatch(
                  asset ->
                      refForLevel(asset, candidate)
                          .filter(ref -> !nullOrEmpty(ref.fqn()))
                          .isPresent());
      if (hasReferences) {
        return new SelectionLevel(candidate);
      }
    }
    return new SelectionLevel(LineageLevelKind.ASSET);
  }

  private static List<LineageLevelKind> descendantLevelCandidates(LineageLens lens, Ref focusRef) {
    if (focusRef == null) {
      return switch (lens) {
        case SERVICE -> List.of(LineageLevelKind.DATABASE, LineageLevelKind.SCHEMA);
        case DOMAIN, DATA_PRODUCT -> List.of(LineageLevelKind.SERVICE);
      };
    }
    return switch (focusRef.kind()) {
      case SERVICE -> List.of(LineageLevelKind.DATABASE, LineageLevelKind.SCHEMA);
      case DATABASE -> List.of(LineageLevelKind.SCHEMA);
      case DOMAIN, DATA_PRODUCT -> List.of(LineageLevelKind.SERVICE);
      default -> List.of();
    };
  }

  private static Optional<Ref> refForLevel(SceneAsset asset, LineageLevelKind level) {
    return switch (level) {
      case SERVICE -> Optional.ofNullable(asset.service());
      case DATABASE -> Optional.ofNullable(asset.database());
      case SCHEMA -> Optional.ofNullable(asset.schema());
      case DOMAIN -> Optional.ofNullable(asset.domain());
      case DATA_PRODUCT -> Optional.ofNullable(asset.dataProduct());
      case ASSET -> Optional.of(asset.self());
      default -> Optional.empty();
    };
  }

  static Optional<Ref> lensRef(SceneAsset asset, LineageLens lens) {
    return switch (lens) {
      case DOMAIN -> Optional.ofNullable(
          asset.self().kind() == LineageLevelKind.DOMAIN ? asset.self() : asset.domain());
      case DATA_PRODUCT -> Optional.ofNullable(
          asset.self().kind() == LineageLevelKind.DATA_PRODUCT
              ? asset.self()
              : asset.dataProduct());
      case SERVICE -> Optional.ofNullable(asset.service());
    };
  }

  private static boolean isAssetKind(LineageLevelKind kind) {
    return switch (kind) {
      case TABLE,
          TOPIC,
          DASHBOARD,
          DASHBOARD_DATA_MODEL,
          MODEL,
          PIPELINE,
          STORED_PROCEDURE,
          CONTAINER,
          SEARCH_INDEX,
          API_ENDPOINT,
          METRIC,
          DIRECTORY,
          FILE,
          SPREADSHEET,
          WORKSHEET,
          ASSET -> true;
      default -> false;
    };
  }

  @SafeVarargs
  private static <T> T firstNonNull(T... values) {
    for (T value : values) {
      if (value != null) {
        return value;
      }
    }
    return null;
  }

  static boolean isGhost(SceneAsset asset, Ref focusRef) {
    return focusRef != null
        && !asset.isDescendantOf(focusRef)
        && !Objects.equals(asset.self().fqn(), focusRef.fqn());
  }

  static LineageBand nodeBand(LineageLevelKind kind, LineageBand sceneBand) {
    if (sceneBand == LineageBand.LAYER
        || kind == LineageLevelKind.SERVICE
        || kind == LineageLevelKind.DOMAIN
        || kind == LineageLevelKind.DATA_PRODUCT) {
      return LineageBand.LAYER;
    }
    if (kind == LineageLevelKind.COLUMN
        || kind == LineageLevelKind.FIELD
        || kind == LineageLevelKind.CHART
        || kind == LineageLevelKind.FEATURE
        || kind == LineageLevelKind.TASK) {
      return LineageBand.FIELD;
    }
    return LineageBand.ASSET;
  }

  static String parentId(Ref ref, SceneAsset asset) {
    Ref parent = parentRef(ref, asset);
    return parent == null ? null : parent.nodeId();
  }

  static String parentFqn(Ref ref, SceneAsset asset) {
    Ref parent = parentRef(ref, asset);
    return parent == null ? null : parent.fqn();
  }

  private static Ref parentRef(Ref ref, SceneAsset asset) {
    if (Objects.equals(ref.fqn(), asset.self().fqn())) {
      return firstNonNull(
          asset.schema(), asset.database(), asset.service(), asset.domain(), asset.dataProduct());
    }
    if (Objects.equals(ref.fqn(), fqn(asset.schema()))) {
      return firstNonNull(asset.database(), asset.service());
    }
    if (Objects.equals(ref.fqn(), fqn(asset.database()))) {
      return asset.service();
    }
    return null;
  }

  static LineageLevelKind fieldKind(LineageLevelKind kind) {
    return switch (kind) {
      case TOPIC, SEARCH_INDEX, API_ENDPOINT -> LineageLevelKind.FIELD;
      case DASHBOARD -> LineageLevelKind.CHART;
      case MODEL -> LineageLevelKind.FEATURE;
      case PIPELINE -> LineageLevelKind.TASK;
      default -> LineageLevelKind.COLUMN;
    };
  }

  static boolean isExpandable(Ref ref, SceneAsset asset) {
    if (Objects.equals(ref.fqn(), asset.self().fqn())) {
      return isContainerKind(ref.kind()) || !asset.fields().isEmpty();
    }
    return isContainerKind(ref.kind()) || asset.isDescendantOf(ref);
  }

  private static boolean isContainerKind(LineageLevelKind kind) {
    return switch (kind) {
      case SERVICE, DATABASE, SCHEMA, DOMAIN, DATA_PRODUCT -> true;
      default -> false;
    };
  }

  static List<LineageSceneBreadcrumb> buildBreadcrumb(
      LineageLens lens, LineageBand band, SceneAsset focusAsset, Ref focusRef) {
    List<LineageSceneBreadcrumb> breadcrumb = new ArrayList<>();
    breadcrumb.add(
        new LineageSceneBreadcrumb()
            .withId("lens:" + lens.value())
            .withLabel(lens.value())
            .withLevelKind(lensKind(lens))
            .withBand(LineageBand.LAYER));
    if (focusAsset == null) {
      return breadcrumb;
    }
    List<Ref> refs =
        switch (lens) {
          case DOMAIN -> nullableList(focusAsset.domain(), focusAsset.self());
          case DATA_PRODUCT -> nullableList(focusAsset.dataProduct(), focusAsset.self());
          case SERVICE -> nullableList(
              focusAsset.service(), focusAsset.database(), focusAsset.schema(), focusAsset.self());
        };
    Set<String> seen = new LinkedHashSet<>();
    for (Ref ref : refs) {
      if (ref == null || nullOrEmpty(ref.fqn()) || !seen.add(ref.fqn())) {
        continue;
      }
      breadcrumb.add(
          new LineageSceneBreadcrumb()
              .withId(ref.nodeId())
              .withLabel(ref.label())
              .withFullyQualifiedName(ref.fqn())
              .withEntityType(ref.entityType())
              .withLevelKind(ref.kind())
              .withBand(nodeBand(ref.kind(), band)));
      if (focusRef != null && Objects.equals(ref.fqn(), focusRef.fqn())) {
        break;
      }
    }
    return breadcrumb;
  }

  private static LineageLevelKind lensKind(LineageLens lens) {
    return switch (lens) {
      case DOMAIN -> LineageLevelKind.DOMAIN;
      case DATA_PRODUCT -> LineageLevelKind.DATA_PRODUCT;
      case SERVICE -> LineageLevelKind.SERVICE;
    };
  }

  record SelectionLevel(LineageLevelKind kind) {}
}
