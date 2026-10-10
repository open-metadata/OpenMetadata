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

import { Badge, Typography } from '@openmetadata/ui-core-components';
import { Lock01 } from '@openmetadata/ui-core-components/icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  CuratedRule,
  describeCuratedClause,
} from '../../../../utils/curatedRule';

export interface CuratedRuleSummaryProps {
  clauses: CuratedRule;
}

/** The rule behind the list, so the rows are never an unexplained set. */
const CuratedRuleSummary: React.FC<CuratedRuleSummaryProps> = ({ clauses }) => {
  const { t } = useTranslation();

  if (clauses.length === 0) {
    return null;
  }

  return (
    <div className="tw:rounded-xl tw:bg-secondary tw:p-3.5">
      <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
        {/* `!` on the colours throughout: Typography renders `.prose`, whose
          unlayered `color` rule is emitted after the Tailwind utilities. */}
        <Typography
          className="tw:text-text-tertiary! tw:uppercase"
          size="text-xs"
          weight="semibold">
          {t('label.rule')}
        </Typography>
        {clauses.map((clause, index) => (
          <React.Fragment key={clause.termKey}>
            {index > 0 && (
              <Typography className="tw:text-text-tertiary!" size="text-xs">
                {t('label.and-lowercase')}
              </Typography>
            )}
            <Badge color="gray" size="sm" type="color">
              {describeCuratedClause(clause, t)}
            </Badge>
          </React.Fragment>
        ))}
      </div>
      <div className="tw:mt-2 tw:flex tw:items-center tw:gap-1.5">
        <Lock01
          aria-hidden
          className="tw:shrink-0 tw:text-text-tertiary"
          height={12}
          width={12}
        />
        <Typography className="tw:text-text-tertiary!" size="text-xs">
          {t('message.set-in-persona-settings')}
        </Typography>
      </div>
    </div>
  );
};

export default CuratedRuleSummary;
