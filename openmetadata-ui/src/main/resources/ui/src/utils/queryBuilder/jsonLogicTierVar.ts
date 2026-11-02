/*
 *  Copyright 2026 Collate.
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

// Tier only exists on a serialized entity as a `Tier.*` entry in the `tags` list —
// there is no `tier` property — so a governance rule keyed on `{"var":"tier"}`
// resolves to null under `RuleEngine.apply` and silently never matches (the server
// now rewrites that legacy shape at evaluation time so rules stored before this
// fix keep working, but new rules should be saved against `tags`). The Data
// Contract semantics builder avoids this by remapping its Tier group field to
// `tags` via `fieldName`; the workflow query builder cannot, because the Tags
// field already serializes to `{"var":"tags"}` and a `fieldName` alias on the Tier
// field hijacks that variable on import (a saved Tags rule would load into Tier
// and drop, since the Tags subfield's select operators are not offered on Tier).
//
// Instead the Tier group keeps its `tier` key (so Tags and Tier stay distinct on
// import) and these two passes rewrite the group variable across the export and
// import boundaries:
//   - on the way out, `{"var":"tier"}` becomes `{"var":"tags"}` so the rule the
//     server evaluates points at the real `tags` list;
//   - on the way in, a `tags`-grouped `contains`/`!contains` rule — the only
//     shape the Tier multiselect's `array_contains`/`array_not_contains`
//     operators can produce — is routed back to `tier` so it loads into the
//     Tier field and round-trips. Every other `{"var":"tags"}` rule is a Tags
//     rule and stays on `tags`.

const TIER_VAR = 'tier';
const TAGS_VAR = 'tags';

const isObject = (node: unknown): node is Record<string, unknown> =>
  typeof node === 'object' && node !== null && !Array.isArray(node);

const isVar = (node: unknown, name: string): boolean =>
  isObject(node) && Object.keys(node).length === 1 && node.var === name;

const isVarNamespaceContains = (node: unknown): boolean =>
  isObject(node) && Object.prototype.hasOwnProperty.call(node, 'contains');

// A condition the Tier multiselect can author: `array_contains` (`contains`) or
// `array_not_contains` (`{"!":{"contains":...}}`). The Tags select field never
// produces either, so this is the unambiguous marker of a Tier rule.
const isTierCondition = (condition: unknown): boolean => {
  if (isVarNamespaceContains(condition)) {
    return true;
  }

  const negation = isObject(condition) ? condition['!'] : undefined;

  return isVarNamespaceContains(negation);
};

// Export: rewrite the Tier group variable `tier` -> `tags` everywhere. Only the
// Tier group field ever emits `{"var":"tier"}` (its `tagFQN` subfield serializes as
// `{"var":"tagFQN"}`), so this touches nothing else.
export const rewriteTierVarToTags = (node: unknown): unknown => {
  if (Array.isArray(node)) {
    return node.map(rewriteTierVarToTags);
  }

  if (!isObject(node)) {
    return node;
  }

  if (isVar(node, TIER_VAR)) {
    return { var: TAGS_VAR };
  }

  const result: Record<string, unknown> = {};

  for (const key of Object.keys(node)) {
    result[key] = rewriteTierVarToTags(node[key]);
  }

  return result;
};

// Import: route a `some` over `tags` whose condition is Tier-only back to the
// `tier` variable so it loads into the Tier field; leave every other `tags`
// rule (and every non-`tags` group) untouched.
export const routeTagsGroupToTier = (node: unknown): unknown => {
  if (Array.isArray(node)) {
    return node.map(routeTagsGroupToTier);
  }

  if (!isObject(node)) {
    return node;
  }

  if (Object.prototype.hasOwnProperty.call(node, 'some')) {
    const args = node.some;

    if (
      Array.isArray(args) &&
      args.length === 2 &&
      isVar(args[0], TAGS_VAR) &&
      isTierCondition(args[1])
    ) {
      return { some: [{ var: TIER_VAR }, routeTagsGroupToTier(args[1])] };
    }

    return { some: routeTagsGroupToTier(args) };
  }

  const result: Record<string, unknown> = {};

  for (const key of Object.keys(node)) {
    result[key] = routeTagsGroupToTier(node[key]);
  }

  return result;
};
