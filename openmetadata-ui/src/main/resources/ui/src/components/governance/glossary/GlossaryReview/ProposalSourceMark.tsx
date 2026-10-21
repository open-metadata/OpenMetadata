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
import { AskCollateSparkle } from '@openmetadata/ui-core-components/icons';
import { useTranslation } from 'react-i18next';
import { ProposalSource } from '../../../../utils/GlossaryReview/GlossaryReview.types';

export interface ProposalSourceMarkProps {
  source: ProposalSource;
}

/** The sparkle of an AI agent's proposal, or the dot of a person's. */
const ProposalSourceMark = ({ source }: ProposalSourceMarkProps) => {
  const { t } = useTranslation();

  return source === 'ai' ? (
    <span
      aria-label={t('label.proposed-by-ai-agent')}
      className="tw:inline-flex tw:shrink-0 tw:text-utility-purple-600"
      data-testid="proposal-source-ai"
      role="img">
      <AskCollateSparkle aria-hidden className="tw:size-3.5" />
    </span>
  ) : (
    <span
      aria-label={t('label.proposed-by-a-person')}
      className="tw:inline-flex tw:size-3.5 tw:shrink-0 tw:items-center tw:justify-center"
      data-testid="proposal-source-person"
      role="img">
      <span className="tw:size-2 tw:rounded-full tw:bg-utility-warning-500" />
    </span>
  );
};

export default ProposalSourceMark;
