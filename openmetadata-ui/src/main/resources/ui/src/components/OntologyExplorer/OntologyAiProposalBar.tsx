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

import {
  Button,
  ButtonUtility,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  AskCollateSparkle,
  XClose,
} from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';

interface OntologyAiProposalBarProps {
  readonly relationshipCount: number;
  readonly termCount: number;
  readonly onClose: () => void;
  readonly onView: () => void;
}

const OntologyAiProposalBar = ({
  relationshipCount,
  termCount,
  onClose,
  onView,
}: OntologyAiProposalBarProps) => {
  const { t } = useTranslation();
  const summary =
    termCount > 0
      ? [
          relationshipCount > 0
            ? t('label.count-relationship', { count: relationshipCount })
            : '',
          t('message.count-new-term-proposed', { count: termCount }),
        ]
          .filter(Boolean)
          .join(' · ')
      : t('message.count-relationship-proposed', { count: relationshipCount });

  return (
    <div
      className={classNames(
        'tw:absolute tw:bottom-4 tw:left-1/2 tw:z-2 tw:flex tw:h-11 tw:max-w-[calc(100%-204px)] tw:-translate-x-1/2 tw:items-center tw:gap-2',
        'tw:rounded-full tw:border tw:border-utility-purple-200 tw:bg-surface tw:pr-1.5 tw:pl-3.5 tw:whitespace-nowrap tw:shadow-lg'
      )}
      data-testid="ontology-ai-proposal-bar">
      <AskCollateSparkle aria-hidden className="tw:size-4 tw:shrink-0" />
      <Typography
        ellipsis
        as="span"
        className="tw:mr-1 tw:text-secondary"
        size="text-sm"
        weight="medium">
        {summary}
      </Typography>
      <Button
        className="tw:rounded-full tw:border tw:border-utility-purple-200 tw:bg-utility-purple-50 tw:text-utility-purple-700"
        color="tertiary"
        data-testid="ontology-ai-proposal-view"
        size="sm"
        onPress={onView}>
        {t('label.view')}
      </Button>
      <ButtonUtility
        color="tertiary"
        data-testid="ontology-ai-proposal-bar-close"
        icon={XClose}
        size="sm"
        tooltip={t('message.move-to-ontology-health')}
        onClick={onClose}
      />
    </div>
  );
};

export default OntologyAiProposalBar;
