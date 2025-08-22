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

import { createContext, ReactNode, useMemo } from 'react';
import { ReactFlowInstance } from 'reactflow';
import { ZOOM_VALUE } from '../../../constants/Lineage.constants';
import {
  LineagePlatformView,
  LineageViewContextType,
} from '../LineageProviderV1.interface';

export const LineageViewContext = createContext<LineageViewContextType>({
  zoomValue: ZOOM_VALUE,
  platformView: LineagePlatformView.None,
  expandAllColumns: false,
  isPlatformLineage: false,
  entityFqn: '',
  reactFlowInstance: undefined,
});

interface LineageViewProviderProps {
  children: ReactNode;
  zoomValue: number;
  platformView: LineagePlatformView;
  expandAllColumns: boolean;
  isPlatformLineage: boolean;
  entityFqn: string;
  reactFlowInstance?: ReactFlowInstance;
}

export const LineageViewProvider = ({
  children,
  zoomValue,
  platformView,
  expandAllColumns,
  isPlatformLineage,
  entityFqn,
  reactFlowInstance,
}: LineageViewProviderProps) => {
  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(
    () => ({
      zoomValue,
      platformView,
      expandAllColumns,
      isPlatformLineage,
      entityFqn,
      reactFlowInstance,
    }),
    [
      zoomValue,
      platformView,
      expandAllColumns,
      isPlatformLineage,
      entityFqn,
      reactFlowInstance,
    ]
  );

  return (
    <LineageViewContext.Provider value={value}>
      {children}
    </LineageViewContext.Provider>
  );
};
