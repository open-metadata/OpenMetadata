/*
 *  Copyright 2026 Collate.
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

import { createContext, ReactNode, useContext } from 'react';

/**
 * Signals that the current subtree is rendered inside Collate's AI mode.
 * Defaults to false, so classic OpenMetadata renders original headers.
 * Collate's AI shell mounts <AiModeProvider> to flip this to true, which lets
 * shared pages render the AI-mode (gradient HeaderShell) header variant.
 */
const AiModeContext = createContext<boolean>(false);

export const AiModeProvider = ({ children }: { children: ReactNode }) => (
  <AiModeContext.Provider value>{children}</AiModeContext.Provider>
);

export const useIsAiMode = (): boolean => useContext(AiModeContext);
