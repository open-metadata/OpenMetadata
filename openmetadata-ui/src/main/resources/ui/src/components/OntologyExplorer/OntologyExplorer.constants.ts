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

export const RELATION_META: Record<
  string,
  { color: string; labelKey: string }
> = {
  relatedTo: { color: '#3062d4', labelKey: 'label.related-to' },
  related: { color: '#3062d4', labelKey: 'label.related' },
  synonym: { color: '#7c3aed', labelKey: 'label.synonym' },
  antonym: { color: '#dc2626', labelKey: 'label.antonym' },
  typeOf: { color: '#059669', labelKey: 'label.type-of' },
  hasTypes: { color: '#10b981', labelKey: 'label.has-types' },
  hasA: { color: '#0891b2', labelKey: 'label.has-a' },
  partOf: { color: '#0d9488', labelKey: 'label.part-of' },
  hasPart: { color: '#14b8a6', labelKey: 'label.has-part' },
  componentOf: { color: '#0891b2', labelKey: 'label.component-of' },
  composedOf: { color: '#06b6d4', labelKey: 'label.composed-of' },
  calculatedFrom: { color: '#d97706', labelKey: 'label.calculated-from' },
  usedToCalculate: { color: '#f59e0b', labelKey: 'label.used-to-calculate' },
  derivedFrom: { color: '#ea580c', labelKey: 'label.derived-from' },
  seeAlso: { color: '#be185d', labelKey: 'label.see-also' },
  parentOf: { color: '#4f46e5', labelKey: 'label.parent-of' },
  childOf: { color: '#6366f1', labelKey: 'label.child-of' },
  broader: { color: '#4f46e5', labelKey: 'label.broader' },
  narrower: { color: '#6366f1', labelKey: 'label.narrower' },
  isA: { color: '#059669', labelKey: 'label.is-a' },
  instanceOf: { color: '#10b981', labelKey: 'label.instance-of' },
  owns: { color: '#7c3aed', labelKey: 'label.owns' },
  ownedBy: { color: '#8b5cf6', labelKey: 'label.owned-by' },
  manages: { color: '#3062d4', labelKey: 'label.manages' },
  managedBy: { color: '#3b82f6', labelKey: 'label.managed-by' },
  contains: { color: '#0891b2', labelKey: 'label.contains' },
  containedIn: { color: '#06b6d4', labelKey: 'label.contained-in' },
  dependsOn: { color: '#dc2626', labelKey: 'label.depends-on' },
  usedBy: { color: '#d97706', labelKey: 'label.used-by' },
  metricFor: { color: '#0ea5e9', labelKey: 'label.metric-for' },
  hasGlossaryTerm: { color: '#0f766e', labelKey: 'label.tagged-with' },
  default: { color: '#6b7280', labelKey: 'label.relation-type' },
};

export const RELATION_COLORS: Record<string, string> = Object.fromEntries(
  Object.entries(RELATION_META).map(([key, { color }]) => [key, color])
);
