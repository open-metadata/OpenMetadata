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

import { useCallback, useState } from 'react';
import { Edge, Node } from 'reactflow';

interface WorkflowState {
  nodes: Node[];
  edges: Edge[];
  timestamp: number;
  action: string;
}

interface UseWorkflowHistoryProps {
  maxHistorySize?: number;
}

export const useWorkflowHistory = ({
  maxHistorySize = 50,
}: UseWorkflowHistoryProps = {}) => {
  const [history, setHistory] = useState<WorkflowState[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);

  const saveState = useCallback(
    (nodes: Node[], edges: Edge[], action = 'Unknown Action') => {
      const newState: WorkflowState = {
        nodes: JSON.parse(JSON.stringify(nodes)),
        edges: JSON.parse(JSON.stringify(edges)),
        timestamp: Date.now(),
        action,
      };

      setHistory((prevHistory) => {
        const truncatedHistory = prevHistory.slice(0, currentIndex + 1);
        const newHistory = [...truncatedHistory, newState];

        if (newHistory.length > maxHistorySize) {
          return newHistory.slice(-maxHistorySize);
        }

        return newHistory;
      });

      setCurrentIndex((prevIndex) => {
        const newIndex = Math.min(prevIndex + 1, maxHistorySize - 1);

        return newIndex;
      });
    },
    [currentIndex, maxHistorySize]
  );

  const undo = useCallback((): WorkflowState | null => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      setCurrentIndex(newIndex);

      return history[newIndex];
    }

    return null;
  }, [currentIndex, history]);

  const redo = useCallback((): WorkflowState | null => {
    if (currentIndex < history.length - 1) {
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);

      return history[newIndex];
    }

    return null;
  }, [currentIndex, history]);

  const canUndo = currentIndex > 0;
  const canRedo = currentIndex < history.length - 1;

  const clearHistory = useCallback(() => {
    setHistory([]);
    setCurrentIndex(-1);
  }, []);

  const getHistoryInfo = useCallback(() => {
    return {
      totalStates: history.length,
      currentIndex,
      canUndo,
      canRedo,
      currentAction: history[currentIndex]?.action || 'No action',
    };
  }, [history, currentIndex, canUndo, canRedo]);

  return {
    saveState,
    undo,
    redo,
    canUndo,
    canRedo,
    clearHistory,
    getHistoryInfo,
  };
};
