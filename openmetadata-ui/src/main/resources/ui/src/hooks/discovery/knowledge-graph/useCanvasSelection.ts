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

import { MutableRefObject, useCallback, useRef, useState } from 'react';
import { GraphSelection } from './KnowledgeGraphCanvas.utils';

interface UseCanvasSelectionResult {
  hover: GraphSelection;
  hoverRef: MutableRefObject<GraphSelection>;
  setHover: (selection: GraphSelection) => void;
  clearHover: () => void;
}

/**
 * Owns the hover selection ref + state used by the canvas hook. Kept in a
 * dedicated file so the parent hook only wires it together.
 */
export const useCanvasSelection = (): UseCanvasSelectionResult => {
  const hoverRef = useRef<GraphSelection>(null);
  const [hover, setHoverState] = useState<GraphSelection>(null);

  const setHover = useCallback((selection: GraphSelection) => {
    hoverRef.current = selection;
    setHoverState(selection);
  }, []);

  const clearHover = useCallback(() => {
    hoverRef.current = null;
    setHoverState(null);
  }, []);

  return { hover, hoverRef, setHover, clearHover };
};
