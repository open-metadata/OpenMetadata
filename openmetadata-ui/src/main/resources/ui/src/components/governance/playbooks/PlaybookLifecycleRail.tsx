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

import { Button, Typography } from '@openmetadata/ui-core-components';
import {
  Delete,
  Edit,
  Lock,
  PlusCircle,
} from '@openmetadata/ui-core-components/icons';
import { useTranslation } from 'react-i18next';
import { PlaybookStageSummary } from './Playbook.types';

const ADD_STAGE_CLASSES =
  'tw:flex tw:items-center tw:gap-2 tw:whitespace-nowrap tw:rounded-lg tw:border ' +
  'tw:border-dashed tw:border-secondary tw:px-3.5 tw:py-2 tw:text-sm tw:font-medium ' +
  'tw:text-tertiary tw:hover:bg-secondary';

interface PlaybookLifecycleRailProps {
  stages: PlaybookStageSummary[];
  selectedStage?: string;
  onSelectStage: (stage: string) => void;
  onAddStage: () => void;
  onRenameStage: (stage: string) => void;
  onRemoveStage: (stage: string) => void;
  /** A stage can only go when nothing depends on it; the rail asks rather than decides. */
  canRemoveStage: (stage: string) => boolean;
}

/**
 * The lifecycle a playbook declares, with the gate between each pair of stages. The lock chip counts
 * the blocking checks that must pass before the asset can move on - clicking a stage edits what it
 * takes to leave it.
 */
export const PlaybookLifecycleRail = ({
  stages,
  selectedStage,
  onSelectStage,
  onAddStage,
  onRenameStage,
  onRemoveStage,
  canRemoveStage,
}: PlaybookLifecycleRailProps) => {
  const { t } = useTranslation();

  return (
    <section
      aria-label={t('label.lifecycle')}
      className="tw:rounded-xl tw:border tw:border-secondary tw:bg-primary tw:p-4">
      <div className="tw:mb-3 tw:flex tw:items-center tw:gap-3">
        <Typography className="tw:text-xs tw:font-semibold tw:uppercase tw:tracking-wide tw:text-tertiary">
          {t('label.lifecycle')}
        </Typography>
        <Typography className="tw:text-xs tw:text-tertiary">
          {t('message.click-a-gate-to-edit-it')}
        </Typography>
      </div>

      <ul className="tw:flex tw:items-center tw:gap-2 tw:overflow-x-auto tw:pb-1">
        {stages.map((stage, index) => (
          <li
            className="tw:flex tw:flex-none tw:items-center tw:gap-2"
            key={stage.key}>
            <button
              aria-current={stage.key === selectedStage ? 'true' : undefined}
              className={`tw:flex tw:flex-col tw:items-start tw:gap-0.5 tw:rounded-lg tw:border tw:px-3.5 tw:py-2 tw:text-left ${
                stage.key === selectedStage
                  ? 'tw:border-brand tw:bg-brand-primary'
                  : 'tw:border-secondary tw:bg-primary tw:hover:bg-secondary'
              }`}
              data-testid={`lifecycle-stage-${stage.key}`}
              type="button"
              onClick={() => onSelectStage(stage.key)}>
              <span className="tw:whitespace-nowrap tw:text-sm tw:font-semibold tw:text-primary">
                {stage.label}
              </span>
              <span className="tw:text-xs tw:text-tertiary">
                {stage.isTerminal
                  ? t('message.no-further-gates')
                  : t('message.check-count', { count: stage.checkCount })}
              </span>
            </button>

            {stage.key === selectedStage && (
              <span className="tw:flex tw:flex-none tw:flex-col">
                <Button
                  aria-label={t('label.rename-entity', {
                    entity: t('label.stage'),
                  })}
                  color="link-gray"
                  data-testid={`rename-stage-${stage.key}`}
                  size="sm"
                  onPress={() => onRenameStage(stage.key)}>
                  <Edit aria-hidden className="tw:h-3.5 tw:w-3.5" />
                </Button>
                <Button
                  aria-label={t('label.remove-entity', {
                    entity: t('label.stage'),
                  })}
                  color="link-gray"
                  data-testid={`remove-stage-${stage.key}`}
                  isDisabled={!canRemoveStage(stage.key)}
                  size="sm"
                  onPress={() => onRemoveStage(stage.key)}>
                  <Delete aria-hidden className="tw:h-3.5 tw:w-3.5" />
                </Button>
              </span>
            )}

            {index < stages.length - 1 && (
              <span
                className={`tw:flex tw:flex-none tw:items-center tw:gap-1 tw:rounded-full tw:border tw:px-2.5 tw:py-1.5 tw:text-xs tw:whitespace-nowrap ${
                  stage.key === selectedStage
                    ? 'tw:border-brand tw:bg-brand-solid tw:text-primary_on-brand'
                    : 'tw:border-secondary tw:text-tertiary'
                }`}
                data-testid={`lifecycle-gate-${stage.key}`}>
                <Lock aria-hidden className="tw:h-3 tw:w-3" />
                {t('message.blocking-count', { count: stage.blockingCount })}
              </span>
            )}
          </li>
        ))}

        <li className="tw:flex-none">
          <button
            className={ADD_STAGE_CLASSES}
            data-testid="add-stage"
            type="button"
            onClick={onAddStage}>
            <PlusCircle aria-hidden className="tw:h-4 tw:w-4" />
            {t('label.add-stage')}
          </button>
        </li>
      </ul>
    </section>
  );
};
