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
import {
  useWorkflowMode,
  UseWorkflowModeReturn,
} from '../hooks/useWorkflowMode';

interface WorkflowModeContextProps {
  children: ReactNode;
  workflowFqn?: string;
  workflowDefinition?: any;
}

const WorkflowModeContext = createContext<UseWorkflowModeReturn | undefined>(
  undefined
);

export const WorkflowModeProvider: React.FC<WorkflowModeContextProps> = ({
  children,
  workflowFqn,
  workflowDefinition,
}) => {
  const modeState = useWorkflowMode(workflowFqn, workflowDefinition);

  return (
    <WorkflowModeContext.Provider value={modeState}>
      {children}
    </WorkflowModeContext.Provider>
  );
};

export const useWorkflowModeContext = (): UseWorkflowModeReturn => {
  const context = useContext(WorkflowModeContext);

  if (context === undefined) {
    throw new Error(
      'useWorkflowModeContext must be used within a WorkflowModeProvider'
    );
  }

  return context;
};
