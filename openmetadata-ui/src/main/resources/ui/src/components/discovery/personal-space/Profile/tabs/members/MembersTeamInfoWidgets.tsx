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
    Box,
    ButtonUtility,
    Input,
    Owner,
    Popover,
    PopoverTrigger,
    Select,
    SelectItemType,
    Tooltip,
    Typography
} from '@openmetadata/ui-core-components';
import { Edit } from '@openmetadata/ui-core-components/icons';
import { Check, InfoCircle, XClose } from '@untitledui/icons';
import { FC, ReactNode, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SUBSCRIPTION_WEBHOOK_OPTIONS } from '../../../../../../constants/Teams.constants';
import { Team } from '../../../../../../generated/entity/teams/team';
import { EntityReference } from '../../../../../../generated/entity/type';
import { getEntityName } from '../../../../../../utils/EntityNameUtils';
import DomainSelect from '../../../../../common/DomainSelect/DomainSelect';
import { DomainSelectTrigger } from '../../../../../common/DomainSelect/DomainSelectTrigger';
import DomainTags from '../../../../../common/DomainTags/DomainTags';
import PersonaSelect from '../../../../../common/PersonaSelect/PersonaSelect';
import { UserTeamSelectableList } from '../../../../../common/UserTeamSelectableList/UserTeamSelectableList.component';
import type { SubscriptionWebhook } from '../../../../../Settings/Team/TeamDetails/team.interface';

interface MembersTeamInfoWidgetsProps {
  team: Team;
  canEdit: boolean;
  onPatch: (updated: Team) => void | Promise<void>;
}

const WIDGET_CLASS =
  'tw:flex-1 tw:min-w-[120px] tw:rounded-lg tw:border tw:border-subtle tw:p-3';

// A filled value renders primary; an empty/None value renders muted.
const valueTextClass = (hasValue: boolean): string =>
  hasValue ? 'tw:text-primary' : 'tw:text-tertiary';

// DomainSelect hands back a single ref, an array, or undefined (cleared);
// normalise to the array shape the Team PATCH expects.
const toDomainArray = (
  next: EntityReference | EntityReference[] | undefined
): EntityReference[] => {
  if (Array.isArray(next)) {
    return next;
  }

  return next ? [next] : [];
};

const InfoWidget: FC<{
  label: string;
  action?: ReactNode;
  children: ReactNode;
}> = ({ label, action, children }) => (
  <Box className={WIDGET_CLASS} direction="col" gap={1}>
    <Box align="center" direction="row" gap={1}>
      <Typography className="tw:text-tertiary" size="text-xs" weight="medium">
        {label}
      </Typography>
      {action}
    </Box>
    {children}
  </Box>
);

const NoneText: FC = () => {
  const { t } = useTranslation();

  return (
    <Typography className="tw:text-tertiary" size="text-sm">
      {t('label.none')}
    </Typography>
  );
};

// One shared edit pencil so Domains/Owners/Email/Persona/Subscription look
// identical. Always used as an overlay trigger child (selectable list, TreeSelect
// renderTrigger, or PopoverTrigger), which wires the press — so it takes no onClick.
const EditPencil: FC<{
  entity: string;
  dataTestId: string;
}> = ({ entity, dataTestId }) => {
  const { t } = useTranslation();

  return (
    <ButtonUtility
      aria-label={t('label.edit-entity', { entity })}
      color="tertiary"
      data-testid={dataTestId}
      icon={<Edit className="tw:size-3" />}
      size="xs"
    />
  );
};

const DomainField: FC<MembersTeamInfoWidgetsProps> = ({
  team,
  canEdit,
  onPatch,
}) => {
  const { t } = useTranslation();
  const domains = team.domains ?? [];

  const renderTrigger = ({ toggle }: { toggle: () => void }) => (
    <DomainSelectTrigger toggle={toggle}>
      <EditPencil dataTestId="edit-domain" entity={t('label.domain-plural')} />
    </DomainSelectTrigger>
  );

  return (
    <InfoWidget
      action={
        canEdit && (
          <DomainSelect
            multiple
            data-testid="domain-select"
            hasPermission={canEdit}
            renderTrigger={renderTrigger}
            selectedDomain={domains}
            triggerVariant="button"
            onUpdate={(next) =>
              onPatch({ ...team, domains: toDomainArray(next) })
            }
          />
        )
      }
      label={t('label.domain-plural')}>
      {domains.length > 0 ? <DomainTags domains={domains} /> : <NoneText />}
    </InfoWidget>
  );
};

const PersonaField: FC<MembersTeamInfoWidgetsProps> = ({
  team,
  canEdit,
  onPatch,
}) => {
  const { t } = useTranslation();

  const renderTrigger = ({ toggle }: { toggle: () => void }) => (
    <DomainSelectTrigger toggle={toggle}>
      <EditPencil dataTestId="edit-persona" entity={t('label.persona')} />
    </DomainSelectTrigger>
  );

  return (
    <InfoWidget
      action={
        canEdit && (
          <PersonaSelect
            hasPermission={canEdit}
            renderTrigger={renderTrigger}
            selectedPersona={team.defaultPersona}
            triggerVariant="button"
            onUpdate={(persona) =>
              onPatch({ ...team, defaultPersona: persona })
            }
          />
        )
      }
      label={t('label.persona')}>
      <Typography
        className={valueTextClass(Boolean(team.defaultPersona))}
        data-testid="team-persona"
        size="text-sm">
        {team.defaultPersona
          ? getEntityName(team.defaultPersona)
          : t('label.none')}
      </Typography>
    </InfoWidget>
  );
};

const EmailField: FC<MembersTeamInfoWidgetsProps> = ({
  team,
  canEdit,
  onPatch,
}) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState('');

  const save = useCallback(() => {
    onPatch({ ...team, email: value });
    setIsEditing(false);
  }, [team, value, onPatch]);

  // Seed the field from the current email each time the popover opens.
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        setValue(team.email ?? '');
      }
      setIsEditing(open);
    },
    [team.email]
  );

  return (
    <InfoWidget
      action={
        canEdit && (
          <PopoverTrigger isOpen={isEditing} onOpenChange={handleOpenChange}>
            <EditPencil dataTestId="edit-email" entity={t('label.email')} />
            <Popover containerClassName="tw:w-72 tw:p-4">
              <Box direction="col" gap={3}>
                <Typography size="text-sm" weight="semibold">
                  {t('label.edit-entity', { entity: t('label.email') })}
                </Typography>
                <Input
                  data-testid="email-input"
                  size="sm"
                  value={value}
                  onChange={setValue}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      save();
                    }
                  }}
                />
                <Box direction="row" gap={2}>
                  <ButtonUtility
                    aria-label={t('label.save')}
                    color="secondary"
                    data-testid="save-email"
                    icon={Check}
                    size="xs"
                    onClick={save}
                  />
                  <ButtonUtility
                    aria-label={t('label.cancel')}
                    color="tertiary"
                    data-testid="cancel-email"
                    icon={XClose}
                    size="xs"
                    onClick={() => setIsEditing(false)}
                  />
                </Box>
              </Box>
            </Popover>
          </PopoverTrigger>
        )
      }
      label={t('label.email')}>
      <Typography
        className={valueTextClass(Boolean(team.email))}
        size="text-sm">
        {team.email || t('label.none')}
      </Typography>
    </InfoWidget>
  );
};

const SubscriptionField: FC<MembersTeamInfoWidgetsProps> = ({
  team,
  canEdit,
  onPatch,
}) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [webhook, setWebhook] = useState('');
  const [endpoint, setEndpoint] = useState('');

  const items = useMemo<SelectItemType[]>(
    () =>
      SUBSCRIPTION_WEBHOOK_OPTIONS.filter((o) => o.value !== '').map((o) => ({
        id: o.value,
        label: t(o.label),
      })),
    [t]
  );

  const keys = team.profile?.subscription
    ? Object.keys(team.profile.subscription)
    : [];

  // Seed the webhook/endpoint from the existing subscription on each open.
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        const existing = team.profile?.subscription
          ? Object.entries(team.profile.subscription)[0]
          : undefined;
        setWebhook(existing ? existing[0] : '');
        setEndpoint(existing ? existing[1].endpoint ?? '' : '');
      }
      setIsEditing(open);
    },
    [team.profile?.subscription]
  );

  const save = useCallback(() => {
    const data: SubscriptionWebhook | undefined = webhook
      ? { webhook, endpoint }
      : undefined;
    onPatch({
      ...team,
      profile: {
        subscription: data
          ? { [data.webhook]: { endpoint: data.endpoint } }
          : undefined,
      },
    });
    setIsEditing(false);
  }, [team, webhook, endpoint, onPatch]);

  return (
    <InfoWidget
      action={
        canEdit && (
          <PopoverTrigger isOpen={isEditing} onOpenChange={handleOpenChange}>
            <EditPencil
              dataTestId="edit-subscription"
              entity={t('label.subscription')}
            />
            <Popover containerClassName="tw:w-80 tw:p-4">
              <Box direction="col" gap={3}>
                <Typography size="text-sm" weight="semibold">
                  {t('label.add-subscription')}
                </Typography>
                <Box direction="col" gap={2}>
                  <Typography
                    className="tw:text-secondary"
                    size="text-sm"
                    weight="medium">
                    {t('label.webhook')}
                  </Typography>
                  <Select
                    data-testid="subscription-webhook-select"
                    items={items}
                    placeholder={t('label.select-field', {
                      field: t('label.webhook'),
                    })}
                    selectedKey={webhook || null}
                    onSelectionChange={(key) =>
                      setWebhook(key ? String(key) : '')
                    }>
                    {(item) => <Select.Item key={item.id} {...item} />}
                  </Select>
                </Box>
                {webhook && (
                  <Input
                    data-testid="subscription-endpoint-input"
                    placeholder={t('label.enter-entity-value', {
                      entity: t('label.endpoint'),
                    })}
                    size="sm"
                    value={endpoint}
                    onChange={setEndpoint}
                  />
                )}
                <Box direction="row" gap={2}>
                  <ButtonUtility
                    aria-label={t('label.save')}
                    color="secondary"
                    data-testid="save-subscription"
                    icon={Check}
                    size="xs"
                    onClick={save}
                  />
                  <ButtonUtility
                    aria-label={t('label.cancel')}
                    color="tertiary"
                    data-testid="cancel-subscription"
                    icon={XClose}
                    size="xs"
                    onClick={() => setIsEditing(false)}
                  />
                </Box>
              </Box>
            </Popover>
          </PopoverTrigger>
        )
      }
      label={t('label.subscription')}>
      <Typography
        className={valueTextClass(keys.length > 0)}
        data-testid="subscription-value"
        size="text-sm">
        {keys.length > 0 ? keys[0] : t('label.none')}
      </Typography>
    </InfoWidget>
  );
};

const OwnerField: FC<MembersTeamInfoWidgetsProps> = ({
  team,
  canEdit,
  onPatch,
}) => {
  const { t } = useTranslation();
  const owners = team.owners ?? [];

  return (
    <InfoWidget
      action={
        canEdit && (
          <UserTeamSelectableList
            hasPermission
            owner={owners}
            onUpdate={(next) => onPatch({ ...team, owners: next })}>
            <EditPencil
              dataTestId="edit-owners"
              entity={t('label.owner-plural')}
            />
          </UserTeamSelectableList>
        )
      }
      label={t('label.owner-plural')}>
      {owners.length > 0 ? (
        <Owner
          hasPermission={false}
          isCompactView={false}
          owners={owners}
          showLabel={false}
        />
      ) : (
        <NoneText />
      )}
    </InfoWidget>
  );
};

const TypeField: FC<{ team: Team }> = ({ team }) => {
  const { t } = useTranslation();

  return (
    <InfoWidget label={t('label.type')}>
      {team.teamType ? (
        <Typography
          className="tw:text-primary"
          data-testid="team-type"
          size="text-sm">
          {team.teamType}
        </Typography>
      ) : (
        <NoneText />
      )}
    </InfoWidget>
  );
};

const MembersTeamInfoWidgets: FC<MembersTeamInfoWidgetsProps> = ({
  team,
  canEdit,
  onPatch,
}) => {
  const { t } = useTranslation();

  return (
    <Box
      className="tw:flex-wrap tw:px-8 tw:py-4 tw:pt-0"
      data-testid="team-info-widgets"
      direction="row"
      gap={4}>
      <DomainField canEdit={canEdit} team={team} onPatch={onPatch} />
      <OwnerField canEdit={canEdit} team={team} onPatch={onPatch} />
      <TypeField team={team} />
      <PersonaField canEdit={canEdit} team={team} onPatch={onPatch} />
      <EmailField canEdit={canEdit} team={team} onPatch={onPatch} />
      <SubscriptionField canEdit={canEdit} team={team} onPatch={onPatch} />

      {/* Total Users — triggerClassName forces the core-ui Tooltip to wrap the
          icon component in a focusable trigger so hover/focus actually opens it. */}
      <InfoWidget
        action={
          <Tooltip
            title={t('message.team-distinct-user-description')}
            triggerClassName="tw:inline-flex tw:items-center">
            <InfoCircle
              aria-label={t('message.team-distinct-user-description')}
              className="tw:size-3 tw:text-tertiary"
            />
          </Tooltip>
        }
        label={t('label.total-entity', { entity: t('label.user-plural') })}>
        <Typography
          className="tw:text-primary"
          data-testid="team-user-count"
          size="text-sm">
          {String(team.userCount ?? 0)}
        </Typography>
      </InfoWidget>
    </Box>
  );
};

export default MembersTeamInfoWidgets;
