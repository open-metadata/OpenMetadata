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
import { useCallback, useEffect, useState } from 'react';
import { EntityType } from '../enums/entity.enum';
import { getEntityDetailsPath } from '../utils/RouterUtils';
import { useClipboard } from './useClipBoard';

export const useCopyEntityLink = (
  entityType: EntityType,
  _entityFqn?: string,
  timeout = 2000
) => {
  const [copiedFqn, setCopiedFqn] = useState<string>();
  const { onCopyToClipBoard } = useClipboard('');

  useEffect(() => {
    if (!copiedFqn) {
      return;
    }

    const timer = setTimeout(() => setCopiedFqn(undefined), timeout);

    return () => clearTimeout(timer);
  }, [copiedFqn, timeout]);

  const getEntityLink = useCallback(
    (fieldFqn: string) => {
      if (!fieldFqn) {
        return '';
      }

      const baseUrl = window.location.origin;
      const path = getEntityDetailsPath(entityType, fieldFqn);

      return `${baseUrl}${path}`;
    },
    [entityType]
  );

  const copyEntityLink = useCallback(
    async (fqn: string) => {
      const link = getEntityLink(fqn);

      if (!link) {
        return false;
      }

      try {
        await onCopyToClipBoard(link);
        setCopiedFqn(fqn);

        return true;
      } catch {
        return false;
      }
    },
    [getEntityLink, onCopyToClipBoard]
  );

  return { copyEntityLink, copiedFqn, getEntityLink };
};
