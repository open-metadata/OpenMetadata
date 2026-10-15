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

import { useId, useState } from 'react';

interface RuleKeys {
  ids: number[];
  nextId: number;
}

const resizeRuleKeys = ({ ids, nextId }: RuleKeys, count: number): RuleKeys => {
  if (ids.length >= count) {
    return { ids: ids.slice(0, count), nextId };
  }
  const added = count - ids.length;

  return {
    ids: [...ids, ...Array.from({ length: added }, (_, i) => nextId + i)],
    nextId: nextId + added,
  };
};

/**
 * Stable React keys for a list of rules that has no ids of its own. Keys are
 * resized during render (not in an effect) so a newly added row commits with
 * its final key once, instead of mounting under a fallback key and remounting.
 */
export const useAlertRuleKeys = (count: number) => {
  const prefix = useId();
  const [state, setState] = useState(() =>
    resizeRuleKeys({ ids: [], nextId: 0 }, count)
  );
  if (state.ids.length !== count) {
    setState(resizeRuleKeys(state, count));
  }

  return {
    keys: state.ids.map((id) => prefix + '-' + id),
    removeKey: (index: number) =>
      setState((current) => ({
        ...current,
        ids: current.ids.filter((_, position) => position !== index),
      })),
  };
};
