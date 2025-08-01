/*
 *  Copyright 2023 Collate.
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
export interface ResizablePanelsProps {
  className?: string;
  orientation?: 'vertical' | 'horizontal';
  firstPanel: PanelProps;
  secondPanel: PanelProps;
  pageTitle?: string;
  hideSecondPanel?: boolean;
}

export interface ResizablePanelsLeftProps extends ResizablePanelsProps {
  hideFirstPanel?: boolean;
}

export interface PanelProps {
  children: React.ReactNode;
  minWidth: number;
  className?: string;
  cardClassName?: string;
  flex?: number;
  overlay?: Overlay;
  onStopResize?: (newFlex: number | undefined) => void;
  title?: string;
  wrapInCard?: boolean;
  allowScroll?: boolean;
}

export interface Overlay {
  displayThreshold: number;
  header: string;
  rotation?: 'clockwise' | 'counter-clockwise';
}

export interface PanelContainerProps {
  className?: string;
  dimensions?: {
    width: number;
    height: number;
  };
  overlay?: Overlay;
}
