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

export interface TierCardProps {
  currentTier?: string;
  updateTier?: (value?: Tag) => void | Promise<void>;
  /** The element the picker opens from, e.g. an edit button. */
  children?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Called when the picker is dismissed without a pick or clear. */
  onClose?: () => void;
  /** Classes for the trigger, e.g. to fill a grid cell. */
  className?: string;
}
