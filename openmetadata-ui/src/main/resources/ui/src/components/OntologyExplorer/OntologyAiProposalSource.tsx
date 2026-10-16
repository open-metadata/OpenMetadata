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

import { Typography } from '@openmetadata/ui-core-components';
import {
  AskCollateSparkle,
  CpuChip02,
} from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { getShortRelativeTime } from '../../utils/date-time/DateTimeUtils';
import {
  isAskCollateProposal,
  OntologyProposal,
} from './utils/ontologyProposals';

interface OntologyAiProposalSourceProps {
  readonly item: OntologyProposal;
  readonly isEmphasized?: boolean;
}

/** Who proposed an item: Ask Collate, or the agent that wrote the draft. */
const OntologyAiProposalSource = ({
  item,
  isEmphasized = false,
}: OntologyAiProposalSourceProps) => {
  const { t } = useTranslation();
  const isAskCollate = isAskCollateProposal(item);
  const Icon = isAskCollate ? AskCollateSparkle : CpuChip02;
  const name = isAskCollate
    ? t('label.ask-collate')
    : item.changeSet.updatedBy ?? t('label.agent');
  const when = getShortRelativeTime(item.changeSet.updatedAt);

  return (
    <span className="tw:flex tw:min-w-0 tw:items-center tw:gap-1.5">
      <Icon
        aria-hidden
        className={classNames(
          'tw:shrink-0 tw:text-utility-purple-500',
          isEmphasized ? 'tw:size-4' : 'tw:size-3.5'
        )}
      />
      <Typography
        ellipsis
        as="span"
        className={
          isEmphasized ? 'tw:text-utility-purple-700' : 'tw:text-tertiary'
        }
        size={isEmphasized ? 'text-sm' : 'text-xs'}
        weight={isEmphasized ? 'medium' : 'regular'}>
        {when ? `${name} · ${when}` : name}
      </Typography>
    </span>
  );
};

export default OntologyAiProposalSource;
