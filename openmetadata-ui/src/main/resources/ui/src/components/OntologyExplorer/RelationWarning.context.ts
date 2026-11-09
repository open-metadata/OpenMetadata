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
import { createContext, useContext, useEffect, useState } from 'react';

/** Asks the server whether writing `fromId typeId toId` would clash, resolving to its message. */
export type RelationWarningCheck = (
  fromId: string,
  toId: string,
  typeId: string
) => Promise<string | undefined>;

export const RelationWarningContext = createContext<
  RelationWarningCheck | undefined
>(undefined);

export const useRelationWarning = () => useContext(RelationWarningContext);

/** The clash message for the chosen relation, once the server has answered; undefined while unknown. */
export const useRelationClash = (
  fromId: string,
  toId: string,
  typeId: string
) => {
  const warn = useRelationWarning();
  const [clash, setClash] = useState<{ key: string; message?: string }>();
  const key = `${fromId}|${toId}|${typeId}`;

  useEffect(() => {
    if (!warn || !toId || !typeId) {
      return undefined;
    }
    let active = true;
    void warn(fromId, toId, typeId).then((message) => {
      if (active) {
        setClash({ key, message });
      }
    });

    return () => {
      active = false;
    };
  }, [warn, fromId, toId, typeId, key]);

  return clash?.key === key ? clash.message : undefined;
};
