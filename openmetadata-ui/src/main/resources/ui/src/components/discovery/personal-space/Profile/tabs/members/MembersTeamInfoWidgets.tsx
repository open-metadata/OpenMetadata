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
  Autocomplete,
  Box,
  ButtonUtility,
  Input,
  Owner,
  Select,
  SelectItemType,
  Tooltip,
  Typography,
} from '@openmetadata/ui-core-components';
import { Edit } from '@openmetadata/ui-core-components/icons';
import { Check, InfoCircle, XClose } from '@untitledui/icons';
import { AxiosError } from 'axios';
import { FC, ReactNode, useCallback, useMemo, useState } from 'react';
import { useFilter } from 'react-aria';
import type { Key } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { PAGE_SIZE_LARGE } from '../../../../../../constants/constants';
import { SUBSCRIPTION_WEBHOOK_OPTIONS } from '../../../../../../constants/Teams.constants';
import { EntityType } from '../../../../../../enums/entity.enum';
import { Team } from '../../../../../../generated/entity/teams/team';
import { EntityReference } from '../../../../../../generated/entity/type';
import { getAllPersonas } from '../../../../../../rest/PersonaAPI';
import { getEntityName } from '../../../../../../utils/EntityNameUtils';
import { showErrorToast } from '../../../../../../utils/ToastUtils';
import { DomainLabel } from '../../../../../common/DomainLabel/DomainLabel.component';
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

const InfoWidget: FC<{ label: string; action?: ReactNode; children: ReactNode }> =
  ({ label, action, children }) => (
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

const PersonaField: FC<MembersTeamInfoWidgetsProps> = ({
  team,
  canEdit,
  onPatch,
}) => {
  const { t } = useTranslation();
  const { contains } = useFilter({ sensitivity: 'base' });
  const [isEditing, setIsEditing] = useState(false);
  const [personas, setPersonas] = useState<EntityReference[]>([]);
  const [selectedFqn, setSelectedFqn] = useState('');

  const items = useMemo<SelectItemType[]>(
    () =>
      personas.map((p) => ({
        id: p.fullyQualifiedName ?? p.name ?? '',
        label: p.displayName || p.name || '',
      })),
    [personas]
  );

  const startEdit = useCallback(async () => {
    setIsEditing(true);
    setSelectedFqn(team.defaultPersona?.fullyQualifiedName ?? '');
    try {
      const { data } = await getAllPersonas({ limit: PAGE_SIZE_LARGE });
      setPersonas(
        data.map(
          (p) =>
            ({
              id: p.id,
              type: 'persona',
              name: p.name,
              fullyQualifiedName: p.fullyQualifiedName,
              displayName: p.displayName,
            } as EntityReference)
        )
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  }, [team.defaultPersona]);

  const save = useCallback(() => {
    const ref = selectedFqn
      ? personas.find((p) => (p.fullyQualifiedName ?? p.name) === selectedFqn)
      : undefined;
    onPatch({ ...team, defaultPersona: ref });
    setIsEditing(false);
  }, [team, selectedFqn, personas, onPatch]);

  const editAction = canEdit && !isEditing && (
    <ButtonUtility
      aria-label={t('label.edit-entity', { entity: t('label.persona') })}
      color="tertiary"
      data-testid="edit-persona"
      icon={Edit}
      size="xs"
      onClick={startEdit}
    />
  );

  const selectedItems = selectedFqn
    ? [
        {
          id: selectedFqn,
          label:
            getEntityName(
              personas.find(
                (p) => (p.fullyQualifiedName ?? p.name) === selectedFqn
              )
            ) || selectedFqn,
        },
      ]
    : [];

  return (
    <InfoWidget action={editAction} label={t('label.persona')}>
      {isEditing ? (
        <Box direction="col" gap={2}>
          <Autocomplete
            data-testid="persona-select"
            filterOption={(item, filterText) =>
              contains(item.label || '', filterText)
            }
            items={items}
            placeholder={t('label.search-entity', { entity: t('label.persona') })}
            selectedItems={selectedItems}
            onItemCleared={() => setSelectedFqn('')}
            onItemInserted={(key: Key) => setSelectedFqn(String(key))}>
            {(item) => (
              <Autocomplete.Item id={item.id} key={item.id}>
                {item.label}
              </Autocomplete.Item>
            )}
          </Autocomplete>
          <Box direction="row" gap={2}>
            <ButtonUtility
              aria-label={t('label.save')}
              color="secondary"
              data-testid="save-persona"
              icon={Check}
              size="xs"
              onClick={save}
            />
            <ButtonUtility
              aria-label={t('label.cancel')}
              color="tertiary"
              data-testid="cancel-persona"
              icon={XClose}
              size="xs"
              onClick={() => setIsEditing(false)}
            />
          </Box>
        </Box>
      ) : (
        <Typography
          className={valueTextClass(Boolean(team.defaultPersona))}
          data-testid="team-persona"
          size="text-sm">
          {team.defaultPersona
            ? getEntityName(team.defaultPersona)
            : t('label.none')}
        </Typography>
      )}
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

  const editAction = canEdit && !isEditing && (
    <ButtonUtility
      aria-label={t('label.edit-entity', { entity: t('label.email') })}
      color="tertiary"
      data-testid="edit-email"
      icon={Edit}
      size="xs"
      onClick={() => {
        setValue(team.email ?? '');
        setIsEditing(true);
      }}
    />
  );

  return (
    <InfoWidget action={editAction} label={t('label.email')}>
      {isEditing ? (
        <Box direction="col" gap={2}>
          <Input
            autoFocus
            data-testid="email-input"
            size="sm"
            value={value}
            onChange={setValue}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                save();
              } else if (e.key === 'Escape') {
                setIsEditing(false);
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
      ) : (
        <Typography className={valueTextClass(Boolean(team.email))} size="text-sm">
          {team.email || t('label.none')}
        </Typography>
      )}
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

  const startEdit = useCallback(() => {
    const existing = team.profile?.subscription
      ? Object.entries(team.profile.subscription)[0]
      : undefined;
    setWebhook(existing ? existing[0] : '');
    setEndpoint(existing ? existing[1].endpoint ?? '' : '');
    setIsEditing(true);
  }, [team.profile?.subscription]);

  const save = useCallback(() => {
    const data: SubscriptionWebhook | undefined = webhook
      ? { webhook, endpoint }
      : undefined;
    onPatch({
      ...team,
      profile: {
        subscription: data ? { [data.webhook]: { endpoint: data.endpoint } } : undefined,
      },
    });
    setIsEditing(false);
  }, [team, webhook, endpoint, onPatch]);

  const editAction = canEdit && !isEditing && (
    <ButtonUtility
      aria-label={t('label.edit-entity', { entity: t('label.subscription') })}
      color="tertiary"
      data-testid="edit-subscription"
      icon={Edit}
      size="xs"
      onClick={startEdit}
    />
  );

  return (
    <InfoWidget action={editAction} label={t('label.subscription')}>
      {isEditing ? (
        <Box direction="col" gap={2}>
          <Select
            data-testid="subscription-webhook-select"
            items={items}
            placeholder={t('label.select-field', { field: t('label.webhook') })}
            selectedKey={webhook || null}
            onSelectionChange={(key) => setWebhook(key ? String(key) : '')}>
            {(item) => <Select.Item key={item.id} {...item} />}
          </Select>
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
      ) : (
        <Typography
          className={valueTextClass(keys.length > 0)}
          data-testid="subscription-value"
          size="text-sm">
          {keys.length > 0 ? keys[0] : t('label.none')}
        </Typography>
      )}
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
            onUpdate={(next) => onPatch({ ...team, owners: next })}
          />
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
      className="tw:flex-wrap tw:px-8 tw:py-4"
      data-testid="team-info-widgets"
      direction="row"
      gap={4}>
      {/* Domains — headerLayout renders the heading + edit pencil on one row. */}
      <Box className={WIDGET_CLASS} direction="col" gap={1}>
        <DomainLabel
          headerLayout
          multiple
          domains={team.domains ?? []}
          entityFqn={team.fullyQualifiedName ?? ''}
          entityId={team.id ?? ''}
          entityType={EntityType.TEAM}
          hasPermission={canEdit}
          labelClassName="tw:text-tertiary tw:text-xs tw:font-medium"
        />
      </Box>

      <OwnerField canEdit={canEdit} team={team} onPatch={onPatch} />
      <TypeField team={team} />
      <PersonaField canEdit={canEdit} team={team} onPatch={onPatch} />
      <EmailField canEdit={canEdit} team={team} onPatch={onPatch} />
      <SubscriptionField canEdit={canEdit} team={team} onPatch={onPatch} />

      {/* Total Users */}
      <InfoWidget
        action={
          <Tooltip title={t('message.team-distinct-user-description')}>
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
