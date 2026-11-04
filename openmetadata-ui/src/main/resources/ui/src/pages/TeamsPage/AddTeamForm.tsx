/*
 *  Copyright 2022 Collate.
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
  FieldTypes,
  FormField,
  FormFields,
  FormItemLabel,
  HookForm,
  Input,
  Select,
  SimpleModal,
} from '@openmetadata/ui-core-components';
import { Plus } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { toLower, trim } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { RegisterOptions, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { DomainLabel } from '../../components/common/DomainLabel/DomainLabel.component';
import DomainSelectableList from '../../components/common/DomainSelectableList/DomainSelectableList.component';
import RichTextEditor from '../../components/common/RichTextEditor/RichTextEditor';
import {
  DISPLAY_NAME_FIELD_REGISTER_RULES,
  NAME_FIELD_REGISTER_RULES,
} from '../../constants/Form.constants';
import { EMAIL_REG_EX } from '../../constants/regex.constants';
import { EntityType } from '../../enums/entity.enum';
import {
  EntityReference,
  Team,
  TeamType,
} from '../../generated/entity/teams/team';
import { useDomainStore } from '../../hooks/useDomainStore';
import { getTeams } from '../../rest/teamsAPI';
import { getTeamOptionsFromType } from '../../utils/TeamUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import { AddTeamFormType } from './AddTeamForm.interface';

interface AddTeamFormValues {
  name: string;
  displayName: string;
  email: string;
  teamType: TeamType;
  isJoinable: boolean;
  domains?: EntityReference[];
}

type TextFieldName = 'name' | 'displayName' | 'email';

const AddTeamForm: React.FC<AddTeamFormType> = ({
  visible,
  onCancel,
  onSave,
  isLoading,
  parentTeamType,
}) => {
  const { t } = useTranslation();
  const { activeDomainEntityRef } = useDomainStore();
  // Validate while typing, as the antd form did.
  const form = useForm<AddTeamFormValues>({
    mode: 'onChange',
    defaultValues: {
      name: '',
      displayName: '',
      email: '',
      teamType: TeamType.Group,
      isJoinable: false,
      domains: activeDomainEntityRef ? [activeDomainEntityRef] : undefined,
    },
  });
  const [description, setDescription] = useState<string>('');
  const [allTeam, setAllTeam] = useState<Team[]>([]);
  const selectedDomain = form.watch('domains') ?? [];

  const teamTypeItems = useMemo(
    () =>
      getTeamOptionsFromType(parentTeamType).map((type) => ({
        id: type,
        label: type,
      })),
    [parentTeamType]
  );

  const handleSubmit = (data: AddTeamFormValues) => {
    onSave({
      ...data,
      name: trim(data.name),
      displayName: trim(data.displayName),
      email: data.email || undefined,
      description,
    } as Team);
  };

  const fetchAllTeams = async () => {
    try {
      const { data } = await getTeams();
      setAllTeam(data);
    } catch (error) {
      showErrorToast(error as AxiosError, t('server.unexpected-response'));
    }
  };

  const renderTextField = (
    name: TextFieldName,
    label: string,
    placeholder: string,
    testId: string,
    rules: RegisterOptions<AddTeamFormValues, TextFieldName>
  ) => (
    <FormField control={form.control} name={name} rules={rules}>
      {({ field, fieldState }) => (
        <Input
          hint={fieldState.error?.message}
          inputDataTestId={testId}
          isInvalid={fieldState.invalid}
          isRequired={Boolean(rules.required)}
          label={label}
          placeholder={placeholder}
          value={field.value}
          onBlur={field.onBlur}
          onChange={field.onChange}
        />
      )}
    </FormField>
  );

  useEffect(() => {
    if (visible) {
      fetchAllTeams();
    }
  }, [visible]);

  return (
    <SimpleModal
      data-testid="add-team-modal"
      isDismissable={false}
      isOkLoading={isLoading}
      isOpen={visible}
      okText={t('label.save')}
      title={t('label.add-entity', { entity: t('label.team') })}
      width={750}
      onCancel={onCancel}
      onOk={form.handleSubmit(handleSubmit)}>
      <HookForm
        className="tw:flex tw:flex-col tw:gap-4"
        form={form}
        id="add-team-form"
        onSubmit={form.handleSubmit(handleSubmit)}>
        {renderTextField(
          'name',
          t('label.name'),
          t('label.enter-entity', { entity: t('label.name') }),
          'name',
          {
            ...NAME_FIELD_REGISTER_RULES,
            validate: (value) =>
              !allTeam.some((team) => toLower(team.name) === toLower(value)) ||
              t('message.entity-already-exists', {
                entity: t('label.name'),
              }),
          }
        )}
        {renderTextField(
          'displayName',
          t('label.display-name'),
          t('message.enter-display-name'),
          'display-name',
          {
            ...DISPLAY_NAME_FIELD_REGISTER_RULES,
            validate: (value) =>
              Boolean(trim(value)) ||
              t('message.field-text-is-required', {
                fieldText: t('label.display-name'),
              }),
            required: t('message.field-text-is-required', {
              fieldText: t('label.display-name'),
            }),
          }
        )}
        {renderTextField(
          'email',
          t('label.email'),
          t('label.enter-entity', { entity: t('label.email-lowercase') }),
          'email',
          {
            pattern: {
              value: EMAIL_REG_EX,
              message: t('message.entity-is-not-valid', {
                entity: t('label.email'),
              }),
            },
          }
        )}
        <FormField control={form.control} name="teamType">
          {({ field }) => (
            <Select
              data-testid="team-selector"
              items={teamTypeItems}
              label={t('label.team-type')}
              placeholder={t('message.select-team')}
              value={field.value ?? null}
              onChange={(key) =>
                key !== null && field.onChange(key as TeamType)
              }>
              {(item) => <Select.Item id={item.id} label={item.label} />}
            </Select>
          )}
        </FormField>
        <FormFields
          fields={[
            {
              name: 'isJoinable',
              label: t('label.public-team'),
              type: FieldTypes.SWITCH,
              id: 'isJoinable-switch-button',
              helperText: t('message.access-to-collaborate'),
              props: { 'data-testid': 'isJoinable-switch-button' },
            },
          ]}
        />
        <Box direction="col" gap={1}>
          <FormItemLabel label={t('label.description')} />
          <RichTextEditor
            data-testid="description"
            initialValue=""
            onTextChange={setDescription}
          />
        </Box>
        <FormField control={form.control} name="domains">
          {({ field }) => (
            <Box direction="col" gap={1}>
              <Box align="center" gap={2}>
                <FormItemLabel label={t('label.domain-plural')} />
                <DomainSelectableList
                  hasPermission
                  multiple
                  selectedDomain={field.value}
                  onUpdate={(domains) =>
                    Promise.resolve(
                      field.onChange(
                        domains === undefined
                          ? undefined
                          : ([] as EntityReference[]).concat(domains)
                      )
                    )
                  }>
                  <Button
                    aria-label={t('label.add-entity', {
                      entity: t('label.domain'),
                    })}
                    color="primary"
                    data-testid="add-domain"
                    iconLeading={Plus}
                    size="xs"
                  />
                </DomainSelectableList>
              </Box>
              {selectedDomain.length > 0 && (
                <DomainLabel
                  multiple
                  domains={selectedDomain}
                  entityFqn=""
                  entityId=""
                  entityType={EntityType.GLOSSARY}
                  hasPermission={false}
                />
              )}
            </Box>
          )}
        </FormField>
      </HookForm>
    </SimpleModal>
  );
};

export default AddTeamForm;
