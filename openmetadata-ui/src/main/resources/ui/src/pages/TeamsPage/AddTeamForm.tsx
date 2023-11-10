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

import { Form, Input, Modal, Select } from 'antd';
import { AxiosError } from 'axios';
import { toLower, trim } from 'lodash';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import RichTextEditor from '../../components/common/RichTextEditor/RichTextEditor';
import { EditorContentRef } from '../../components/common/RichTextEditor/RichTextEditor.interface';
import { VALIDATION_MESSAGES } from '../../constants/constants';
import { ENTITY_NAME_REGEX } from '../../constants/regex.constants';
import { Team, TeamType } from '../../generated/entity/teams/team';
import { getTeams } from '../../rest/teamsAPI';
import { getTeamOptionsFromType } from '../../utils/TeamUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import { AddTeamFormType } from './AddTeamForm.interface';

const AddTeamForm: React.FC<AddTeamFormType> = ({
  visible,
  onCancel,
  onSave,
  isLoading,
  parentTeamType,
}) => {
  const { t } = useTranslation();
  const [description, setDescription] = useState<string>('');
  const [allTeam, setAllTeam] = useState<Team[]>([]);
  const markdownRef = useRef<EditorContentRef>();

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
      open={visible}
      title={t('label.add-entity', { entity: t('label.team') })}
      width={750}
      onCancel={onCancel}>
      <Form
        id="add-team-form"
        initialValues={{
          teamType: TeamType.Group,
        }}
        layout="vertical"
        name="add-team-nest-messages"
        validateMessages={VALIDATION_MESSAGES}
        onFinish={handleSubmit}>
        <Form.Item
          label={t('label.name')}
          name="name"
          rules={[
            {
              required: true,
              type: 'string',
              min: 1,
              max: 128,
              whitespace: true,
            },
            {
              pattern: ENTITY_NAME_REGEX,
              message: t('message.entity-name-validation'),
            },
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
        <Form.Item
          label={t('label.description')}
          name="description"
          style={{
            marginBottom: 0,
          }}>
          <RichTextEditor
            data-testid="description"
            initialValue=""
            ref={markdownRef}
            onTextChange={(value) => setDescription(value)}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default AddTeamForm;
