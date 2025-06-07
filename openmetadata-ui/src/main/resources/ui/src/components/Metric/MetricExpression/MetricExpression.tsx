/*
 *  Copyright 2024 Collate.
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
import { Button, Card, Col, Form, Row, Tooltip, Typography } from 'antd';
import { FC, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { DE_ACTIVE_COLOR } from '../../../constants/constants';
import { Language } from '../../../generated/api/data/createMetric';
import { Metric } from '../../../generated/entity/data/metric';
import { FieldProp, FieldTypes } from '../../../interface/FormUtils.interface';
import { generateFormFields } from '../../../utils/formUtils';
import { getMetricExpressionLanguageName } from '../../../utils/MetricEntityUtils/MetricUtils';
import { useGenericContext } from '../../Customization/GenericProvider/GenericProvider';
import SchemaEditor from '../../Database/SchemaEditor/SchemaEditor';

const MetricExpression: FC = () => {
  const [form] = Form.useForm();
  const { t } = useTranslation();
  const { data: metricDetails, onUpdate: onMetricUpdate } =
    useGenericContext<Metric>();

  const [isUpdating, setIsUpdating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const selectedLanguage = Form.useWatch('language', form);

  const handleSubmit = async (values: Metric['metricExpression']) => {
    try {
      setIsUpdating(true);

      const updatedData = {
        ...metricDetails,
        metricExpression: {
          ...metricDetails?.metricExpression,
          code: values?.code,
          language: values?.language,
        },
      };

      if (onMetricUpdate) {
        await onMetricUpdate(updatedData, 'metricExpression');
      }
    } catch (error) {
      // do nothing as error is handled in the parent component
    } finally {
      setIsUpdating(false);
      setIsEditing(false);
    }
  };

  const languageField: FieldProp = useMemo(
    () => ({
      name: 'language',
      required: false,
      label: t('label.language'),
      id: 'root/language',
      type: FieldTypes.SELECT,
      props: {
        'data-testid': 'language',
        options: Object.values(Language).map((language) => ({
          key: language,
          label: language,
          value: language,
        })),
        placeholder: `${t('label.select-field', {
          field: t('label.language'),
        })}`,
        showSearch: true,
        allowClear: true,
        filterOption: (input: string, option: { label: string }) => {
          return (option?.label ?? '')
            .toLowerCase()
            .includes(input.toLowerCase());
        },
      },
    }),
    []
  );

  const expressionTitle = (
    <div className="d-flex justify-between w-full">
      <Typography>
        {isEditing
          ? t('label.edit-entity', { entity: t('label.expression') })
          : metricDetails?.metricExpression?.language ?? t('label.expression')}
      </Typography>
      {!isEditing && !metricDetails.deleted && (
        <Tooltip
          title={t('label.edit-entity', {
            entity: t('label.expression'),
          })}>
          <Button
            className="flex-center p-0"
            data-testid="edit-expression-button"
            icon={<EditIcon color={DE_ACTIVE_COLOR} width="14px" />}
            loading={isUpdating}
            size="small"
            type="text"
            onClick={() => setIsEditing(true)}
          />
        </Tooltip>
      )}
    </div>
  );

  return (
    <Card
      className="m-b-md"
      data-testid="code-component"
      title={expressionTitle}>
      {isEditing ? (
        <Form
          form={form}
          initialValues={{
            code: metricDetails?.metricExpression?.code,
            language: metricDetails?.metricExpression?.language,
          }}
          layout="vertical"
          onFinish={handleSubmit}>
          {generateFormFields([languageField])}
          <Form.Item
            data-testid="expression-code-container"
            label={t('label.code')}
            name="code"
            trigger="onChange">
            <SchemaEditor
              className="custom-query-editor full-screen-editor-height custom-code-mirror-theme"
              mode={{ name: getMetricExpressionLanguageName(selectedLanguage) }}
              showCopyButton={false}
            />
          </Form.Item>
          <Row justify="end">
            <Col>
              <Button
                data-testid="cancel-button"
                disabled={isUpdating}
                type="link"
                onClick={() => setIsEditing(false)}>
                {t('label.cancel')}
              </Button>
            </Col>
            <Col>
              <Button
                data-testid="update-button"
                htmlType="submit"
                loading={isUpdating}
                type="primary">
                {t('label.update')}
              </Button>
            </Col>
          </Row>
        </Form>
      ) : (
        <SchemaEditor
          editorClass="custom-code-mirror-theme full-screen-editor-height"
          mode={{
            name: getMetricExpressionLanguageName(
              metricDetails?.metricExpression?.language
            ),
          }}
          options={{
            styleActiveLine: false,
            readOnly: true,
          }}
          value={metricDetails?.metricExpression?.code}
        />
      )}
    </Card>
  );
};

export default MetricExpression;
