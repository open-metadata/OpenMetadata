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
  BadgeWithDot,
  BadgeWithIcon,
  Button,
  ButtonUtility,
  Card,
  FeaturedIcon,
  ProgressBarBase,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  AskCollateSparkle,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Expand01,
  Link01,
  Minus,
} from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OntologyNode } from './OntologyExplorer.interface';
import { OntologyHealthSummary } from './OntologyStudio.utils';

/** AI proposals parked here once the canvas proposal bar is closed. */
export interface OntologyHealthAiProposals {
  readonly total: number;
  readonly title: string;
  readonly summary: string;
  readonly onReview: () => void;
}

interface OntologyHealthPanelProps {
  readonly aiProposals?: OntologyHealthAiProposals;
  readonly isRaised?: boolean;
  readonly health: OntologyHealthSummary;
  readonly isolatedTermCount?: number;
  readonly onConnect: (node: OntologyNode) => void;
}

type HealthPanelView = 'minimized' | 'summary' | 'open';

const PANEL_POSITION_CLASS = 'tw:absolute tw:bottom-4 tw:right-4 tw:z-6';
// Clears the AI proposal bar centred along the canvas bottom on narrower screens.
const RAISED_PANEL_CLASS = 'tw:max-2xl:bottom-18';

const OntologyHealthPanel = ({
  aiProposals,
  isRaised = false,
  health,
  isolatedTermCount,
  onConnect,
}: OntologyHealthPanelProps) => {
  const { t } = useTranslation();
  const [view, setView] = useState<HealthPanelView>('summary');
  const positionClass = classNames(
    PANEL_POSITION_CLASS,
    isRaised && RAISED_PANEL_CLASS
  );
  const isolatedCount = isolatedTermCount ?? health.isolatedTerms.length;
  const hasIsolated = isolatedCount > 0;
  const isOpen = view === 'open';
  const isolatedLabel = `${isolatedCount} ${t(
    'label.isolated'
  ).toLocaleLowerCase()}`;

  const connectedBar = (className: string) => (
    <ProgressBarBase
      className={`${className} tw:bg-utility-warning-300`}
      progressClassName="tw:bg-fg-success-secondary"
      value={health.connectedPercent}
    />
  );

  const renderMinimized = () => (
    <Card
      className={classNames(positionClass, 'tw:rounded-lg')}
      data-testid="ontology-health-panel"
      variant="elevated">
      <Button
        aria-label={`${t('label.expand')} ${t('label.ontology-health')}`}
        color="tertiary"
        data-testid="ontology-health-restore"
        iconTrailing={Expand01}
        size="sm"
        onPress={() => setView('summary')}>
        <span className="tw:flex tw:items-center tw:gap-2.5">
          {t('label.health')}
          {connectedBar('tw:h-1.5 tw:w-11')}
          <span className="tw:font-semibold tw:text-primary">
            {health.connectedPercent}%
          </span>
          {aiProposals ? (
            <BadgeWithIcon
              color="purple"
              iconLeading={AskCollateSparkle}
              size="sm"
              type="pill-color">
              {aiProposals.total}
            </BadgeWithIcon>
          ) : null}
          {hasIsolated ? (
            <BadgeWithDot color="warning" size="sm" type="pill-color">
              {isolatedLabel}
            </BadgeWithDot>
          ) : null}
        </span>
      </Button>
    </Card>
  );

  const renderTitleRow = () => (
    <div className="tw:flex tw:items-center tw:gap-2">
      <Typography className="tw:text-primary" size="text-sm" weight="semibold">
        {t('label.ontology-health')}
      </Typography>
      <Badge
        color={hasIsolated ? 'warning' : 'success'}
        size="sm"
        type="pill-color">
        {t(hasIsolated ? 'label.attention' : 'label.healthy')}
      </Badge>
      <span className="tw:flex-1" />
      <ButtonUtility
        color="tertiary"
        icon={Minus}
        size="xs"
        tooltip={t('label.minimize')}
        onClick={() => setView('minimized')}
      />
      <ButtonUtility
        color="tertiary"
        icon={isOpen ? ChevronDown : ChevronUp}
        size="xs"
        tooltip={t(isOpen ? 'label.collapse' : 'label.expand')}
        onClick={() => setView(isOpen ? 'summary' : 'open')}
      />
    </div>
  );

  const renderIsolatedSummary = () => (
    <div className="tw:flex tw:items-center tw:gap-2">
      <Typography className="tw:flex-1" size="text-xs">
        <span
          className="tw:font-semibold tw:text-primary"
          data-testid="ontology-isolated-count">
          {isolatedCount}
        </span>{' '}
        {t('label.isolated-term-plural').toLocaleLowerCase()}
      </Typography>
      {hasIsolated ? (
        <Button
          color="link-color"
          data-testid="ontology-health-review"
          iconTrailing={ChevronRight}
          size="xs"
          onPress={() => setView('open')}>
          {t('label.review')}
        </Button>
      ) : null}
    </div>
  );

  const renderIsolatedTerm = (term: OntologyNode) => (
    <li
      className="tw:flex tw:items-center tw:gap-2.5 tw:rounded-lg tw:px-2.5 tw:py-2"
      data-testid={`ontology-isolated-term-${term.id}`}
      key={term.id}>
      <FeaturedIcon color="warning" icon={Link01} size="sm" theme="light" />
      <div className="tw:min-w-0 tw:flex-1">
        <Typography
          ellipsis
          as="p"
          className="tw:m-0 tw:text-primary"
          size="text-sm"
          weight="medium">
          {term.label}
        </Typography>
        <Typography as="p" className="tw:m-0" color="secondary" size="text-xs">
          {t('message.no-relations-yet')}
        </Typography>
      </div>
      <Button
        aria-label={`${t('label.connect')} ${term.label}`}
        color="secondary"
        data-testid={`ontology-connect-${term.id}`}
        iconLeading={Link01}
        size="xs"
        onPress={() => onConnect(term)}>
        {t('label.connect')}
      </Button>
    </li>
  );

  const renderIsolatedList = () => (
    <>
      <div className="tw:flex tw:shrink-0 tw:items-center tw:gap-2 tw:border-t tw:border-secondary tw:bg-secondary tw:px-4 tw:py-2.5">
        <Typography
          className="tw:flex-1 tw:uppercase tw:tracking-wide"
          color="secondary"
          size="text-xs"
          weight="semibold">
          {t('label.isolated-term-plural')}
        </Typography>
        <Typography color="secondary" size="text-xs">
          <span data-testid="ontology-isolated-count">{isolatedCount}</span>{' '}
          {t('label.of-lowercase')} {health.totalTermCount}
        </Typography>
      </div>
      <ul className="tw:m-0 tw:flex tw:min-h-0 tw:flex-1 tw:list-none tw:flex-col tw:overflow-auto tw:p-1.5">
        {health.isolatedTerms.length === 0 ? (
          <li className="tw:px-2.5 tw:py-4">
            <Typography color="success" size="text-sm">
              {t('message.all-ontology-terms-connected')}
            </Typography>
          </li>
        ) : (
          health.isolatedTerms.map(renderIsolatedTerm)
        )}
      </ul>
    </>
  );

  if (view === 'minimized') {
    return renderMinimized();
  }

  return (
    <Card
      className={`${positionClass} tw:flex tw:max-h-[calc(100%-2rem)] tw:w-75 tw:max-w-[calc(100%-2rem)] tw:flex-col tw:overflow-hidden`}
      data-testid="ontology-health-panel"
      variant="elevated">
      <div className="tw:flex tw:shrink-0 tw:flex-col tw:gap-3 tw:p-4">
        {renderTitleRow()}
        <div className="tw:flex tw:items-baseline tw:gap-2">
          <Typography size="text-md" weight="semibold">
            {health.connectedPercent}%
          </Typography>
          <Typography color="secondary" size="text-xs">
            {t('message.count-of-total-terms-connected', {
              count: health.connectedTermCount,
              total: health.totalTermCount,
            })}
          </Typography>
        </div>
        {connectedBar('tw:h-1.5')}
        {aiProposals ? (
          <Button
            noTextPadding
            className={classNames(
              'tw:w-full tw:justify-start tw:rounded-lg tw:border tw:border-utility-purple-200',
              'tw:bg-utility-purple-50 tw:px-2.5 tw:py-2 tw:text-left tw:*:data-text:w-full tw:*:data-text:min-w-0'
            )}
            color="tertiary"
            data-testid="ontology-health-ai-proposals"
            onPress={aiProposals.onReview}>
            <span className="tw:flex tw:w-full tw:items-center tw:gap-2">
              <AskCollateSparkle
                aria-hidden
                className="tw:size-3.5 tw:shrink-0"
              />
              <Typography
                as="span"
                className="tw:min-w-0 tw:flex-1 tw:whitespace-normal"
                size="text-xs">
                <span className="tw:font-medium tw:text-primary">
                  {aiProposals.title}
                </span>{' '}
                <span className="tw:text-secondary">{aiProposals.summary}</span>
              </Typography>
              <span className="tw:flex tw:items-center tw:text-xs tw:font-medium tw:text-utility-purple-700">
                {t('label.review')}
                <ChevronRight aria-hidden className="tw:size-3.5" />
              </span>
            </span>
          </Button>
        ) : null}
        {isOpen ? null : renderIsolatedSummary()}
      </div>
      {isOpen ? renderIsolatedList() : null}
    </Card>
  );
};

export default OntologyHealthPanel;
