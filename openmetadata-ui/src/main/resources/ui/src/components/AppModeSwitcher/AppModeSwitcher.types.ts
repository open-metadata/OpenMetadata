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

import { RefObject } from 'react';

export type AppModeSwitcherVariant = 'inline' | 'pill' | 'card' | 'icon';

export interface AppModeSwitcherProps {
  className?: string;
  cardRef?: RefObject<HTMLElement>;
  classicHref?: string;
  aiHref?: string;
  variant?: AppModeSwitcherVariant;
}

export interface AppModeSwitcherTriggerProps {
  variant: AppModeSwitcherVariant;
  isOpen: boolean;
  isAiMode: boolean;
  aiLabel: string;
  modeLabel: string;
  modeLabelSentence: string;
  triggerRef: RefObject<HTMLButtonElement>;
  onClick: () => void;
}

export interface AppModeSwitcherTriggerStyle {
  root: string;
  label?: string;
  iconSize: number;
  chevron?: 'up' | 'right';
  frame?: string;
}
