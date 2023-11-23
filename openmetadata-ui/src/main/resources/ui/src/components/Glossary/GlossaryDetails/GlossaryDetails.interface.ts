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

import { Glossary } from '../../../generated/entity/data/glossary';
import { GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';
import { OperationPermission } from '../../PermissionProvider/PermissionProvider.interface';
import { VotingDataProps } from '../../Voting/voting.interface';

export enum GlossaryTabs {
  TERMS = 'terms',
  ACTIVITY_FEED = 'activity_feed',
}

export type GlossaryDetailsProps = {
  isVersionView?: boolean;
  permissions: OperationPermission;
  glossary: Glossary;
  glossaryTerms: GlossaryTerm[];
  termsLoading: boolean;
  updateGlossary: (value: Glossary) => Promise<void>;
  updateVote?: (data: VotingDataProps) => Promise<void>;
  handleGlossaryDelete: (id: string) => void;
  refreshGlossaryTerms: () => void;
  onAddGlossaryTerm: (glossaryTerm: GlossaryTerm | undefined) => void;
  onEditGlossaryTerm: (glossaryTerm: GlossaryTerm) => void;
  onThreadLinkSelect: (value: string) => void;
};
