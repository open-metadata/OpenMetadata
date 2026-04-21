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
import {
  CENTER_PANEL_DEFAULT_WIDTH,
  CENTER_PANEL_PADDING_HORIZONTAL,
  CENTER_PANEL_PADDING_VERTICAL,
  CENTER_PANEL_PANEL_MARGIN,
} from 'constants/KnowledgeCenter.constant';
import { CSSProperties, ReactNode, useMemo } from 'react';

interface SizeAwareElementProps {
  isLeftPanelCollapsed: boolean;
  isRightPanelCollapsed: boolean;
  children: ReactNode;
  dimensions?: { width: number; height: number };
}

export const SizeAwareElement = ({
  children,
  isLeftPanelCollapsed,
  isRightPanelCollapsed,
  dimensions,
}: SizeAwareElementProps) => {
  const maxWidth = useMemo(() => {
    let width = CENTER_PANEL_DEFAULT_WIDTH;

    if (isLeftPanelCollapsed && isRightPanelCollapsed) {
      width = CENTER_PANEL_DEFAULT_WIDTH + 100;
    } else if (isLeftPanelCollapsed || isRightPanelCollapsed) {
      width = CENTER_PANEL_DEFAULT_WIDTH + 20;
    } else {
      width =
        (dimensions?.width || CENTER_PANEL_DEFAULT_WIDTH) -
        CENTER_PANEL_PANEL_MARGIN;
    }

    return width;
  }, [dimensions, isLeftPanelCollapsed, isRightPanelCollapsed]);

  const style: CSSProperties = {
    maxWidth: `${maxWidth}px`,
    margin: '0 auto',
    padding: `${CENTER_PANEL_PADDING_VERTICAL} ${CENTER_PANEL_PADDING_HORIZONTAL}`,
    height: '100%',
  };

  return <div style={style}>{children}</div>;
};
