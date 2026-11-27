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

package org.openmetadata.service.rdf.inference;

import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import org.openmetadata.service.jdbi3.RdfInfraDAOs.RdfInferenceRuleDAO;
import org.openmetadata.service.jdbi3.RdfInfraDAOs.RdfInferenceRuleDAO.RdfInferenceRuleRow;

/** In-memory {@code rdf_inference_rule} table with the same row semantics as the SQL DAO. */
final class InMemoryInferenceRuleDAO implements RdfInferenceRuleDAO {
  private final Map<String, StoredRule> rules = new TreeMap<>();
  private boolean failNextInsert;

  @Override
  public void insertIfAbsent(
      final String name, final String json, final boolean systemRule, final long updatedAt) {
    if (failNextInsert) {
      failNextInsert = false;
      throw new IllegalStateException("database unavailable");
    }
    rules.computeIfAbsent(name, ignored -> new StoredRule(json, systemRule, updatedAt));
  }

  @Override
  public void upsert(final String name, final String json, final long updatedAt) {
    final StoredRule existing = rules.get(name);
    if (existing == null) {
      rules.put(name, new StoredRule(json, false, updatedAt));
    } else {
      existing.json = json;
      existing.deleted = false;
      existing.updatedAt = updatedAt;
      existing.lastError = null;
      existing.invalidate();
    }
  }

  @Override
  public void softDelete(final String name, final long updatedAt) {
    final StoredRule rule = rules.get(name);
    rule.deleted = true;
    rule.dirty = false;
    rule.updatedAt = updatedAt;
  }

  @Override
  public void markMaterialized(
      final String name, final long completedAt, final long tripleCount, final long dirtyVersion) {
    final StoredRule rule = rules.get(name);
    rule.dirty = rule.dirtyVersion != dirtyVersion;
    rule.lastMaterializedAt = completedAt;
    rule.lastTripleCount = tripleCount;
    rule.lastError = null;
  }

  @Override
  public void markCleared(final String name, final long completedAt, final long dirtyVersion) {
    final StoredRule rule = rules.get(name);
    rule.dirty = rule.dirtyVersion != dirtyVersion;
    rule.lastMaterializedAt = completedAt;
    rule.lastTripleCount = 0;
  }

  @Override
  public void markFailed(final String name, final String lastError) {
    final StoredRule rule = rules.get(name);
    rule.dirty = true;
    rule.lastError = lastError;
  }

  @Override
  public void markAllDirty() {
    rules.values().stream().filter(rule -> !rule.deleted).forEach(StoredRule::invalidate);
  }

  @Override
  public void disable(
      final String name, final String json, final String lastError, final long updatedAt) {
    final StoredRule rule = rules.get(name);
    rule.json = json;
    rule.lastError = lastError;
    rule.updatedAt = updatedAt;
    rule.invalidate();
  }

  @Override
  public List<RdfInferenceRuleRow> listActive() {
    return rules.entrySet().stream()
        .filter(entry -> !entry.getValue().deleted)
        .map(entry -> entry.getValue().toRow(entry.getKey()))
        .toList();
  }

  @Override
  public List<String> listNames() {
    return List.copyOf(rules.keySet());
  }

  @Override
  public RdfInferenceRuleRow findActive(final String name) {
    final StoredRule rule = rules.get(name);
    return rule == null || rule.deleted ? null : rule.toRow(name);
  }

  void retire(final String name) {
    rules.get(name).deleted = true;
  }

  void failNextInsert() {
    failNextInsert = true;
  }

  private static final class StoredRule {
    private String json;
    private final boolean systemRule;
    private boolean dirty = true;
    private boolean deleted;
    private long updatedAt;
    private Long lastMaterializedAt;
    private long lastTripleCount;
    private String lastError;
    private long dirtyVersion;

    private StoredRule(final String json, final boolean systemRule, final long updatedAt) {
      this.json = json;
      this.systemRule = systemRule;
      this.updatedAt = updatedAt;
    }

    private void invalidate() {
      dirty = true;
      dirtyVersion++;
    }

    private RdfInferenceRuleRow toRow(final String name) {
      return new RdfInferenceRuleRow(
          name,
          json,
          systemRule,
          dirty,
          updatedAt,
          lastMaterializedAt,
          lastTripleCount,
          lastError,
          dirtyVersion);
    }
  }
}
