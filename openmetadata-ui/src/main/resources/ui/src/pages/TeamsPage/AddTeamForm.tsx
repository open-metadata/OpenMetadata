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

import { PlusOutlined } from '@ant-design/icons';
import { Button, Form, Input, Modal } from 'antd';
import { useForm } from 'antd/lib/form/Form';
import { AxiosError } from 'axios';
import { toLower, trim } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Select } from '../../components/common/AntdCompat';
import { DomainLabel } from '../../components/common/DomainLabel/DomainLabel.component';
import { VALIDATION_MESSAGES } from '../../constants/constants';
import { NAME_FIELD_RULES } from '../../constants/Form.constants';
import { EntityType } from '../../enums/entity.enum';
import {
    EntityReference,
    Team,
    TeamType
} from '../../generated/entity/teams/team';
import { useDomainStore } from '../../hooks/useDomainStore';
import {
    FieldProp,
    FieldTypes,
    FormItemLayout
} from '../../interface/FormUtils.interface';
import { getTeams } from '../../rest/teamsAPI';
import { getField } from '../../utils/formUtils';
import { getTeamOptionsFromType } from '../../utils/TeamUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import { AddTeamFormType } from './AddTeamForm.interface';
;

const AddTeamForm: React.FC<AddTeamFormType> = ({
  visible,
  onCancel,
  onSave,
  isLoading,
  parentTeamType,
}) => {
  const { t } = useTranslation();
  const [form] = useForm();
  const [description, setDescription] = useState<string>('');
  const [allTeam, setAllTeam] = useState<Team[]>([]);
  const { activeDomainEntityRef } = useDomainStore();
  const selectedDomain =
    Form.useWatch<EntityReference[]>('domains', form) ?? [];

  const teamTypeOptions = useMemo(() => {
    return getTeamOptionsFromType(parentTeamType).map((type) => ({
      label: type,
      value: type,
    }));
  }, [parentTeamType]);

  const handleSubmit = (data: Team) => {
    data = {
      ...data,
      name: trim(data.name),
      displayName: trim(data.displayName),
      description,
    };
    onSave(data);
  };

  const fetchAllTeams = async () => {
    try {
      const { data } = await getTeams();

      setAllTeam(data);
    } catch (error) {
      showErrorToast(error as AxiosError, t('server.unexpected-response'));
    }
  };

  const domainsField: FieldProp = {
    name: 'domains',
    id: 'root/domains',
    required: false,
    label: t('label.domain-plural'),
    type: FieldTypes.DOMAIN_SELECT,
    props: {
      selectedDomain: activeDomainEntityRef
        ? [activeDomainEntityRef]
        : undefined,
      multiple: true,
      children: (
        <Button
          data-testid="add-domain"
          icon={<PlusOutlined style={{ color: 'white', fontSize: '12px' }} />}
          size="small"
          type="primary"
        />
      ),
    },
    formItemLayout: FormItemLayout.HORIZONTAL,
    formItemProps: {
      valuePropName: 'selectedDomain',
      trigger: 'onUpdate',
      initialValue: activeDomainEntityRef ? [activeDomainEntityRef] : undefined,
    },
  };

  const isJoinableField: FieldProp = {
    name: 'isJoinable',
    label: t('label.public-team'),
    type: FieldTypes.SWITCH,
    required: false,
    props: {
      'data-testid': 'isJoinable-switch-button',
    },
    id: 'isJoinable-switch-button',
    formItemLayout: FormItemLayout.HORIZONTAL,
    helperText: t('message.access-to-collaborate'),
  };

  const descriptionField: FieldProp = useMemo(
    () => ({
      name: 'description',
      required: false,
      label: t('label.description'),
      id: 'root/description',
      type: FieldTypes.DESCRIPTION,
      props: {
        'data-testid': 'description',
        initialValue: '',
        style: {
          marginBottom: 0,
        },
        onTextChange: (value: string) => setDescription(value),
      },
    }),
    []
  );

  useEffect(() => {
    if (visible) {
      fetchAllTeams();
    }
  }, [visible]);

  return (
    <Modal
      centered
      closable={false}
      confirmLoading={isLoading}
      maskClosable={false}
      okButtonProps={{
        form: 'add-team-form',
        type: 'primary',
        htmlType: 'submit',
      }}
      okText={t('label.save')}
      open={visible}
      title={t('label.add-entity', { entity: t('label.team') })}
      width={750}
      onCancel={onCancel}>
      <Form
        form={form}
        id="add-team-form"
        initialValues={{
          teamType: TeamType.Group,
          isJoinable: false,
        }}
        layout="vertical"
        name="add-team-nest-messages"
        validateMessages={VALIDATION_MESSAGES}
        onFinish={handleSubmit}>
        <Form.Item
          label={t('label.name')}
          name="name"
          rules={[
            ...NAME_FIELD_RULES,
            {
              validator: (_, value) => {
                if (
                  allTeam.some((team) => toLower(team.name) === toLower(value))
                ) {
                  return Promise.reject(
                    t('message.entity-already-exists', {
                      entity: t('label.name'),
                    })
                  );
                }

                return Promise.resolve();
              },
            },
          ]}>
          <Input
            data-testid="name"
            placeholder={t('label.enter-entity', { entity: t('label.name') })}
          />
        </Form.Item>
        <Form.Item
          label={t('label.display-name')}
          name="displayName"
          rules={[
            {
              required: true,
              type: 'string',
              whitespace: true,
              min: 1,
              max: 128,
            },
          ]}>
          <Input
            data-testid="display-name"
            placeholder={t('message.enter-display-name')}
          />
        </Form.Item>
        <Form.Item
          label={t('label.email')}
          name="email"
          rules={[{ type: 'email' }]}>
          <Input
            data-testid="email"
            placeholder={t('label.enter-entity', {
              entity: t('label.email-lowercase'),
            })}
          />
        </Form.Item>
        <Form.Item label={t('label.team-type')} name="teamType">
          <Select
            data-testid="team-selector"
            options={teamTypeOptions}
            placeholder={t('message.select-team')}
          />
        </Form.Item>
        {getField(isJoinableField)}
        {getField(descriptionField)}
        <div className="m-t-xs">
          {getField(domainsField)}
          {selectedDomain && (
            <DomainLabel
              multiple
              domains={selectedDomain}
              entityFqn=""
              entityId=""
              entityType={EntityType.GLOSSARY}
              hasPermission={false}
            />
          )}
        </div>
      </Form>
    </Modal>
  );
};

export default AddTeamForm;
