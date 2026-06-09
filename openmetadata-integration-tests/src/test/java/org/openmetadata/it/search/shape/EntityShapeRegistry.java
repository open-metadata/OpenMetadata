/*
 *  Copyright 2024 Collate.
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
package org.openmetadata.it.search.shape;

import java.util.ArrayList;
import java.util.List;
import org.openmetadata.it.search.shape.mutations.CustomPropertiesBreadthMutation;
import org.openmetadata.it.search.shape.mutations.DescriptionSizeMutation;
import org.openmetadata.it.search.shape.mutations.FollowersCountMutation;
import org.openmetadata.it.search.shape.mutations.KeywordIgnoreAboveMutation;
import org.openmetadata.it.search.shape.mutations.OwnersCountMutation;
import org.openmetadata.it.search.shape.mutations.TagsCountMutation;
import org.openmetadata.it.search.shape.profiles.TableShapeProfile;

public final class EntityShapeRegistry {
  private final List<EntityShapeProfile> profiles = List.of(new TableShapeProfile());

  private final List<ShapeMutation> sharedMutations =
      List.of(
          new DescriptionSizeMutation(),
          new TagsCountMutation(),
          new OwnersCountMutation(),
          new FollowersCountMutation(),
          new CustomPropertiesBreadthMutation(),
          new KeywordIgnoreAboveMutation());

  public List<PlannedCase> plannedCases() {
    final List<PlannedCase> cases = new ArrayList<>();
    final ShapeContext ctx = new ShapeContext();
    for (final EntityShapeProfile profile : profiles) {
      addSharedCases(cases, ctx, profile);
      cases.addAll(profile.entitySpecificCases(ctx));
    }
    return List.copyOf(cases);
  }

  private void addSharedCases(
      final List<PlannedCase> cases, final ShapeContext ctx, final EntityShapeProfile profile) {
    for (final ShapeMutation mutation : sharedMutations) {
      if (mutation.appliesTo(profile.minimal(ctx))) {
        addLadder(cases, ctx, profile, mutation);
      }
    }
  }

  private void addLadder(
      final List<PlannedCase> cases,
      final ShapeContext ctx,
      final EntityShapeProfile profile,
      final ShapeMutation mutation) {
    for (final Rung rung : mutation.ladder()) {
      cases.add(
          new PlannedCase(
              profile.entityType(),
              mutation.dimension(),
              rung,
              () -> mutation.apply(profile.minimal(ctx), rung),
              mutation.probe(rung),
              engine -> mutation.expected(rung, engine)));
    }
  }
}
