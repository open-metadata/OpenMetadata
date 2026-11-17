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
import { Button, Dropdown, Tooltip } from '@openmetadata/ui-core-components';
import { ChevronDown } from '@openmetadata/ui-core-components/icons';
import { lazy, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityStatus } from '../../../generated/entity/data/glossaryTerm';
import { getEntityFeedLink } from '../../../utils/EntityPureUtils';
import { getEntityStatusClass } from '../../../utils/EntityStatusUtils';
import { stageKey } from '../../../utils/governance/lifecycle/LifecycleRequest.utils';
import withSuspenseFallback from '../../AppRouter/withSuspenseFallback';
import StatusBadge from '../../common/StatusBadge/StatusBadge.component';
import {
  STAGE_MENU_CLASS,
  STAGE_MENU_HEADER_CLASS,
  STAGE_TRIGGER_CLASS,
} from './EntityStageBadge.constants';
import { getStageActionLabel } from './EntityStageBadge.utils';
import { StatusRequestModal } from './StatusRequestModal';

// The tooltip mounts these only while it is open, so the lookup and its chunk load on hover.
const EntityStatusDecisionTitle = withSuspenseFallback(
  lazy(() =>
    import('./EntityStatusDecision').then((module) => ({
      default: module.EntityStatusDecisionTitle,
    }))
  )
);
const EntityStatusDecisionDescription = withSuspenseFallback(
  lazy(() =>
    import('./EntityStatusDecision').then((module) => ({
      default: module.EntityStatusDecisionDescription,
    }))
  )
);

export interface EntityStageBadgeProps {
  status: EntityStatus;
  /** With {@link entityId} and {@link fqn}, hovering the badge shows who set the status. */
  entityType?: string;
  entityId?: string;
  fqn?: string;
  /** Stages the user can ask the asset's lifecycle for; the badge then opens a menu of them. */
  requestStages?: EntityStatus[];
  /** Raises the request; resolves true once it exists. */
  onRequest?: (stage: EntityStatus, reason: string) => Promise<boolean>;
}

/** The asset's lifecycle stage, with who set it on hover when the asset is known. */
export const EntityStageBadge = ({
  status,
  entityType,
  entityId,
  fqn,
  requestStages = [],
  onRequest,
}: EntityStageBadgeProps) => {
  const { t } = useTranslation();
  const [requesting, setRequesting] = useState<EntityStatus>();
  const badge = (
    <StatusBadge label={status} status={getEntityStatusClass(status)} />
  );

  const decision =
    entityType && entityId && fqn
      ? {
          entityType,
          entityId,
          entityLink: getEntityFeedLink(entityType, fqn),
          status,
        }
      : undefined;

  const withDecision = (trigger: JSX.Element, triggerClassName?: string) =>
    decision ? (
      <Tooltip
        description={<EntityStatusDecisionDescription {...decision} />}
        placement="bottom start"
        title={<EntityStatusDecisionTitle {...decision} />}
        triggerClassName={triggerClassName}
        variant="light">
        {trigger}
      </Tooltip>
    ) : (
      trigger
    );

  if (requestStages.length === 0 || !onRequest) {
    return decision
      ? withDecision(
          <span data-testid="entity-status-badge-trigger">{badge}</span>,
          'tw:cursor-default tw:rounded-md tw:outline-focus-ring tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2'
        )
      : badge;
  }

  return (
    <>
      <Dropdown.Root>
        {withDecision(
          <Button
            noTextPadding
            aria-label={t('label.change-entity', { entity: t('label.status') })}
            className={STAGE_TRIGGER_CLASS}
            color="tertiary"
            data-testid="entity-status-request-trigger"
            iconTrailing={ChevronDown}
            size="sm">
            {badge}
          </Button>
        )}
        <Dropdown.Popover className={STAGE_MENU_CLASS} placement="bottom start">
          <Dropdown.Menu
            data-testid="entity-status-request-menu"
            onAction={(key) => setRequesting(key as EntityStatus)}>
            <Dropdown.Section>
              <Dropdown.SectionHeader
                className={STAGE_MENU_HEADER_CLASS}
                data-testid="entity-status-request-menu-header">
                {t('label.request-a-move')}
              </Dropdown.SectionHeader>
              {requestStages.map((stage) => {
                const actionLabel = getStageActionLabel(t, stage);

                return (
                  <Dropdown.Item
                    data-testid={`request-${stageKey(stage)}-button`}
                    id={stage}
                    key={stage}
                    textValue={actionLabel}>
                    <span className="tw:flex tw:items-center tw:justify-between tw:gap-2">
                      <span className="tw:truncate">{actionLabel}</span>
                      <StatusBadge
                        className="tw:shrink-0"
                        dataTestId={`request-${stageKey(stage)}-stage-badge`}
                        label={stage}
                        status={getEntityStatusClass(stage)}
                      />
                    </span>
                  </Dropdown.Item>
                );
              })}
            </Dropdown.Section>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown.Root>
      {requesting && (
        <StatusRequestModal
          initialStage={requesting}
          stages={requestStages}
          onCancel={() => setRequesting(undefined)}
          onSubmit={onRequest}
        />
      )}
    </>
  );
};
