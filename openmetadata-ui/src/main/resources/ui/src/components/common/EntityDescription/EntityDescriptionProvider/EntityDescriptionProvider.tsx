/*
 *  Copyright 2025 Collate.
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
import React, { createContext, ReactNode, useContext } from 'react';
import { EntityType } from '../../../../enums/entity.enum';

export interface EntityDescriptionContextType {
  entityType: EntityType;
  entityFqn?: string;
}

export interface EntityDescriptionProviderProps
  extends EntityDescriptionContextType {
  children: ReactNode;
}

export const EntityDescriptionContext =
  createContext<EntityDescriptionContextType>(
    {} as EntityDescriptionContextType
  );

export const EntityDescriptionProvider = ({
  children,
  entityType,
  entityFqn,
}: EntityDescriptionProviderProps) => {
  const value: EntityDescriptionContextType = {
    entityType,
    entityFqn,
  };

  return (
    <EntityDescriptionContext.Provider value={value}>
      {children}
    </EntityDescriptionContext.Provider>
  );
};

export const useEntityDescription = () => useContext(EntityDescriptionContext);
