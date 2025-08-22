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

import { LoadingState } from 'Models';
import { createContext, ReactNode, useMemo } from 'react';
import { Edge } from 'reactflow';
import { SourceType } from '../../../components/SearchedData/SearchedData.interface';
import { LineageLayer } from '../../../generated/settings/settings';
import { LineageUIContextType } from '../LineageProviderV1.interface';

export const LineageUIContext = createContext<LineageUIContextType>({
  isDrawerOpen: false,
  isEditMode: false,
  selectedNode: {} as SourceType,
  selectedColumn: '',
  selectedEdge: undefined,
  activeLayer: [],
  loading: false,
  init: false,
  status: 'initial',
});

interface LineageUIProviderProps {
  children: ReactNode;
  isDrawerOpen: boolean;
  isEditMode: boolean;
  selectedNode: SourceType;
  selectedColumn: string;
  selectedEdge?: Edge;
  activeLayer: LineageLayer[];
  loading: boolean;
  init: boolean;
  status: LoadingState;
}

export const LineageUIProvider = ({
  children,
  isDrawerOpen,
  isEditMode,
  selectedNode,
  selectedColumn,
  selectedEdge,
  activeLayer,
  loading,
  init,
  status,
}: LineageUIProviderProps) => {
  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(
    () => ({
      isDrawerOpen,
      isEditMode,
      selectedNode,
      selectedColumn,
      selectedEdge,
      activeLayer,
      loading,
      init,
      status,
    }),
    [
      isDrawerOpen,
      isEditMode,
      selectedNode,
      selectedColumn,
      selectedEdge,
      activeLayer,
      loading,
      init,
      status,
    ]
  );

  return (
    <LineageUIContext.Provider value={value}>
      {children}
    </LineageUIContext.Provider>
  );
};
