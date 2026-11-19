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
package org.openmetadata.service.search.vector;

import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.function.BinaryOperator;
import java.util.stream.IntStream;
import org.openmetadata.service.search.vector.utils.AvailableEntityTypes;

/**
 * Reciprocal rank fusion of one question's word ranking and meaning ranking, each ranked over its
 * whole scope: an entity scores {@code weight / (rankConstant + rank)} in each leg it is ranked in.
 * A type that carries no embeddings cannot be ranked by meaning, so its word rank stands for both
 * legs; a type searched by meaning alone is ranked by its meaning rank in both. A column found by
 * words is a word match for its table too. Hits name their entity in
 * {@code parentId}; equal scores keep the order the entities were first ranked in, words first.
 */
public record HybridRanking(double wordWeight, double meaningWeight, int rankConstant) {

  private static final String PARENT_ID = "parentId";
  private static final String ENTITY_TYPE = "entityType";
  private static final String COLUMN = "tableColumn";
  private static final String TABLE = "table";
  private static final String ID = "id";
  private static final String SCORE = "_score";

  public List<Map<String, Object>> fuse(
      final List<Map<String, Object>> byWords,
      final List<Map<String, Object>> byMeaning,
      final int size) {
    return fuse(byWords, byMeaning, Set.of(), size);
  }

  public List<Map<String, Object>> fuse(
      final List<Map<String, Object>> byWords,
      final List<Map<String, Object>> byMeaning,
      final Set<String> byMeaningOnly,
      final int size) {
    final Map<String, Map<String, Object>> entities = new LinkedHashMap<>();
    byWords.forEach(hit -> entities.putIfAbsent(entityOf(hit), hit));
    byMeaning.forEach(hit -> entities.putIfAbsent(entityOf(hit), hit));
    final Map<String, Integer> wordRanks = wordRanks(byWords);
    final Map<String, Integer> meaningRanks = ranks(byMeaning);
    final Map<String, Double> scores = new HashMap<>();
    entities.forEach(
        (entity, hit) ->
            scores.put(
                entity,
                share(wordWeight, wordRankOf(hit, entity, byMeaningOnly, wordRanks, meaningRanks))
                    + share(meaningWeight, meaningRankOf(hit, entity, wordRanks, meaningRanks))));
    return entities.keySet().stream()
        .sorted(Comparator.comparingDouble(scores::get).reversed())
        .limit(size)
        .map(entity -> scored(entities.get(entity), scores.get(entity)))
        .toList();
  }

  private double share(final double weight, final Integer rank) {
    return rank == null ? 0.0 : weight / (rankConstant + rank);
  }

  private static Integer wordRankOf(
      final Map<String, Object> hit,
      final String entity,
      final Set<String> byMeaningOnly,
      final Map<String, Integer> wordRanks,
      final Map<String, Integer> meaningRanks) {
    return byMeaningOnly.contains(Objects.toString(hit.get(ENTITY_TYPE), ""))
        ? meaningRanks.get(entity)
        : wordRanks.get(entity);
  }

  private static Integer meaningRankOf(
      final Map<String, Object> hit,
      final String entity,
      final Map<String, Integer> wordRanks,
      final Map<String, Integer> meaningRanks) {
    return AvailableEntityTypes.isVectorIndexable(Objects.toString(hit.get(ENTITY_TYPE), null))
        ? meaningRanks.get(entity)
        : wordRanks.get(entity);
  }

  private static Map<String, Integer> wordRanks(final List<Map<String, Object>> byWords) {
    final Map<String, Integer> ranks = ranks(byWords);
    final BinaryOperator<Integer> better = Math::min;
    IntStream.range(0, byWords.size())
        .forEach(
            index ->
                tableOfColumn(byWords.get(index))
                    .ifPresent(table -> ranks.merge(table, index + 1, better)));
    return ranks;
  }

  private static Map<String, Integer> ranks(final List<Map<String, Object>> hits) {
    final Map<String, Integer> ranks = new HashMap<>();
    IntStream.range(0, hits.size())
        .forEach(index -> ranks.putIfAbsent(entityOf(hits.get(index)), index + 1));
    return ranks;
  }

  private static Optional<String> tableOfColumn(final Map<String, Object> hit) {
    return COLUMN.equals(hit.get(ENTITY_TYPE)) && hit.get(TABLE) instanceof Map<?, ?> table
        ? Optional.ofNullable(table.get(ID)).map(Object::toString)
        : Optional.empty();
  }

  private static String entityOf(final Map<String, Object> hit) {
    return Objects.toString(hit.get(PARENT_ID), "");
  }

  private static Map<String, Object> scored(final Map<String, Object> hit, final double score) {
    final Map<String, Object> scoredHit = new LinkedHashMap<>(hit);
    scoredHit.put(SCORE, score);
    return scoredHit;
  }
}
