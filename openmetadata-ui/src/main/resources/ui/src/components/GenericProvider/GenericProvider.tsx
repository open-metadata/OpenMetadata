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
import { once } from 'lodash';
import React, { useContext, useMemo } from 'react';
import { OperationPermission } from '../../context/PermissionProvider/PermissionProvider.interface';
import { EntityType } from '../../enums/entity.enum';

interface GenericProviderProps<T> {
  children?: React.ReactNode;
  data: T;
  type: EntityType;
  onUpdate: (updatedData: T) => Promise<void>;
  isVersionView?: boolean;
  permissions: OperationPermission;
  currentVersionData?: T;
}

interface GenericContextType<T> {
  data: T;
  type: EntityType;
  onUpdate: (updatedData: T) => Promise<void>;
  isVersionView?: boolean;
  permissions: OperationPermission;
  currentVersionData?: T;
}

const createGenericContext = once(<T,>() =>
  React.createContext({} as GenericContextType<T>)
);

export const GenericProvider = <T,>({
  children,
  data,
  type,
  onUpdate,
  isVersionView,
  permissions,
  currentVersionData,
}: GenericProviderProps<T>) => {
  const GenericContext = createGenericContext<T>();

  const values = useMemo(
    () => ({
      data,
      type,
      onUpdate,
      isVersionView,
      permissions,
      currentVersionData,
    }),
    [data, type, onUpdate, isVersionView, permissions, currentVersionData]
  );

  return (
    <GenericContext.Provider value={values}>{children}</GenericContext.Provider>
  );
};

export const useGenericContext = <T,>() =>
  useContext(createGenericContext<T>());
