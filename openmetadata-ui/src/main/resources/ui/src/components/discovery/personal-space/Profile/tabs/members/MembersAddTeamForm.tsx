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
  FieldProp,
  FieldTypes,
  FormFields,
  FormItemLabel,
  FormSelectItem,
  HookForm,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ERROR_MESSAGE } from '../../../../../../constants/constants';
import {
  EMAIL_REG_EX,
  ENTITY_NAME_REGEX,
} from '../../../../../../constants/regex.constants';
import {
  CreateTeam,
  TeamType,
} from '../../../../../../generated/api/teams/createTeam';
import { EntityReference } from '../../../../../../generated/entity/type';
import { createTeam, getTeamByName } from '../../../../../../rest/teamsAPI';
import { getIsErrorMatch } from '../../../../../../utils/APIUtils';
import { getTeamOptionsFromType } from '../../../../../../utils/TeamUtils';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../../utils/ToastUtils';
import DomainSelect from '../../../../../common/DomainSelect/DomainSelect';
import RichTextEditor from '../../../../../common/RichTextEditor/RichTextEditor';
import { EditorContentRef } from '../../../../../common/RichTextEditor/RichTextEditor.interface';
import type { MembersAddTeamFormProps } from './Members.types';

// The teamType SELECT stores the whole option object as its RHF value, so the
// form type overrides teamType with FormSelectItem and onSubmit unwraps the id.
type AddTeamFormValues = Omit<CreateTeam, 'teamType'> & {
  teamType: FormSelectItem;
};

const MembersAddTeamForm: React.FC<MembersAddTeamFormProps> = ({
  parentTeamType = TeamType.Organization,
  parentTeamFqn,
  onCancel,
  onSave,
}) => {
  const { t } = useTranslation();
  const descEditorRef = useRef<EditorContentRef>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedDomains, setSelectedDomains] = useState<EntityReference[]>([]);
  const [parentTeamId, setParentTeamId] = useState<string>();
  const [resolvedParentType, setResolvedParentType] =
    useState<TeamType>(parentTeamType);

  // Resolve the parent fqn to its id + team type once, so the new team nests
  // correctly and the team-type options reflect what the parent can contain.
  useEffect(() => {
    if (!parentTeamFqn) {
      return;
    }
    let active = true;
    getTeamByName(parentTeamFqn)
      .then((parent) => {
        if (active) {
          setParentTeamId(parent.id);
          setResolvedParentType(parent.teamType ?? parentTeamType);
        }
      })
      .catch((error) => showErrorToast(error as AxiosError));

    return () => {
      active = false;
    };
  }, [parentTeamFqn, parentTeamType]);

  const form = useForm<AddTeamFormValues>({
    defaultValues: {
      name: '',
      displayName: '',
      email: '',
      teamType: { id: TeamType.Group, label: TeamType.Group },
      isJoinable: true,
    },
  });
  const { handleSubmit } = form;

  const teamTypeOptions = useMemo(
    () =>
      getTeamOptionsFromType(resolvedParentType).map((type) => ({
        id: type,
        label: type,
      })),
    [resolvedParentType]
  );

  const nameFields: FieldProp[] = useMemo(
    () => [
      {
        name: 'name',
        label: t('label.name'),
        type: FieldTypes.TEXT,
        required: true,
        placeholder: t('label.enter-entity', { entity: t('label.name') }),
        props: { 'data-testid': 'name' },
        rules: {
          required: t('label.field-required', { field: t('label.name') }),
          minLength: {
            value: 1,
            message: t('message.entity-size-in-between', {
              entity: t('label.name'),
              min: 1,
              max: 128,
            }),
          },
          maxLength: {
            value: 128,
            message: t('message.entity-size-in-between', {
              entity: t('label.name'),
              min: 1,
              max: 128,
            }),
          },
          pattern: {
            value: ENTITY_NAME_REGEX,
            message: t('message.entity-name-validation'),
          },
        },
      },
      {
        name: 'displayName',
        label: t('label.display-name'),
        type: FieldTypes.TEXT,
        required: true,
        placeholder: t('message.enter-display-name'),
        props: { 'data-testid': 'display-name' },
        rules: {
          required: t('label.field-required', {
            field: t('label.display-name'),
          }),
          minLength: {
            value: 1,
            message: t('message.entity-size-in-between', {
              entity: t('label.display-name'),
              min: 1,
              max: 128,
            }),
          },
          maxLength: {
            value: 128,
            message: t('message.entity-size-in-between', {
              entity: t('label.display-name'),
              min: 1,
              max: 128,
            }),
          },
        },
      },
      {
        name: 'email',
        label: t('label.email'),
        type: FieldTypes.TEXT,
        required: false,
        placeholder: t('label.enter-entity', {
          entity: t('label.email-lowercase'),
        }),
        props: { 'data-testid': 'email' },
        rules: {
          pattern: {
            value: EMAIL_REG_EX,
            message: t('message.field-text-is-invalid', {
              fieldText: t('label.email'),
            }),
          },
        },
      },
      {
        name: 'teamType',
        label: t('label.team-type'),
        type: FieldTypes.SELECT,
        required: false,
        props: {
          'data-testid': 'team-selector',
          options: teamTypeOptions,
          placeholder: t('message.select-team'),
        },
      },
      {
        name: 'isJoinable',
        label: t('label.public-team'),
        type: FieldTypes.SWITCH,
        required: false,
        helperText: t('message.access-to-collaborate'),
        props: { 'data-testid': 'isJoinable-switch-button' },
      },
    ],
    [t, teamTypeOptions]
  );

  const onSubmit = async (data: AddTeamFormValues) => {
    const description = descEditorRef.current?.getEditorContent() ?? '';

    setIsSaving(true);
    try {
      await createTeam({
        ...data,
        name: data.name.trim(),
        displayName: data.displayName?.trim(),
        teamType: (data.teamType?.id as TeamType) ?? TeamType.Group,
        // Empty string fails the backend email @Pattern; omit when blank.
        email: data.email?.trim() || undefined,
        description,
        // The API takes parent team ids so the new team nests under the current
        // team instead of becoming top-level.
        parents: parentTeamId ? [parentTeamId] : undefined,
        domains: selectedDomains.length
          ? (selectedDomains
              .map((domain) => domain.fullyQualifiedName)
              .filter(Boolean) as string[])
          : undefined,
      });
      showSuccessToast(
        t('server.create-entity-success', { entity: t('label.team') })
      );
      onSave();
    } catch (error) {
      showErrorToast(
        getIsErrorMatch(error as AxiosError, ERROR_MESSAGE.alreadyExist)
          ? t('server.entity-already-exist', {
              entity: t('label.team'),
              entityPlural: t('label.team-lowercase-plural'),
              name: data.name.trim(),
            })
          : (error as AxiosError)
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Box className="tw:h-full tw:min-h-0" direction="col" justify="between">
      <HookForm
        className="tw:flex tw:min-h-0 tw:flex-1 tw:flex-col"
        form={form}>
        <Box
          className="tw:flex-1 tw:overflow-y-auto tw:px-8 tw:pb-8"
          data-testid="add-team-container"
          direction="col">
          <Box className="tw:max-w-[50%] tw:w-full" direction="col" gap={5}>
            <FormFields fields={nameFields} />

            <Box direction="col" gap={1}>
              <FormItemLabel label={t('label.domain-plural')} />
              <DomainSelect
                multiple
                data-testid="domain-select"
                selectedDomain={selectedDomains}
                onUpdate={(domains) => {
                  if (Array.isArray(domains)) {
                    setSelectedDomains(domains);

                    return;
                  }
                  setSelectedDomains(domains ? [domains] : []);
                }}
              />
            </Box>

            <Box direction="col" gap={1}>
              <Typography
                className="tw:text-secondary"
                size="text-sm"
                weight="medium">
                {t('label.description')}
              </Typography>
              <RichTextEditor
                className="new-form-style"
                data-testid="description"
                placeHolder={t('message.write-your-description')}
                ref={descEditorRef}
              />
            </Box>
          </Box>
        </Box>
      </HookForm>

      <Box
        className="tw:shrink-0 tw:border-t tw:border-secondary tw:bg-primary tw:px-6 tw:py-4"
        data-testid="add-team-footer"
        direction="row"
        gap={3}
        justify="end">
        <Button color="tertiary" data-testid="cancel-btn" onPress={onCancel}>
          {t('label.cancel')}
        </Button>
        <Button
          color="primary"
          data-testid="submit-btn"
          isLoading={isSaving}
          onPress={() => handleSubmit(onSubmit)()}>
          {t('label.save')}
        </Button>
      </Box>
    </Box>
  );
};

export default MembersAddTeamForm;
