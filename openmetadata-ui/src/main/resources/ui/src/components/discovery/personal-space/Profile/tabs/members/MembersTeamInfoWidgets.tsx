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
  Button,
  ButtonUtility,
  Divider,
  Input,
  Owner,
  Popover,
  PopoverTrigger,
  Select,
  SelectItemType,
  Tooltip,
  Typography,
} from '@openmetadata/ui-core-components';
import { Edit01, InfoCircle } from '@openmetadata/ui-core-components/icons';
import { FC, ReactNode, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EMAIL_REG_EX } from '../../../../../../constants/regex.constants';
import {
  SUBSCRIPTION_WEBHOOK,
  SUBSCRIPTION_WEBHOOK_OPTIONS,
} from '../../../../../../constants/Teams.constants';
import { Team, TeamType } from '../../../../../../generated/entity/teams/team';
import { getEntityName } from '../../../../../../utils/EntityNameUtils';
import { getWebhookIcon } from '../../../../../../utils/TeamUtils';
import DomainSelect from '../../../../../common/DomainSelect/DomainSelect';
import { DomainSelectTrigger } from '../../../../../common/DomainSelect/DomainSelectTrigger';
import DomainTags from '../../../../../common/DomainTags/DomainTags';
import PersonaSelect from '../../../../../common/PersonaSelect/PersonaSelect';
import { UserTeamSelectableList } from '../../../../../common/UserTeamSelectableList/UserTeamSelectableList.component';
import type { SubscriptionWebhook } from '../../../../../Settings/Team/TeamDetails/team.interface';
import { WIDGET_CLASS } from './Members.constants';
import { toDomainArray } from './Members.utils';
import type { MembersTeamInfoWidgetsProps } from './MembersTeamDetail.types';

// Sentinel id for the "None" webhook option; react-aria Select cannot round-trip
// an empty-string key, so we map it to '' on selection and back for display.
const NONE_KEY = 'none';

// A filled value renders primary; an empty/None value renders muted.
const valueTextClass = (hasValue: boolean): string =>
  hasValue ? 'tw:text-primary' : 'tw:text-tertiary';

const InfoWidget: FC<{
  label: string;
  action?: ReactNode;
  children: ReactNode;
}> = ({ label, action, children }) => (
  <Box className={WIDGET_CLASS} direction="col" gap={1}>
    <Box align="center" direction="row" gap={1}>
      <Typography
        className="tw:text-brand-secondary"
        size="text-sm"
        weight="medium">
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
      icon={<Edit01 className="tw:size-3.5 tw:text-brand-secondary" />}
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
              void onPatch({ ...team, domains: toDomainArray(next) })
            }
          />
        )
      }
      label={t('label.domain-plural')}>
      {domains.length > 0 ? (
        <DomainTags domains={domains} maxVisible={1} maxWidth="100%" />
      ) : (
        <NoneText />
      )}
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
              void onPatch({ ...team, defaultPersona: persona })
            }
          />
        )
      }
      label={t('label.persona')}>
      <Typography
        as="div"
        className={`${valueTextClass(
          Boolean(team.defaultPersona)
        )} tw:w-full tw:truncate tw:text-left`}
        data-testid="team-persona"
        size="text-sm"
        title={
          team.defaultPersona ? getEntityName(team.defaultPersona) : undefined
        }>
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
  const [error, setError] = useState<string | undefined>();

  const save = useCallback(async () => {
    const trimmed = value.trim();
    // An empty string fails the backend email @Pattern (only null/absent is
    // valid) and then makes every team GET 400; send undefined to clear it.
    if (trimmed && !EMAIL_REG_EX.test(trimmed)) {
      setError(
        t('message.field-text-is-invalid', { fieldText: t('label.email') })
      );

      return;
    }
    // Close only on a successful patch so a failed save keeps the editor open.
    if (await onPatch({ ...team, email: trimmed || undefined })) {
      setIsEditing(false);
    }
  }, [team, value, onPatch, t]);

  // Seed the field from the current email each time the popover opens.
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        setValue(team.email ?? '');
      }
      setError(undefined);
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
            <Popover containerClassName="tw:w-80" placement="bottom right">
              <Box direction="col">
                <Box className="tw:px-4 tw:py-3">
                  <Typography size="text-sm" weight="semibold">
                    {t('label.add-entity', { entity: t('label.email') })}
                  </Typography>
                </Box>
                <Divider />
                <Box className="tw:p-4">
                  <Input
                    data-testid="email-input"
                    hint={error}
                    isInvalid={Boolean(error)}
                    placeholder={t('label.enter-entity', {
                      entity: t('label.email'),
                    })}
                    size="sm"
                    value={value}
                    onChange={(val) => {
                      setValue(val);
                      setError(undefined);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        void save();
                      }
                    }}
                  />
                </Box>
                <Divider />
                <Box
                  className="tw:px-4 tw:py-3"
                  direction="row"
                  gap={2}
                  justify="end">
                  <Button
                    color="tertiary"
                    data-testid="cancel-email"
                    size="sm"
                    onPress={() => setIsEditing(false)}>
                    {t('label.cancel')}
                  </Button>
                  <Button
                    color="primary"
                    data-testid="save-email"
                    size="sm"
                    onPress={save}>
                    {t('label.save')}
                  </Button>
                </Box>
              </Box>
            </Popover>
          </PopoverTrigger>
        )
      }
      label={t('label.email')}>
      <Typography
        as="div"
        className={`${valueTextClass(
          Boolean(team.email)
        )} tw:w-full tw:truncate tw:text-left`}
        size="text-sm"
        title={team.email || undefined}>
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
  const [error, setError] = useState<string | undefined>();

  const items = useMemo<SelectItemType[]>(
    () =>
      SUBSCRIPTION_WEBHOOK_OPTIONS.map((o) => ({
        id: o.value || NONE_KEY,
        label: t(o.label),
      })),
    [t]
  );

  const keys = team.profile?.subscription
    ? Object.keys(team.profile.subscription)
    : [];
  const subKey = keys[0];
  const SubIcon = subKey
    ? getWebhookIcon(subKey as SUBSCRIPTION_WEBHOOK)
    : null;
  const subLabel = subKey
    ? t(
        SUBSCRIPTION_WEBHOOK_OPTIONS.find((o) => o.value === subKey)?.label ??
          subKey
      )
    : t('label.none');

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
      setError(undefined);
      setIsEditing(open);
    },
    [team.profile?.subscription]
  );

  const save = useCallback(async () => {
    if (webhook) {
      if (!endpoint.trim()) {
        setError(
          t('message.field-required-plural', { field: t('label.endpoint') })
        );

        return;
      }

      try {
        new URL(endpoint);
      } catch {
        setError(t('message.endpoint-should-be-valid'));

        return;
      }
    }

    const data: SubscriptionWebhook | undefined = webhook
      ? { webhook, endpoint }
      : undefined;
    // Close only on a successful patch so a failed save keeps the editor open.
    const ok = await onPatch({
      ...team,
      profile: {
        subscription: data
          ? { [data.webhook]: { endpoint: data.endpoint } }
          : undefined,
      },
    });
    if (ok) {
      setIsEditing(false);
    }
  }, [team, webhook, endpoint, onPatch, t]);

  const handleWebhookChange = useCallback((key: string | number | null) => {
    setWebhook(key && key !== NONE_KEY ? String(key) : '');
    setError(undefined);
  }, []);

  return (
    <InfoWidget
      action={
        canEdit && (
          <PopoverTrigger isOpen={isEditing} onOpenChange={handleOpenChange}>
            <EditPencil
              dataTestId="edit-subscription"
              entity={t('label.subscription')}
            />
            <Popover containerClassName="tw:w-80" placement="bottom right">
              <Box direction="col">
                <Box className="tw:px-4 tw:py-3">
                  <Typography size="text-sm" weight="semibold">
                    {t('label.add-subscription')}
                  </Typography>
                </Box>
                <Divider />
                <Box className="tw:p-4" direction="col" gap={3}>
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
                      selectedKey={webhook || NONE_KEY} // NOSONAR react-aria's controlled Select API; no non-deprecated alternative exists
                      onSelectionChange={handleWebhookChange} // NOSONAR react-aria's controlled Select API; no non-deprecated alternative exists
                    >
                      {(item) => <Select.Item key={item.id} {...item} />}
                    </Select>
                  </Box>
                  {webhook && (
                    <Input
                      data-testid="subscription-endpoint-input"
                      hint={error}
                      isInvalid={Boolean(error)}
                      placeholder={t('label.enter-entity-value', {
                        entity: t('label.endpoint'),
                      })}
                      size="sm"
                      value={endpoint}
                      onChange={(value) => {
                        setEndpoint(value);
                        setError(undefined);
                      }}
                    />
                  )}
                </Box>
                <Divider />
                <Box
                  className="tw:px-4 tw:py-3"
                  direction="row"
                  gap={2}
                  justify="end">
                  <Button
                    color="tertiary"
                    data-testid="cancel-subscription"
                    size="sm"
                    onPress={() => setIsEditing(false)}>
                    {t('label.cancel')}
                  </Button>
                  <Button
                    color="primary"
                    data-testid="save-subscription"
                    size="sm"
                    onPress={save}>
                    {t('label.save')}
                  </Button>
                </Box>
              </Box>
            </Popover>
          </PopoverTrigger>
        )
      }
      label={t('label.subscription')}>
      <Box
        align="center"
        className={`${valueTextClass(keys.length > 0)} tw:w-full`}
        direction="row"
        gap={2}>
        {SubIcon && <SubIcon aria-hidden height={16} width={16} />}
        <Typography
          as="div"
          className="tw:truncate tw:text-left"
          data-testid="subscription-value"
          size="text-sm"
          title={subKey || undefined}>
          {subLabel}
        </Typography>
      </Box>
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
            onUpdate={(next) => void onPatch({ ...team, owners: next })}>
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
          className="tw:w-full tw:min-w-0 tw:items-stretch"
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
          as="div"
          className="tw:w-full tw:truncate tw:text-left tw:text-primary"
          data-testid="team-type"
          size="text-sm"
          title={team.teamType}>
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

  // The root Organization has no meaningful team type or default persona to set;
  // both only apply to a specific team.
  const isOrganization = team.teamType === TeamType.Organization;

  return (
    <Box
      className="tw:flex-wrap tw:px-8 tw:pb-6"
      data-testid="team-info-widgets"
      direction="row"
      gap={4}>
      <DomainField canEdit={canEdit} team={team} onPatch={onPatch} />
      <OwnerField canEdit={canEdit} team={team} onPatch={onPatch} />
      {!isOrganization && <TypeField team={team} />}
      {!isOrganization && (
        <PersonaField canEdit={canEdit} team={team} onPatch={onPatch} />
      )}
      <EmailField canEdit={canEdit} team={team} onPatch={onPatch} />
      <SubscriptionField canEdit={canEdit} team={team} onPatch={onPatch} />

      {/* Total Users — triggerClassName forces the core-ui Tooltip to wrap the
          icon component in a focusable trigger so hover/focus actually opens it. */}
      <InfoWidget
        action={
          <Tooltip
            placement="left"
            title={t('message.team-distinct-user-description')}
            triggerClassName="tw:inline-flex tw:items-center">
            <InfoCircle
              aria-label={t('message.team-distinct-user-description')}
              className="tw:size-3.5 tw:text-brand-secondary"
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
