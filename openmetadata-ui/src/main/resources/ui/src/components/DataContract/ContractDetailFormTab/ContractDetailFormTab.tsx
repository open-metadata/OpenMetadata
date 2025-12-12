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
import Icon from '@ant-design/icons';
import { Button, Card, Form, Typography } from 'antd';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as RightIcon } from '../../../assets/svg/right-arrow.svg';
import { EntityType } from '../../../enums/entity.enum';
import { DataContract } from '../../../generated/entity/data/dataContract';
import { useEntityRules } from '../../../hooks/useEntityRules';
import { FieldProp, FieldTypes } from '../../../interface/FormUtils.interface';
import { getEntityName } from '../../../utils/EntityUtils';
import { generateFormFields } from '../../../utils/formUtils';
import './contract-detail-form-tab.less';

export const ContractDetailFormTab: React.FC<{
  initialValues?: Partial<DataContract>;
  onNext: () => void;
  onChange: (formData: Partial<DataContract>) => void;
  buttonProps: {
    nextLabel?: string;
    isNextVisible?: boolean;
  };
}> = ({
  initialValues,
  onNext,
  onChange,
  buttonProps: { nextLabel, isNextVisible = true },
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const { entityRules } = useEntityRules(EntityType.TABLE);

  const fields: FieldProp[] = [
    {
      label: t('label.contract-title'),
      id: 'name',
      name: 'name',
      type: FieldTypes.TEXT,
      required: true,
      placeholder: t('label.please-enter-entity-name', {
        entity: t('label.contract'),
      }),
      props: {
        'data-testid': 'contract-name',
      },
    },
    {
      label: t('label.owner-plural'),
      name: 'owners',
      id: 'root/owner',
      type: FieldTypes.USER_TEAM_SELECT_INPUT,
      required: false,
      props: {
        owner: initialValues?.owners,
        hasPermission: true,
        multiple: {
          user: entityRules.canAddMultipleUserOwners,
          team: entityRules.canAddMultipleTeamOwner,
        },
        placeholder: t('label.please-select-entity', {
          entity: t('label.owner-plural'),
        }),
      },
      formItemProps: {
        valuePropName: 'owners',
        trigger: 'onUpdate',
      },
    },
    {
      label: t('label.description'),
      id: 'description',
      name: 'description',
      type: FieldTypes.DESCRIPTION,
      required: false,
      props: {
        'data-testid': 'contract-description',
        initialValue: initialValues?.description ?? '',
      },
    },
  ];

  useEffect(() => {
    if (initialValues) {
      form.setFieldsValue({
        name: getEntityName(initialValues),
        description: initialValues.description,
        owners: initialValues.owners,
      });
    }
  }, [initialValues]);

  return (
    <>
      <Card className="container bg-grey p-box">
        <div>
          <Typography.Text className="contract-detail-form-tab-title">
            {t('label.contract-detail-plural')}
          </Typography.Text>
          <Typography.Paragraph className="contract-detail-form-tab-description">
            {t('message.contract-detail-plural-description')}
          </Typography.Paragraph>
        </div>

        <div className="contract-form-content-container">
          <Form
            className="new-form-style contract-detail-form"
            form={form}
            layout="vertical"
            onValuesChange={onChange}>
            {generateFormFields(fields)}
          </Form>
        </div>
      </Card>
      {isNextVisible && (
        <div className="d-flex justify-end m-t-md">
          <Button
            className="contract-next-button"
            htmlType="submit"
            type="primary"
            onClick={onNext}>
            {nextLabel ?? t('label.next')}
            <Icon component={RightIcon} />
          </Button>
        </div>
      )}
    </>
  );
};
