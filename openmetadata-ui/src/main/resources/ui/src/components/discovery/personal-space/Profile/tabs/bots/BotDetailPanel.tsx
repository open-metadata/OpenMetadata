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
  Badge,
  Box,
  Button,
  ButtonUtility,
  EmptyPlaceholder,
  Input,
  SelectItemType,
  Skeleton,
  Typography,
} from '@openmetadata/ui-core-components';
import { Delete, Edit } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { debounce, isEmpty, toLower, uniqBy } from 'lodash';
import React, {
  FC,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useFilter } from 'react-aria';
import { useTranslation } from 'react-i18next';
import { TERM_ADMIN } from '../../../../../../constants/constants';
import { NO_PERMISSION_FOR_ACTION } from '../../../../../../constants/HelperTextUtil';
import { useLimitStore } from '../../../../../../context/LimitsProvider/useLimitsStore';
import { ResourceEntity } from '../../../../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityType } from '../../../../../../enums/entity.enum';
import { Bot } from '../../../../../../generated/entity/bot';
import { Role } from '../../../../../../generated/entity/teams/role';
import { User } from '../../../../../../generated/entity/teams/user';
import { useAuth } from '../../../../../../hooks/authHooks';
import { useEntityPermissions } from '../../../../../../hooks/useEntityPermissions/useEntityPermissions';
import { getBotByName, updateBotDetail } from '../../../../../../rest/botsAPI';
import { searchRoles } from '../../../../../../rest/rolesAPIV1';
import {
  getAuthMechanismForBotUser,
  getUserByName,
  updateUserDetail,
} from '../../../../../../rest/userAPI';
import { getEntityName } from '../../../../../../utils/EntityNameUtils';
import { showErrorToast } from '../../../../../../utils/ToastUtils';
import DeleteEntityModal from '../../../../../common/DeleteWidget/DeleteEntityModal';
import RichTextEditor from '../../../../../common/RichTextEditor/RichTextEditor';
import { EditorContentRef } from '../../../../../common/RichTextEditor/RichTextEditor.interface';
import RichTextEditorPreviewerV1 from '../../../../../common/RichTextEditor/RichTextEditorPreviewerV1';
import type { BotsView } from './BotsPanel.types';
import BotTokenSection from './BotTokenSection';

function useDetailHeaderInjection({
  botData,
  isRenaming,
  renameValue,
  isSavingRename,
  canEditAll,
  canDelete,
  handleSaveRename,
  setIsRenaming,
  setRenameValue,
  setIsDeleteOpen,
  onSetHeaderActions,
  onSetHeaderTitleInput,
  onSetHeaderTitleSuffix,
}: {
  botData: Bot | null;
  isRenaming: boolean;
  renameValue: string;
  isSavingRename: boolean;
  canEditAll: boolean;
  canDelete: boolean;
  handleSaveRename: () => void;
  setIsRenaming: (v: boolean) => void;
  setRenameValue: (v: string) => void;
  setIsDeleteOpen: (v: boolean) => void;
  onSetHeaderActions?: (node: React.ReactNode) => void;
  onSetHeaderTitleInput?: (node: React.ReactNode) => void;
  onSetHeaderTitleSuffix?: (node: React.ReactNode) => void;
}) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!botData) {
      return;
    }

    const titleInputNode: React.ReactNode = isRenaming ? (
      <Box align="center" direction="row" gap={2}>
        <Input
          className="tw:text-lg tw:font-bold"
          data-testid="rename-input"
          value={renameValue}
          onChange={setRenameValue}
        />
        <Button
          color="tertiary"
          isDisabled={isSavingRename}
          size="sm"
          onPress={() => {
            setIsRenaming(false);
            setRenameValue('');
          }}>
          {t('label.cancel')}
        </Button>
        <Button
          color="primary"
          isDisabled={!renameValue.trim()}
          isLoading={isSavingRename}
          size="sm"
          onPress={handleSaveRename}>
          {t('label.save')}
        </Button>
      </Box>
    ) : undefined;

    const renameButtonNode: React.ReactNode = isRenaming ? undefined : (
      <ButtonUtility
        color="tertiary"
        data-testid="rename-bot-btn"
        icon={Edit}
        isDisabled={!canEditAll}
        size="xs"
        tooltip={String(
          canEditAll ? t('label.rename') : t(NO_PERMISSION_FOR_ACTION)
        )}
        onPress={() => {
          setRenameValue(botData?.displayName || botData?.name || '');
          setIsRenaming(true);
        }}
      />
    );

    const deleteButtonNode: React.ReactNode = isRenaming ? undefined : (
      <ButtonUtility
        color="tertiary"
        data-testid="delete-bot-btn"
        icon={Delete}
        isDisabled={!canDelete}
        size="xs"
        tooltip={String(
          canDelete ? t('label.delete') : t(NO_PERMISSION_FOR_ACTION)
        )}
        onPress={() => setIsDeleteOpen(true)}
      />
    );

    onSetHeaderTitleSuffix?.(renameButtonNode);
    onSetHeaderActions?.(deleteButtonNode);
    onSetHeaderTitleInput?.(titleInputNode);
  }, [
    botData,
    canDelete,
    canEditAll,
    handleSaveRename,
    isRenaming,
    isSavingRename,
    onSetHeaderActions,
    onSetHeaderTitleInput,
    onSetHeaderTitleSuffix,
    renameValue,
    setIsDeleteOpen,
    setIsRenaming,
    setRenameValue,
    t,
  ]);
}

interface BotDescriptionSectionProps {
  botData: Bot;
  canEditAll: boolean;
  isEditingDesc: boolean;
  isSavingDesc: boolean;
  descEditorRef: React.RefObject<EditorContentRef | null>;
  setIsEditingDesc: (v: boolean) => void;
  handleSaveDescription: () => void;
}

const BotDescriptionSection: FC<BotDescriptionSectionProps> = ({
  botData,
  canEditAll,
  isEditingDesc,
  isSavingDesc,
  descEditorRef,
  setIsEditingDesc,
  handleSaveDescription,
}) => {
  const { t } = useTranslation();

  return (
    <div className="tw:border tw:border-subtle tw:rounded-xl tw:p-5 tw:px-6">
      <Box align="center" direction="row" justify="between">
        <Typography size="text-sm" weight="medium">
          {t('label.description')}
        </Typography>
        {canEditAll && !isEditingDesc && (
          <Button
            color="link-color"
            data-testid="edit-description-btn"
            size="sm"
            onPress={() => setIsEditingDesc(true)}>
            {t('label.edit')}
          </Button>
        )}
      </Box>

      {isEditingDesc ? (
        <Box
          className="tw:mt-2"
          data-testid="edit-description-modal"
          direction="col"
          gap={2}>
          <RichTextEditor
            className="new-form-style"
            initialValue={botData.description ?? ''}
            ref={descEditorRef}
          />
          <Box direction="row" gap={2} justify="end">
            <Button
              color="tertiary"
              isDisabled={isSavingDesc}
              size="sm"
              onPress={() => setIsEditingDesc(false)}>
              {t('label.cancel')}
            </Button>
            <Button
              color="primary"
              isLoading={isSavingDesc}
              size="sm"
              onPress={handleSaveDescription}>
              {t('label.save')}
            </Button>
          </Box>
        </Box>
      ) : (
        <div className="tw:mt-1.5">
          {botData.description ? (
            <RichTextEditorPreviewerV1 markdown={botData.description} />
          ) : (
            <Typography className="tw:text-tertiary" size="text-sm">
              --
            </Typography>
          )}
        </div>
      )}
    </div>
  );
};

interface BotRolesSectionProps {
  botUserData: User;
  isAdminUser: boolean;
  roles: Role[];
  selectedRoles: string[];
  selectedRoleItems: SelectItemType[];
  roleItems: SelectItemType[];
  isRolesLoading: boolean;
  isRolesEdit: boolean;
  setIsRolesEdit: (v: boolean) => void;
  setSelectedRoles: React.Dispatch<React.SetStateAction<string[]>>;
  handleRolesChange: () => void;
  debouncedFetchRoles: (query?: string) => void;
  contains: (s: string, filterText: string) => boolean;
}

const BotRolesSection: FC<BotRolesSectionProps> = ({
  botUserData,
  isAdminUser,
  roleItems,
  selectedRoleItems,
  isRolesLoading,
  isRolesEdit,
  setIsRolesEdit,
  setSelectedRoles,
  handleRolesChange,
  debouncedFetchRoles,
  contains,
}) => {
  const { t } = useTranslation();

  return (
    <>
      <Typography
        className="tw:text-secondary tw:tracking-wider tw:pt-4"
        size="text-sm"
        weight="medium">
        {t('label.access')}
      </Typography>
      <div className="tw:border tw:border-subtle tw:rounded-xl">
        {/* Roles */}
        <div className="tw:p-4 tw:px-6 tw:border-b tw:border-subtle">
          <Box align="center" direction="row" justify="between">
            <Typography size="text-sm" weight="medium">
              {t('label.role-plural')}
            </Typography>
            {isAdminUser && !isRolesEdit && (
              <Button
                color="link-color"
                data-testid="edit-roles"
                size="sm"
                onPress={() => setIsRolesEdit(true)}>
                {t('label.edit-entity', {
                  entity: t('label.role-lowercase-plural'),
                })}
              </Button>
            )}
            {isRolesEdit && (
              <Box align="center" direction="row" gap={3}>
                <Button
                  color="link-gray"
                  data-testid="cancel-roles"
                  size="sm"
                  onPress={() => setIsRolesEdit(false)}>
                  {t('label.cancel')}
                </Button>
                <Button
                  color="primary"
                  data-testid="save-roles"
                  size="sm"
                  onPress={handleRolesChange}>
                  {t('label.save')}
                </Button>
              </Box>
            )}
          </Box>
          {isRolesEdit ? (
            <Box className="tw:mt-2.5 tw:max-w-lg">
              <Autocomplete
                data-testid="select-role"
                filterOption={(item, filterText) =>
                  contains(item.label || '', filterText) ||
                  contains(String(item.id), filterText)
                }
                isLoading={isRolesLoading}
                items={roleItems}
                placeholder={t('label.search-entity', {
                  entity: t('label.role-lowercase-plural'),
                })}
                selectedItems={selectedRoleItems}
                onItemCleared={(key) =>
                  setSelectedRoles((prev) =>
                    prev.filter((id) => id !== String(key))
                  )
                }
                onItemInserted={(key) =>
                  setSelectedRoles((prev) => [...prev, String(key)])
                }
                onSearch={debouncedFetchRoles}>
                {(item) => (
                  <Autocomplete.Item id={item.id} key={item.id}>
                    {item.label}
                  </Autocomplete.Item>
                )}
              </Autocomplete>
            </Box>
          ) : (
            <Box className="tw:mt-2.5 tw:flex-wrap" direction="row" gap={2}>
              {botUserData.isAdmin && (
                <Badge size="md" type="modern">
                  {TERM_ADMIN}
                </Badge>
              )}
              {botUserData.roles?.map((role) => (
                <Badge key={role.id} size="md" type="modern">
                  {getEntityName(role)}
                </Badge>
              ))}
              {!botUserData.isAdmin && isEmpty(botUserData.roles) && (
                <Typography className="tw:text-tertiary" size="text-sm">
                  {t('message.no-roles-assigned')}
                </Typography>
              )}
            </Box>
          )}
        </div>

        {/* Inherited Roles */}
        <div className="tw:p-4 tw:px-6">
          <Typography size="text-sm" weight="medium">
            {t('label.inherited-role-plural')}
          </Typography>
          <Box className="tw:mt-2.5 tw:flex-wrap" direction="row" gap={1.5}>
            {isEmpty(botUserData.inheritedRoles) ? (
              <Typography className="tw:text-tertiary" size="text-sm">
                {t('message.no-inherited-roles-found')}
              </Typography>
            ) : (
              botUserData.inheritedRoles?.map((role) => (
                <Badge color="gray" key={role.id} size="sm" type="pill-color">
                  {getEntityName(role)}
                </Badge>
              ))
            )}
          </Box>
        </div>
      </div>
    </>
  );
};

interface BotDetailPanelProps {
  fqn: string;
  onNavigate: (view: BotsView) => void;
  onRename?: (newDisplayName: string) => void;
  onSetHeaderActions?: (actions: React.ReactNode) => void;
  onSetHeaderTitleInput?: (titleInput: React.ReactNode) => void;
  onSetHeaderTitleSuffix?: (titleSuffix: React.ReactNode) => void;
}

const BotDetailPanel: FC<BotDetailPanelProps> = ({
  fqn,
  onNavigate,
  onRename,
  onSetHeaderActions,
  onSetHeaderTitleInput,
  onSetHeaderTitleSuffix,
}) => {
  const { t } = useTranslation();
  const { isAdminUser } = useAuth();
  const { contains } = useFilter({ sensitivity: 'base' });
  const { getResourceLimit } = useLimitStore();

  const [botData, setBotData] = useState<Bot | null>(null);
  const [botUserData, setBotUserData] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [isSavingDesc, setIsSavingDesc] = useState(false);
  const descEditorRef = useRef<EditorContentRef>(null);

  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [isSavingRename, setIsSavingRename] = useState(false);

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [isRolesLoading, setIsRolesLoading] = useState(false);
  const [isRolesEdit, setIsRolesEdit] = useState(false);
  const selectedRolesRef = useRef<string[]>([]);

  const { canEditAll, canDelete } = useEntityPermissions(
    ResourceEntity.BOT,
    fqn
  );

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const bot = await getBotByName(fqn, {
        fields: 'displayName,description',
      });
      const userFqn =
        bot.botUser?.fullyQualifiedName ?? bot.botUser?.name ?? '';
      const [user, authMechanism] = await Promise.all([
        getUserByName(userFqn, { fields: 'roles,inheritedRoles' }),
        getAuthMechanismForBotUser(bot.botUser?.id ?? '').catch(
          () => undefined
        ),
      ]);
      setBotData(bot);
      setBotUserData({
        ...user,
        authenticationMechanism: authMechanism,
      });

      const defaultRoles = [...(user.roles?.map((role) => role.id) || [])];
      if (user.isAdmin) {
        defaultRoles.push(toLower(TERM_ADMIN));
      }
      setSelectedRoles(defaultRoles);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  }, [fqn]);

  const fetchRoles = useCallback(async (query = '') => {
    setIsRolesLoading(true);
    try {
      const data = await searchRoles(query);
      setRoles((prev) => {
        const selected = prev.filter((r) =>
          selectedRolesRef.current.includes(r.id)
        );

        return uniqBy([...selected, ...data], 'id');
      });
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsRolesLoading(false);
    }
  }, []);

  const debouncedFetchRoles = useMemo(
    () => debounce(fetchRoles, 300),
    [fetchRoles]
  );

  useEffect(() => {
    fetchData();
    fetchRoles();
  }, [fetchData, fetchRoles]);

  useEffect(() => {
    selectedRolesRef.current = selectedRoles;
  }, [selectedRoles]);

  const handleSaveDescription = useCallback(async () => {
    if (!botData || !descEditorRef.current) {
      return;
    }

    const newDesc = descEditorRef.current.getEditorContent();
    const updated = { ...botData, description: newDesc };

    setIsSavingDesc(true);
    try {
      await updateBotDetail(botData.id, compare(botData, updated));
      setIsEditingDesc(false);
      await fetchData();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsSavingDesc(false);
    }
  }, [botData, fetchData]);

  const handleSaveRename = useCallback(async () => {
    if (!botData || !renameValue.trim()) {
      return;
    }

    const updated = { ...botData, displayName: renameValue.trim() };

    setIsSavingRename(true);
    try {
      await updateBotDetail(botData.id, compare(botData, updated));
      setIsRenaming(false);
      onRename?.(renameValue.trim());
      await fetchData();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsSavingRename(false);
    }
  }, [botData, renameValue, fetchData, onRename]);

  const handleTokenUpdate = useCallback(async () => {
    if (!botUserData) {
      return;
    }

    const [user, authMechanism] = await Promise.all([
      getUserByName(botUserData.fullyQualifiedName ?? botUserData.name ?? '', {
        fields: 'roles,inheritedRoles',
      }),
      getAuthMechanismForBotUser(botUserData.id).catch(() => undefined),
    ]);
    setBotUserData({ ...user, authenticationMechanism: authMechanism });
  }, [botUserData]);

  const handleDeleteAction = useCallback(async () => {
    await getResourceLimit('bot', true, true);
    setIsDeleteOpen(false);
    onNavigate({ type: 'list' });
  }, [onNavigate, getResourceLimit]);

  const handleUpdateUserDetails = useCallback(
    async (data: Partial<User>) => {
      if (!botUserData) {
        return;
      }

      const updated = { ...botUserData, ...data };

      try {
        await updateUserDetail(botUserData.id, compare(botUserData, updated));
        await fetchData();
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [botUserData, fetchData]
  );

  const handleRolesChange = useCallback(() => {
    const updatedRoles = selectedRoles.filter(
      (roleId) => roleId !== toLower(TERM_ADMIN)
    );
    const isAdmin = selectedRoles.includes(toLower(TERM_ADMIN));

    handleUpdateUserDetails({
      roles: updatedRoles.map((roleId) => {
        const role = roles.find((r) => r.id === roleId);

        return { id: roleId, type: 'role', name: role?.name ?? '' };
      }),
      isAdmin,
    });
    setIsRolesEdit(false);
  }, [selectedRoles, roles, handleUpdateUserDetails]);

  const roleItems = useMemo<SelectItemType[]>(() => {
    const items = roles.map((role) => ({
      id: role.id,
      label: getEntityName(role),
    }));

    if (botUserData && !botUserData.isAdmin) {
      items.push({ id: toLower(TERM_ADMIN), label: TERM_ADMIN });
    }

    return items;
  }, [roles, botUserData]);

  const selectedRoleItems = useMemo<SelectItemType[]>(
    () =>
      selectedRoles.map((id) => {
        const match = roleItems.find((r) => r.id === id);

        return { id, label: match?.label || id };
      }),
    [selectedRoles, roleItems]
  );

  useDetailHeaderInjection({
    botData,
    isRenaming,
    renameValue,
    isSavingRename,
    canEditAll,
    canDelete,
    handleSaveRename,
    setIsRenaming,
    setRenameValue,
    setIsDeleteOpen,
    onSetHeaderActions,
    onSetHeaderTitleInput,
    onSetHeaderTitleSuffix,
  });

  if (isLoading) {
    return (
      <Box className="tw:px-8 tw:pb-8" direction="col" gap={4}>
        <Skeleton className="tw:h-6 tw:w-40" />
        <Skeleton className="tw:h-20 tw:w-full" />
        <Skeleton className="tw:h-40 tw:w-full" />
      </Box>
    );
  }

  if (!botData || !botUserData) {
    return (
      <div className="tw:relative tw:h-full tw:mx-8">
        <EmptyPlaceholder
          title={t('label.no-entity-found', {
            entity: t('label.bot'),
          })}
        />
      </div>
    );
  }

  return (
    <Box
      className="tw:px-8 tw:pb-8"
      data-testid="bot-detail-container"
      direction="col"
      gap={4}>
      <BotDescriptionSection
        botData={botData}
        canEditAll={canEditAll}
        descEditorRef={descEditorRef}
        handleSaveDescription={handleSaveDescription}
        isEditingDesc={isEditingDesc}
        isSavingDesc={isSavingDesc}
        setIsEditingDesc={setIsEditingDesc}
      />

      {/* Token */}
      <BotTokenSection
        botUserData={botUserData}
        onTokenUpdate={handleTokenUpdate}
      />

      <BotRolesSection
        botUserData={botUserData}
        contains={contains}
        debouncedFetchRoles={debouncedFetchRoles}
        handleRolesChange={handleRolesChange}
        isAdminUser={isAdminUser}
        isRolesEdit={isRolesEdit}
        isRolesLoading={isRolesLoading}
        roleItems={roleItems}
        roles={roles}
        selectedRoleItems={selectedRoleItems}
        selectedRoles={selectedRoles}
        setIsRolesEdit={setIsRolesEdit}
        setSelectedRoles={setSelectedRoles}
      />

      <DeleteEntityModal
        afterDeleteAction={handleDeleteAction}
        entityId={botData.id ?? ''}
        entityName={getEntityName(botData)}
        entityType={EntityType.BOT}
        visible={isDeleteOpen}
        onCancel={() => setIsDeleteOpen(false)}
      />
    </Box>
  );
};

export default BotDetailPanel;
