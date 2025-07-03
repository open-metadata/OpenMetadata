/*
 *  Copyright 2025 Collate.
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
import { Card, Form } from 'antd';
import { useTranslation } from 'react-i18next';
import { FieldProp, FieldTypes } from '../../../interface/FormUtils.interface';
import { generateFormFields } from '../../../utils/formUtils';

export const ContractDetailFormTab = () => {
  const { t } = useTranslation();
  const fields: FieldProp[] = [
    {
      label: t('label.contract-title'),
      id: 'contractTitle',
      name: 'contractTitle',
      type: FieldTypes.TEXT,
      required: true,
    },
    {
      label: t('label.contract-description'),
      id: 'contractDescription',
      name: 'contractDescription',
      type: FieldTypes.DESCRIPTION,
      required: true,
    },
    {
      label: t('label.owner'),
      id: 'owner',
      name: 'owner',
      type: FieldTypes.USER_TEAM_SELECT,
      required: true,
    },
    {
      label: t('label.enable-incident-management'),
      id: 'enableIncidentManagement',
      name: 'enableIncidentManagement',
      type: FieldTypes.SWITCH,
      required: true,
    },
  ];

  return (
    <div className="container">
      <Card title={t('label.contract-detail-plural')}>
        <Form>{generateFormFields(fields)}</Form>
      </Card>
    </div>
  );
};
