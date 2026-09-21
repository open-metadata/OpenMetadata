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

import { RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import {
  EntityStatus,
  GlossaryTerm,
} from '../../../generated/entity/data/glossaryTerm';
import { TagLabel } from '../../../generated/type/tagLabel';
import { ModifiedGlossary } from '../useGlossary.store';

export interface GlossaryTermTabProps {
  isGlossary: boolean;
  className?: string;
}

export interface GlossaryTermMoveConfirmationModalProps {
  isModalOpen: boolean;
  isTableLoading: boolean;
  hasReviewers: boolean;
  confirmCheckboxChecked: boolean;
  onConfirmCheckboxChange: (checked: boolean) => void;
  movedGlossaryTerm?: MoveGlossaryTermType;
  activeGlossary?: ModifiedGlossary;
  onDragConfirmationModalClose: () => void;
  onChangeGlossaryTerm: () => void;
  t: ReturnType<typeof useTranslation>['t'];
}

export interface GlossaryTermEmptyPlaceholderProps {
  canCreate: boolean;
  isGlossary: boolean;
  glossaryTermStatus: EntityStatus | null;
  containerRef: RefObject<HTMLDivElement>;
  onAddGlossaryTermClick: () => void;
  t: ReturnType<typeof useTranslation>['t'];
}

export type ModifiedGlossaryTerm = Omit<GlossaryTerm, 'children'> & {
  children?: ModifiedGlossaryTerm[];
  value?: string;
  data?: TagLabel;
  hasMoreChildren?: boolean;
  childrenPagingAfter?: string;
  isLoadMoreButton?: boolean;
  parentRecord?: ModifiedGlossaryTerm;
  level?: number;
};

export type MoveGlossaryTermType = {
  from: GlossaryTerm;
  to?: GlossaryTerm;
};
