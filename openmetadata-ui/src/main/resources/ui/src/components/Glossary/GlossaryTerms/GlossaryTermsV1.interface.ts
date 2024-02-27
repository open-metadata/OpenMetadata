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
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';
import { VotingDataProps } from '../../Entity/Voting/voting.interface';
import { EntityDetailsObjectInterface } from '../../Explore/ExplorePage.interface';

export interface GlossaryTermsV1Props {
  isVersionView?: boolean;
  permissions: OperationPermission;
  glossaryTerm: GlossaryTerm;
  childGlossaryTerms: GlossaryTerm[];
  handleGlossaryTermUpdate: (data: GlossaryTerm) => Promise<void>;
  handleGlossaryTermDelete: (id: string) => Promise<void>;
  refreshGlossaryTerms: () => void;
  onAssetClick?: (asset?: EntityDetailsObjectInterface) => void;
  isSummaryPanelOpen: boolean;
  termsLoading: boolean;
  onAddGlossaryTerm: (glossaryTerm: GlossaryTerm | undefined) => void;
  onEditGlossaryTerm: (glossaryTerm: GlossaryTerm) => void;
  updateVote?: (data: VotingDataProps) => Promise<void>;
  refreshActiveGlossaryTerm?: () => void;
  onThreadLinkSelect: (value: string) => void;
}
