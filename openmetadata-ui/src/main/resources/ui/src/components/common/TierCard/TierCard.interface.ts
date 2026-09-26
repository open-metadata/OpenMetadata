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
import { ReactNode } from 'react';
import { Tag } from '../../../generated/entity/classification/tag';

export type CardWithListItems = {
  id: string;
  description: string;
  data: string;
  title: string;
  style: Tag['style'];
};

export interface TierCardProps {
  currentTier?: string;
  tierCardClassName?: string;
  footerActionButtonsClassName?: string;
  updateTier?: (value?: Tag) => Promise<void>;
  /**
   * Uncontrolled (no `open`): a react-aria pressable trigger (core Button,
   * ButtonUtility, or `Pressable`), wired up by PopoverTrigger.
   * Controlled: only the anchor the card is positioned against; the caller
   * owns whatever opens it.
   */
  children?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
}
