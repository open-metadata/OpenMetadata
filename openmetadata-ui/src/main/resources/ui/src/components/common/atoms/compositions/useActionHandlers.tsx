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

import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ActionHandlers } from '../shared/types';

interface UseActionHandlersProps<T> {
  basePath?: string;
  getEntityPath?: (entity: T) => string;
  addPath?: string;
  onCustomEntityClick?: (entity: T) => void;
  onCustomAddClick?: () => void;
  onCustomDeleteClick?: (entities: T[]) => void;
  onCustomEditClick?: (entity: T) => void;
}

export const useActionHandlers = <
  T extends { name?: string; fullyQualifiedName?: string }
>(
  props: UseActionHandlersProps<T>
): ActionHandlers<T> => {
  const navigate = useNavigate();
  const {
    basePath = '',
    getEntityPath,
    addPath,
    onCustomEntityClick,
    onCustomAddClick,
    onCustomDeleteClick,
    onCustomEditClick,
  } = props;

  const onEntityClick = useCallback(
    (entity: T) => {
      if (onCustomEntityClick) {
        onCustomEntityClick(entity);

        return;
      }

      if (getEntityPath) {
        const path = getEntityPath(entity);
        navigate(path);

        return;
      }

      if (basePath) {
        const fqn = entity.fullyQualifiedName || entity.name || '';
        const encodedFQN = encodeURIComponent(fqn);
        navigate(`${basePath}/${encodedFQN}`);
      }
    },
    [navigate, basePath, getEntityPath, onCustomEntityClick]
  );

  const onAddClick = useCallback(() => {
    if (onCustomAddClick) {
      onCustomAddClick();

      return;
    }

    if (addPath) {
      navigate(addPath);
    } else if (basePath) {
      navigate(`${basePath}/add`);
    }
  }, [navigate, basePath, addPath, onCustomAddClick]);

  const onDeleteClick = useCallback(
    (entities: T[]) => {
      if (onCustomDeleteClick) {
        onCustomDeleteClick(entities);
      }
    },
    [onCustomDeleteClick]
  );

  const onEditClick = useCallback(
    (entity: T) => {
      if (onCustomEditClick) {
        onCustomEditClick(entity);
      }
    },
    [onCustomEditClick]
  );

  return {
    onEntityClick,
    onAddClick,
    onDeleteClick,
    onEditClick,
  };
};
