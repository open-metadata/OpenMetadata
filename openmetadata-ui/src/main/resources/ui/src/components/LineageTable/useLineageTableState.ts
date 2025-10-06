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

import { useReducer } from 'react';
import { LineageDirection } from '../../generated/api/lineage/lineageDirection';
import { LineageNode } from '../Lineage/Lineage.interface';
import {
  EImpactLevel,
  LineagePagingInfo,
  LineageTableAction,
  LineageTableState,
} from './LineageTable.interface';

const initialState: LineageTableState = {
  filterNodes: [],
  loading: false,
  filterSelectionActive: false,
  searchValue: '',
  dialogVisible: false,
  impactLevel: EImpactLevel.TableLevel,
  upstreamColumnLineageNodes: [],
  downstreamColumnLineageNodes: [],
  lineageDirection: LineageDirection.Downstream,
  lineagePagingInfo: null,
  nodeDepth: 1,
};

function lineageTableReducer(
  state: LineageTableState,
  action: LineageTableAction
): LineageTableState {
  switch (action.type) {
    case 'SET_FILTER_NODES':
      return { ...state, filterNodes: action.payload };

    case 'SET_LOADING':
      return { ...state, loading: action.payload };

    case 'SET_FILTER_SELECTION_ACTIVE':
      return { ...state, filterSelectionActive: action.payload };

    case 'SET_SEARCH_VALUE':
      return { ...state, searchValue: action.payload };

    case 'SET_DIALOG_VISIBLE':
      return { ...state, dialogVisible: action.payload };

    case 'SET_IMPACT_LEVEL':
      return { ...state, impactLevel: action.payload };

    case 'SET_UPSTREAM_COLUMN_LINEAGE_NODES':
      return { ...state, upstreamColumnLineageNodes: action.payload };

    case 'SET_DOWNSTREAM_COLUMN_LINEAGE_NODES':
      return { ...state, downstreamColumnLineageNodes: action.payload };

    case 'SET_COLUMN_LINEAGE_NODES':
      return {
        ...state,
        upstreamColumnLineageNodes: action.payload.upstream,
        downstreamColumnLineageNodes: action.payload.downstream,
      };

    case 'SET_LINEAGE_DIRECTION':
      return { ...state, lineageDirection: action.payload };

    case 'RESET_FILTERS':
      return {
        ...state,
        searchValue: '',
        filterNodes: [],
        filterSelectionActive: false,
      };

    case 'TOGGLE_FILTER_SELECTION':
      return { ...state, filterSelectionActive: !state.filterSelectionActive };

    case 'SET_LINEAGE_PAGING_INFO':
      return { ...state, lineagePagingInfo: action.payload };

    case 'UPDATE_NODE_DEPTH':
      return { ...state, nodeDepth: action.payload };

    default:
      return state;
  }
}

export function useLineageTableState() {
  const [state, dispatch] = useReducer(lineageTableReducer, initialState);

  const setFilterNodes = (nodes: LineageNode[]) => {
    dispatch({ type: 'SET_FILTER_NODES', payload: nodes });
  };

  const setLoading = (loading: boolean) => {
    dispatch({ type: 'SET_LOADING', payload: loading });
  };

  const setFilterSelectionActive = (active: boolean) => {
    dispatch({ type: 'SET_FILTER_SELECTION_ACTIVE', payload: active });
  };

  const toggleFilterSelection = () => {
    dispatch({ type: 'TOGGLE_FILTER_SELECTION' });
  };

  const setSearchValue = (value: string) => {
    dispatch({ type: 'SET_SEARCH_VALUE', payload: value });
  };

  const setDialogVisible = (visible: boolean) => {
    dispatch({ type: 'SET_DIALOG_VISIBLE', payload: visible });
  };

  const setImpactLevel = (level: EImpactLevel) => {
    // Need to show loader when impact level changes
    // as it show blank table in between
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_IMPACT_LEVEL', payload: level });
    setTimeout(() => {
      dispatch({ type: 'SET_LOADING', payload: false });
    }, 0);
  };

  const setUpstreamColumnLineageNodes = (nodes: LineageNode[]) => {
    dispatch({ type: 'SET_UPSTREAM_COLUMN_LINEAGE_NODES', payload: nodes });
  };

  const setDownstreamColumnLineageNodes = (nodes: LineageNode[]) => {
    dispatch({ type: 'SET_DOWNSTREAM_COLUMN_LINEAGE_NODES', payload: nodes });
  };

  const setColumnLineageNodes = (
    upstream: LineageNode[],
    downstream: LineageNode[]
  ) => {
    dispatch({
      type: 'SET_COLUMN_LINEAGE_NODES',
      payload: { upstream, downstream },
    });
  };

  const setLineageDirection = (direction: LineageDirection) => {
    dispatch({ type: 'SET_LINEAGE_DIRECTION', payload: direction });
  };

  const resetFilters = () => {
    dispatch({ type: 'RESET_FILTERS' });
  };

  const setLineagePagingInfo = (info: LineagePagingInfo | null) => {
    dispatch({ type: 'SET_LINEAGE_PAGING_INFO', payload: info });
  };

  const setNodeDepth = (depth: number) => {
    dispatch({ type: 'UPDATE_NODE_DEPTH', payload: depth });
  };

  return {
    // State values
    ...state,

    // Action dispatchers
    setFilterNodes,
    setLoading,
    setFilterSelectionActive,
    toggleFilterSelection,
    setSearchValue,
    setDialogVisible,
    setImpactLevel,
    setUpstreamColumnLineageNodes,
    setDownstreamColumnLineageNodes,
    setColumnLineageNodes,
    setLineageDirection,
    setLineagePagingInfo,
    setNodeDepth,
    resetFilters,
  };
}
