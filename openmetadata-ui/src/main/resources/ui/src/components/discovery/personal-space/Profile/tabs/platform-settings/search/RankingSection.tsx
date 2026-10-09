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
  Badge,
  Box,
  Card,
  Input,
  Select,
  Toggle,
  Typography,
} from '@openmetadata/ui-core-components';
import { startCase } from 'lodash';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BoostMode,
  RankingConfiguration,
  RankingStage,
  ScoreMode,
} from '../../../../../../../generated/configuration/searchSettings';
import {
  parseOptionalNumber,
  setSignalMaxBoost,
  setStageWeight,
} from './SearchSettings.utils';

export const BOOST_MODE_ITEMS = Object.values(BoostMode).map((value) => ({
  id: value,
  label: startCase(value),
}));

export const SCORE_MODE_ITEMS = Object.values(ScoreMode).map((value) => ({
  id: value,
  label: startCase(value),
}));

interface LabelledProps {
  label: string;
  children: ReactNode;
}

const Labelled = ({ label, children }: LabelledProps) => (
  <Box className="tw:min-w-0" direction="col" gap={1}>
    <Typography className="tw:text-tertiary" size="text-xs">
      {label}
    </Typography>
    {children}
  </Box>
);

const FieldBadges = ({ fields = [] }: { fields?: string[] }) => (
  <Box className="tw:min-w-0" direction="row" gap={1} wrap="wrap">
    {fields.map((field) => (
      <Badge
        className="tw:max-w-full tw:truncate"
        color="gray"
        key={field}
        size="sm"
        type="color">
        {field}
      </Badge>
    ))}
  </Box>
);

interface RankingSectionProps {
  ranking?: RankingConfiguration;
  onChange: (ranking: RankingConfiguration) => void;
}

/** The entity's ranking stages and signals; only weights, modes and the switch are editable. */
const RankingSection = ({ ranking, onChange }: RankingSectionProps) => {
  const { t } = useTranslation();

  if (!ranking) {
    return (
      <Typography className="tw:text-tertiary" size="text-sm">
        {t('message.no-data-available')}
      </Typography>
    );
  }

  const { signals } = ranking;

  const renderStage = (stage: RankingStage, index: number) => {
    const name = stage.name ?? '';
    const minimumShouldMatch = stage.minimumShouldMatch
      ? ` (${stage.minimumShouldMatch})`
      : '';

    return (
      <Card
        data-testid={
          name ? `ranking-stage-${name}` : `ranking-stage-unnamed-${index}`
        }
        key={`${name || 'unnamed'}-${index}`}
        size="sm">
        <Card.Content>
          <Box direction="col" gap={3}>
            <Box align="end" direction="row" gap={3} justify="between">
              <Typography size="text-sm" weight="semibold">
                {name ? startCase(name) : t('label.no-data')}
              </Typography>
              <Input
                aria-label={t('label.weight')}
                className="tw:w-24"
                inputDataTestId={`ranking-stage-weight-${index}`}
                type="number"
                value={stage.weight?.toString() ?? ''}
                onChange={(value) =>
                  onChange(
                    setStageWeight(ranking, index, parseOptionalNumber(value))
                  )
                }
              />
            </Box>
            {stage.purpose && (
              <Typography className="tw:text-tertiary" size="text-xs">
                {stage.purpose}
              </Typography>
            )}
            <div className="tw:grid tw:grid-cols-2 tw:gap-3">
              <Labelled label={t('label.match-type')}>
                <Typography size="text-sm">
                  {stage.matchType
                    ? `${startCase(stage.matchType)}${minimumShouldMatch}`
                    : t('label.no-data')}
                </Typography>
              </Labelled>
              <Labelled label={t('label.field-plural')}>
                <FieldBadges fields={stage.fields} />
              </Labelled>
            </div>
          </Box>
        </Card.Content>
      </Card>
    );
  };

  return (
    <Box data-testid="ranking-settings" direction="col" gap={3}>
      <Card size="sm">
        <Card.Content>
          <Box align="center" direction="row" justify="between">
            <Labelled label={t('label.algorithm')}>
              <Typography size="text-sm">
                {ranking.algorithm
                  ? startCase(ranking.algorithm)
                  : t('label.no-data')}
              </Typography>
            </Labelled>
            <Toggle
              data-testid="ranking-enabled-switch"
              isSelected={ranking.enabled ?? false}
              label={t('label.enabled')}
              onChange={(enabled) => onChange({ ...ranking, enabled })}
            />
          </Box>
        </Card.Content>
      </Card>

      {(ranking.stages ?? []).map((stage, index) => renderStage(stage, index))}

      {signals && (
        <Card data-testid="ranking-signals" size="sm">
          <Card.Content>
            <Box direction="col" gap={3}>
              {signals.purpose && (
                <Typography className="tw:text-tertiary" size="text-xs">
                  {signals.purpose}
                </Typography>
              )}
              <Typography className="tw:text-tertiary" size="text-xs">
                {t('message.search-ranking-signals-explanation')}
              </Typography>
              <div className="tw:grid tw:grid-cols-2 tw:gap-3">
                <Select
                  data-testid="ranking-boost-mode-select"
                  items={BOOST_MODE_ITEMS}
                  label={t('label.boost-mode')}
                  size="sm"
                  value={signals.boostMode ?? null}
                  onChange={(key) =>
                    onChange({
                      ...ranking,
                      signals: { ...signals, boostMode: key as BoostMode },
                    })
                  }>
                  {(item) => <Select.Item id={item.id} label={item.label} />}
                </Select>
                <Select
                  data-testid="ranking-score-mode-select"
                  items={SCORE_MODE_ITEMS}
                  label={t('label.score-mode')}
                  size="sm"
                  value={signals.scoreMode ?? null}
                  onChange={(key) =>
                    onChange({
                      ...ranking,
                      signals: { ...signals, scoreMode: key as ScoreMode },
                    })
                  }>
                  {(item) => <Select.Item id={item.id} label={item.label} />}
                </Select>
                <Input
                  inputDataTestId="ranking-max-boost"
                  label={t('label.max')}
                  size="sm"
                  type="number"
                  value={signals.maxBoost?.toString() ?? ''}
                  onChange={(value) =>
                    onChange(
                      setSignalMaxBoost(ranking, parseOptionalNumber(value))
                    )
                  }
                />
                <Labelled label={t('label.field-plural')}>
                  <FieldBadges fields={signals.fields} />
                </Labelled>
              </div>
            </Box>
          </Card.Content>
        </Card>
      )}
    </Box>
  );
};

export default RankingSection;
