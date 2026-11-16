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
import {
  Archive,
  ChevronDown,
  SlashCircle01,
} from '@openmetadata/ui-core-components/icons';
import { lazy } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityStatus } from '../../../generated/entity/data/glossaryTerm';
import { getEntityFeedLink } from '../../../utils/EntityPureUtils';
import { getEntityStatusClass } from '../../../utils/EntityStatusUtils';
import { stageKey } from '../../../utils/governance/lifecycle/LifecycleRequest.utils';
import { STAGE_ACTION, STAGE_TRIGGER_CLASS } from './EntityStageBadge.constants';
import withSuspenseFallback from '../../AppRouter/withSuspenseFallback';
import StatusBadge from '../../common/StatusBadge/StatusBadge.component';

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
  onRequest?: (stage: EntityStatus) => void;
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
      <Dropdown.Popover placement="bottom start">
        <Dropdown.Menu
          data-testid="entity-status-request-menu"
          onAction={(key) => onRequest(key as EntityStatus)}>
          {requestStages.map((stage) => (
            <Dropdown.Item
              data-testid={`request-${stageKey(stage)}-button`}
              icon={stage === EntityStatus.Archived ? Archive : SlashCircle01}
              id={stage}
              key={stage}
              label={STAGE_ACTION[stage] ? t(STAGE_ACTION[stage]) : stage}
            />
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
};
