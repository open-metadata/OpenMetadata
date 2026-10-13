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
import { ReactNode } from 'react';

export interface VersionHistoryItem {
  /** Display form, e.g. `1.2`. Also keys the row and its test ids. */
  version: string;
  isCurrent: boolean;
  updatedBy?: string;
  updatedAt?: number;
  /** What changed in this version. */
  summary?: ReactNode;
}

export interface VersionHistorySlideoutProps<T extends VersionHistoryItem> {
  isOpen: boolean;
  isLoading: boolean;
  entries: T[];
  subtitle?: ReactNode;
  emptyMessage: ReactNode;
  testId: string;
  /** A per-version control beside its label, e.g. restore. */
  renderAction?: (entry: T) => ReactNode;
  onClose: () => void;
}

export interface VersionBadgeButtonProps {
  version: string;
  testId: string;
  onPress: () => void;
}
