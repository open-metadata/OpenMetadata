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
  Card,
  Input,
  Tabs,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  CheckCircle,
  Copy01,
  Edit01 as Edit,
  Trash01 as Delete,
} from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import React, {
  FC,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { NO_PERMISSION_FOR_ACTION } from '../../../../../../constants/HelperTextUtil';
import { EntityType } from '../../../../../../enums/entity.enum';
import { ResourceEntity } from '../../../../../../enums/permissions.enum';
import { Persona } from '../../../../../../generated/entity/teams/persona';
import { EntityReference } from '../../../../../../generated/entity/type';
import { useClipboard } from '../../../../../../hooks/useClipBoard';
import { useEntityPermissions } from '../../../../../../hooks/useEntityPermissions/useEntityPermissions';
import {
  getPersonaByName,
  updatePersona,
} from '../../../../../../rest/PersonaAPI';
import { hardDeleteEntity } from '../../../../../../utils/DeleteWidget/DeleteWidgetUtils';
import { getEntityName } from '../../../../../../utils/EntityNameUtils';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../../utils/ToastUtils';
import DeleteModal from '../../../../../common/DeleteModal/DeleteModal';
import Loader from '../../../../../common/Loader/Loader';
import RichTextEditor from '../../../../../common/RichTextEditor/RichTextEditor';
import { EditorContentRef } from '../../../../../common/RichTextEditor/RichTextEditor.interface';
import RichTextEditorPreviewerV1 from '../../../../../common/RichTextEditor/RichTextEditorPreviewerV1';
import SubCategoryGrid from './customize/SubCategoryGrid';
import PersonaCustomizeGrid from './PersonaCustomizeGrid';
import type { PersonaDetailTab } from './Personas.types';
import PersonaUsersTab from './PersonaUsersTab';

interface PersonaDetailProps {
  fqn: string;
  activeTab: PersonaDetailTab;
  /** `governance` / `data-assets`: Customize UI lists that category's entities. */
  subCategory?: string;
  onTabChange: (tab: PersonaDetailTab) => void;
  onSelectCategory: (category: string) => void;
  onDeleted: () => void;
  onRename: (name: string) => void;
  onSetHeaderActions: (actions: React.ReactNode) => void;
  onSetHeaderTitleInput: (titleInput: React.ReactNode) => void;
  onSetHeaderTitleSuffix: (titleSuffix: React.ReactNode) => void;
}

const PersonaDetail: FC<PersonaDetailProps> = ({
  fqn,
  activeTab,
  subCategory,
  onTabChange,
  onSelectCategory,
  onDeleted,
  onRename,
  onSetHeaderActions,
  onSetHeaderTitleInput,
  onSetHeaderTitleSuffix,
}) => {
  const { t } = useTranslation();

  const [persona, setPersona] = useState<Persona>();
  const [isLoading, setIsLoading] = useState(true);

  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [isSavingDesc, setIsSavingDesc] = useState(false);
  const descEditorRef = useRef<EditorContentRef>(null);

  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [isSavingRename, setIsSavingRename] = useState(false);

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTogglingDefault, setIsTogglingDefault] = useState(false);

  // Personas are not soft-deletable here (ManageButton legacy passed deleted=false),
  // so the permission lookup is deliberately ungated.
  const {
    canEditAll,
    canEditDescription,
    canDelete: hasDeletePermission,
  } = useEntityPermissions(ResourceEntity.PERSONA, fqn);

  // Deep link that reopens this persona in the personal-space modal.
  const { onCopyToClipBoard, hasCopied } = useClipboard(
    `${globalThis.location.origin}${globalThis.location.pathname}#personas/${fqn}`
  );

  const fetchPersona = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getPersonaByName(fqn);
      setPersona(data);
      onRename(getEntityName(data));
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  }, [fqn, onRename]);

  useEffect(() => {
    fetchPersona();
  }, [fetchPersona]);

  const patchPersona = useCallback(
    async (data: Partial<Persona>) => {
      if (!persona) {
        return false;
      }
      const diff = compare(persona, { ...persona, ...data });
      try {
        const response = await updatePersona(persona.id, diff);
        setPersona(response);

        return true;
      } catch (error) {
        showErrorToast(error as AxiosError);

        return false;
      }
    },
    [persona]
  );

  const handleSaveDescription = useCallback(async () => {
    const description = descEditorRef.current?.getEditorContent() ?? '';
    setIsSavingDesc(true);
    const ok = await patchPersona({ description });
    setIsSavingDesc(false);
    if (ok) {
      setIsEditingDesc(false);
      showSuccessToast(
        t('server.update-entity-success', { entity: t('label.persona') })
      );
    }
  }, [patchPersona, t]);

  const handleSaveRename = useCallback(async () => {
    if (!renameValue.trim()) {
      return;
    }
    setIsSavingRename(true);
    const ok = await patchPersona({ displayName: renameValue.trim() });
    setIsSavingRename(false);
    if (ok) {
      setIsRenameOpen(false);
      onRename(renameValue.trim());
      showSuccessToast(
        t('server.update-entity-success', { entity: t('label.persona') })
      );
    }
  }, [renameValue, patchPersona, onRename, t]);

  const handleToggleDefault = useCallback(async () => {
    if (!persona) {
      return;
    }
    setIsTogglingDefault(true);
    const ok = await patchPersona({ default: !persona.default });
    setIsTogglingDefault(false);
    if (ok) {
      showSuccessToast(
        persona.default
          ? t('message.default-persona-removed-successfully')
          : t('message.default-persona-set-successfully')
      );
    }
  }, [persona, patchPersona, t]);

  const handleDelete = useCallback(async () => {
    if (!persona) {
      return;
    }
    setIsDeleting(true);
    const isSuccess = await hardDeleteEntity(
      getEntityName(persona),
      persona.id ?? '',
      EntityType.PERSONA
    );
    setIsDeleting(false);
    setIsDeleteOpen(false);
    if (isSuccess) {
      onDeleted();
    }
  }, [persona, onDeleted]);

  const handleUpdateUsers = useCallback(
    (users: EntityReference[]) => {
      patchPersona({ users });
    },
    [patchPersona]
  );

  // ─── Header actions injection ──────────────────────────────────────────────
  const titleInputNode = useMemo<React.ReactNode>(() => {
    if (!isRenameOpen) {
      return undefined;
    }

    return (
      <Box align="center" direction="row" gap={2}>
        <Input
          // The input renders in the parent header a render later, so focus it
          // on mount rather than from an effect here.
          // eslint-disable-next-line jsx-a11y/no-autofocus -- user just asked to rename
          autoFocus
          className="tw:text-lg tw:font-bold"
          data-testid="persona-rename-input"
          value={renameValue}
          onChange={setRenameValue}
        />
        <Button
          color="tertiary"
          isDisabled={isSavingRename}
          size="sm"
          onPress={() => {
            setIsRenameOpen(false);
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
    );
  }, [isRenameOpen, renameValue, isSavingRename, handleSaveRename, t]);

  const renameSuffix = useMemo<React.ReactNode>(() => {
    if (isRenameOpen || !persona) {
      return undefined;
    }

    return (
      <Box align="center" direction="row" gap={1}>
        <ButtonUtility
          color="tertiary"
          data-testid="copy-persona-link"
          icon={Copy01}
          size="xs"
          tooltip={String(
            hasCopied
              ? t('message.link-copy-to-clipboard')
              : t('label.copy-item', { item: t('label.url-uppercase') })
          )}
          tooltipPlacement="right"
          onPress={() => onCopyToClipBoard()}
        />
        <ButtonUtility
          color="tertiary"
          data-testid="rename-persona-btn"
          icon={Edit}
          isDisabled={!canEditDescription}
          size="xs"
          tooltip={String(
            canEditDescription ? t('label.rename') : t(NO_PERMISSION_FOR_ACTION)
          )}
          tooltipPlacement="right"
          onPress={() => {
            setRenameValue(persona.displayName || persona.name || '');
            setIsRenameOpen(true);
          }}
        />
      </Box>
    );
  }, [
    isRenameOpen,
    persona,
    canEditDescription,
    hasCopied,
    onCopyToClipBoard,
    t,
  ]);

  const actionsNode = useMemo<React.ReactNode>(() => {
    if (isRenameOpen || !persona) {
      return undefined;
    }

    const canDeletePersona = canEditAll || hasDeletePermission;

    return (
      <Box align="center" direction="row" gap={2}>
        <Button
          color="secondary"
          data-testid="set-default-persona-btn"
          iconLeading={<CheckCircle />}
          isDisabled={!canEditAll}
          isLoading={isTogglingDefault}
          size="sm"
          onPress={handleToggleDefault}>
          {persona.default
            ? t('label.remove-default')
            : t('label.set-as-default')}
        </Button>
        <ButtonUtility
          color="tertiary"
          data-testid="delete-persona-btn"
          icon={Delete}
          isDisabled={!canDeletePersona}
          size="sm"
          tooltip={String(
            canDeletePersona ? t('label.delete') : t(NO_PERMISSION_FOR_ACTION)
          )}
          tooltipPlacement="left"
          onPress={() => setIsDeleteOpen(true)}
        />
      </Box>
    );
  }, [
    isRenameOpen,
    persona,
    canEditAll,
    hasDeletePermission,
    isTogglingDefault,
    handleToggleDefault,
    t,
  ]);

  useEffect(() => {
    onSetHeaderTitleInput(titleInputNode);
    onSetHeaderTitleSuffix(renameSuffix);
    onSetHeaderActions(actionsNode);
  }, [
    titleInputNode,
    renameSuffix,
    actionsNode,
    onSetHeaderActions,
    onSetHeaderTitleInput,
    onSetHeaderTitleSuffix,
  ]);

  const tabContent = useMemo(() => {
    if (activeTab === 'users') {
      return (
        <PersonaUsersTab
          canEdit={canEditAll}
          users={persona?.users ?? []}
          onUsersChange={handleUpdateUsers}
        />
      );
    }

    if (subCategory) {
      return (
        <SubCategoryGrid
          baseCategory={subCategory}
          onSelectEntity={(entityKey) =>
            onSelectCategory(`${subCategory}/${entityKey}`)
          }
        />
      );
    }

    return <PersonaCustomizeGrid onSelectCategory={onSelectCategory} />;
  }, [
    activeTab,
    canEditAll,
    persona,
    handleUpdateUsers,
    onSelectCategory,
    subCategory,
  ]);

  if (isLoading) {
    return <Loader />;
  }

  if (!persona) {
    return null;
  }

  const descriptionPreview = persona.description ? (
    <RichTextEditorPreviewerV1 markdown={persona.description} />
  ) : (
    <Typography className="tw:text-tertiary" size="text-sm">
      {t('label.no-description')}
    </Typography>
  );

  return (
    <Box
      className="tw:px-8 tw:pb-8"
      data-testid="persona-detail-container"
      direction="col"
      gap={4}>
      <Card className="tw:flex tw:flex-col tw:gap-2 tw:mb-2 tw:p-3">
        <Box align="center" direction="row" gap={2}>
          <Typography className="tw:text-primary" weight="medium">
            {t('label.description')}
          </Typography>
          {canEditDescription && !isEditingDesc && (
            <ButtonUtility
              color="tertiary"
              data-testid="edit-persona-description-btn"
              icon={Edit}
              size="xs"
              tooltip={String(
                t('label.edit-entity', { entity: t('label.description') })
              )}
              tooltipPlacement="right"
              onPress={() => setIsEditingDesc(true)}
            />
          )}
        </Box>
        {isEditingDesc ? (
          <Box direction="col" gap={2}>
            <RichTextEditor
              className="new-form-style"
              initialValue={persona.description ?? ''}
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
          descriptionPreview
        )}
      </Card>

      <Tabs
        selectedKey={activeTab}
        onSelectionChange={(k) => onTabChange(k as PersonaDetailTab)}>
        <Tabs.List size="sm" type="underline">
          <Tabs.Item id="customize-ui">{t('label.customize-ui')}</Tabs.Item>
          <Tabs.Item id="users">
            {`${t('label.user-plural')} (${persona.users?.length ?? 0})`}
          </Tabs.Item>
        </Tabs.List>
      </Tabs>

      <Box className="tw:flex-1 tw:min-h-0 tw:p-1">{tabContent}</Box>

      <DeleteModal
        entityTitle={getEntityName(persona)}
        isDeleting={isDeleting}
        message={t('message.permanently-delete-common-message', {
          entity: getEntityName(persona).toLowerCase(),
        })}
        open={isDeleteOpen}
        onCancel={() => setIsDeleteOpen(false)}
        onDelete={handleDelete}
      />
    </Box>
  );
};

export default PersonaDetail;
