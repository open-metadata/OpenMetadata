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
import { FormProps } from 'antd/lib/form/Form';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as LeftOutlined } from '../../../assets/svg/left-arrow.svg';
import { ReactComponent as RightIcon } from '../../../assets/svg/right-arrow.svg';
import { DataContract } from '../../../generated/entity/data/dataContract';
import { FieldProp, FieldTypes } from '../../../interface/FormUtils.interface';
import { generateFormFields } from '../../../utils/formUtils';

export const ContractSecurityFormTab: React.FC<{
  onChange: (data: Partial<DataContract>) => void;
  onNext: () => void;
  onPrev: () => void;
  initialValues?: Partial<DataContract>;
  nextLabel?: string;
  prevLabel?: string;
}> = ({ onChange, onNext, onPrev, nextLabel, prevLabel, initialValues }) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();

  const fields: FieldProp[] = useMemo(
    () => [
      {
        label: t('label.access-policy-name'),
        id: 'accessPolicy',
        name: 'accessPolicy',
        type: FieldTypes.TEXT,
        required: false,
        props: {
          'data-testid': 'access-policy-input',
        },
      },
      {
        label: t('label.data-classification'),
        id: 'dataClassification',
        name: 'dataClassification',
        type: FieldTypes.TEXT,
        required: false,
        props: {
          'data-testid': 'data-classification-input',
        },
      },
    ],
    []
  );

  const handleFormChange: FormProps['onValuesChange'] = (_, values) => {
    onChange({
      security: values,
    });
  };

  useEffect(() => {
    if (initialValues) {
      form.setFieldsValue({
        accessPolicy: initialValues.security?.accessPolicy,
        dataClassification: initialValues.security?.dataClassification,
      });
    }
  }, [initialValues]);

  return (
    <>
      <Card className="container bg-grey p-box">
        <div>
          <Typography.Text className="contract-detail-form-tab-title">
            {t('label.security')}
          </Typography.Text>
          <Typography.Paragraph className="contract-detail-form-tab-description">
            {t('message.data-contract-security-description')}
          </Typography.Paragraph>
        </div>

        <div className="contract-form-content-container">
          <Form
            className="new-form-style contract-security-form"
            form={form}
            layout="vertical"
            onValuesChange={handleFormChange}>
            {generateFormFields(fields)}
          </Form>
        </div>
      </Card>
      <div className="d-flex justify-between m-t-md">
        <Button
          className="contract-prev-button"
          icon={<LeftOutlined height={22} width={20} />}
          onClick={onPrev}>
          {prevLabel ?? t('label.previous')}
        </Button>
        <Button
          className="contract-next-button"
          type="primary"
          onClick={onNext}>
          {nextLabel ?? t('label.next')}
          <Icon component={RightIcon} />
        </Button>
      </div>
    </>
  );
};
