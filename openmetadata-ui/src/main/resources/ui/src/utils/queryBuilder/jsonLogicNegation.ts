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
import type { JsonLogic } from '../QueryBuilderPureUtils';

// RAQB negates a `some`-mode group (Tags, Owners, Domains, ...) per element: "Tags Is Not X" comes out as
// `some(tags, tagFQN != X)`, which is "has a tag other than X" — false for an untagged asset, true for one tagged X
// and Y. What the label promises is "none of the tags is X", `!some(tags, tagFQN == X)`. The JSON Logic is rewritten
// to that shape on the way out, and back to RAQB's shape on the way in so the row still reads "Is Not".

type ConditionRewrite = (
  args: unknown,
  condition: JsonLogic
) => JsonLogic | undefined;

const CONJUNCTIONS = ['and', 'or'];

const isObject = (node: unknown): node is JsonLogic =>
  typeof node === 'object' && node !== null && !Array.isArray(node);

const singleEntry = (node: unknown): [string, unknown] | undefined => {
  const entries = isObject(node) ? Object.entries(node) : [];

  return entries.length === 1 ? entries[0] : undefined;
};

const asPair = (args: unknown): [unknown, unknown] | undefined =>
  Array.isArray(args) && args.length === 2
    ? (args as [unknown, unknown])
    : undefined;

const comparesTo = (
  args: unknown,
  againstNull: boolean
): [unknown, unknown] | undefined => {
  const pair = asPair(args);

  return pair && (pair[1] === null) === againstNull ? pair : undefined;
};

const withOperator = (
  operator: string,
  pair?: [unknown, unknown]
): JsonLogic | undefined => (pair ? { [operator]: pair } : undefined);

// Only negations `NEGATION_OF` can turn back into a row are lifted; any other (Related Terms "Not Contains" wraps a
// nested `some`) keeps RAQB's shape, or it would reload as a NOT around the positive row.
const REVERSIBLE_NEGATIONS = ['in', 'contains'];

// The positive condition each negated per-element condition denies.
const POSITIVE_OF: Record<string, ConditionRewrite> = {
  '!': (args) =>
    REVERSIBLE_NEGATIONS.includes(singleEntry(args)?.[0] ?? '')
      ? (args as JsonLogic)
      : undefined,
  '!=': (args) => withOperator('==', comparesTo(args, false)),
  // "Is Not Set": `some(field == null)` never matches an empty list, so it becomes "no element has the field set".
  '==': (args) => withOperator('!=', comparesTo(args, true)),
};

// Inverse of `POSITIVE_OF`, limited to the shapes it produces: `!some(field == null)` is not "Is Set", so a `==`
// against null is left alone.
const NEGATION_OF: Record<string, ConditionRewrite> = {
  '==': (args) => withOperator('!=', comparesTo(args, false)),
  '!=': (args) => withOperator('==', comparesTo(args, true)),
  ...Object.fromEntries(
    REVERSIBLE_NEGATIONS.map((operator) => [
      operator,
      (_: unknown, condition: JsonLogic) => ({ '!': condition }),
    ])
  ),
};

const rewriteCondition = (
  rewrites: Record<string, ConditionRewrite>,
  condition: unknown
): JsonLogic | undefined => {
  const [operator = '', args] = singleEntry(condition) ?? [];

  return Object.prototype.hasOwnProperty.call(rewrites, operator)
    ? rewrites[operator](args, condition as JsonLogic)
    : undefined;
};

// Rewrites the condition inside a `some`, or `undefined` when the node is not a `some` or its condition has no rewrite.
const rewriteSome = (
  rewrites: Record<string, ConditionRewrite>,
  node: unknown
): JsonLogic | undefined => {
  const [operator, args] = singleEntry(node) ?? [];
  const pair = operator === 'some' ? asPair(args) : undefined;
  const condition = pair && rewriteCondition(rewrites, pair[1]);

  return pair && condition ? { some: [pair[0], condition] } : undefined;
};

const mapConjunction = (
  node: JsonLogic,
  visit: (child: unknown) => unknown
): JsonLogic | undefined => {
  const [operator = '', args] = singleEntry(node) ?? [];

  return CONJUNCTIONS.includes(operator) && Array.isArray(args)
    ? { [operator]: args.map(visit) }
    : undefined;
};

export const toEngineJsonLogic = (node: unknown): unknown => {
  if (!isObject(node)) {
    return node;
  }

  const positiveSome = rewriteSome(POSITIVE_OF, node);

  // An explicit `!` is left as written: the editor offers no NOT, so one came through the API, and a per-element
  // condition under it was meant per element.
  return positiveSome
    ? { '!': positiveSome }
    : mapConjunction(node, toEngineJsonLogic) ?? node;
};

// `!and[x]` is how RAQB writes a negated single-rule group; it is only unwrapped when `x` can become an "Is Not" row,
// so any other negation keeps its group and stays visible as one.
const onlyChildOf = (node: unknown): unknown => {
  const [operator = '', args] = singleEntry(node) ?? [];
  const children =
    CONJUNCTIONS.includes(operator) && Array.isArray(args) ? args : [];

  return children.length === 1 ? children[0] : node;
};

export const fromEngineJsonLogic = (node: unknown): unknown => {
  if (!isObject(node)) {
    return node;
  }

  const [operator, args] = singleEntry(node) ?? [];

  // Inside any other `!` nothing is reversed, matching the save side, so a rule written through the API saves back
  // as it was stored.
  return operator === '!'
    ? rewriteSome(NEGATION_OF, onlyChildOf(args)) ?? node
    : mapConjunction(node, fromEngineJsonLogic) ?? node;
};
