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

import { useEffect, useId, useRef, useState } from 'react';

export const useAlertRuleKeys = (count: number) => {
  const prefix = useId();
  const nextId = useRef(count);
  const [keys, setKeys] = useState(() =>
    Array.from({ length: count }, (_, index) => prefix + '-' + index)
  );
  useEffect(() => {
    setKeys((current) => {
      if (current.length === count) {
        return current;
      }
      if (current.length > count) {
        return current.slice(0, count);
      }

      return [
        ...current,
        ...Array.from(
          { length: count - current.length },
          () => prefix + '-' + nextId.current++
        ),
      ];
    });
  }, [count, prefix]);

  return {
    keys,
    removeKey: (index: number) =>
      setKeys((current) => current.filter((_, position) => position !== index)),
  };
};
