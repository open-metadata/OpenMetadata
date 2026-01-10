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

/**
 * Fallback method for copying text to clipboard using document.execCommand
 * This works in older browsers and doesn't require HTTPS
 */
const fallbackCopyTextToClipboard = (text: string): boolean => {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.opacity = '0';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);

    return successful;
  } catch {
    document.body.removeChild(textArea);

    return false;
  }
};

/**
 * Custom hook to copy entity link to clipboard
 * @param entityType - The type of entity (e.g., TABLE, TOPIC, CONTAINER)
 * @param timeout - Time in ms before clearing the copied state (default: 2000ms)
 * @returns Object with copyEntityLink function and copiedFqn state
 */
export const useCopyEntityLink = (entityType: EntityType, timeout = 2000) => {
  const [copiedFqn, setCopiedFqn] = useState<string>();

  useEffect(() => {
    if (!copiedFqn) {
      return;
    }

    const timer = setTimeout(() => setCopiedFqn(undefined), timeout);

    return () => clearTimeout(timer);
  }, [copiedFqn, timeout]);

  const getEntityLink = useCallback(
    (fqn: string) => {
      const entityPath = getEntityDetailsPath(entityType, fqn);

      return `${window.location.origin}${entityPath}`;
    },
    [entityType]
  );

  const copyEntityLink = useCallback(
    async (fqn: string) => {
      const link = getEntityLink(fqn);

      try {
        await navigator.clipboard.writeText(link);
        setCopiedFqn(fqn);

        return true;
      } catch {
        try {
          const success = fallbackCopyTextToClipboard(link);
          if (success) {
            setCopiedFqn(fqn);
          }

          return success;
        } catch {
          return false;
        }
      }
    },
    [getEntityLink]
  );

  return { copyEntityLink, copiedFqn, getEntityLink };
};
