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

import { Button, Card, Col, Form, Row, Select, Typography } from 'antd';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './observability-form-trigger-item.less';
import { ObservabilityFormTriggerItemProps } from './ObservabilityFormTriggerItem.interface';

function ObservabilityFormTriggerItem({
  heading,
  subHeading,
  buttonLabel,
  filterResources,
}: Readonly<ObservabilityFormTriggerItemProps>) {
  const [editMode, setEditMode] = useState<boolean>(false);
  const { t } = useTranslation();

  const handleAddTriggerClick = useCallback(() => {
    setEditMode(true);
  }, []);

  const resourcesOptions = useMemo(
    () =>
      filterResources.map((resource) => ({
        label: resource.name,
        value: resource.name,
      })),
    [filterResources]
  );

  return (
    <Card className="trigger-item-container">
      <Row gutter={[8, 8]}>
        <Col span={24}>
          <Typography.Text>{heading}</Typography.Text>
        </Col>
        <Col span={24}>
          <Typography.Text className="text-xs text-grey-muted">
            {subHeading}
          </Typography.Text>
        </Col>
        <Col span={24}>
          {editMode ? (
            <Form.Item
              required
              messageVariables={{
                fieldName: t('label.data-asset-plural'),
              }}
              name={['filteringRules', 'resources']}>
              <Select
                className="w-full"
                data-testid="triggerConfig-type"
                options={resourcesOptions}
                placeholder={t('label.select-field', {
                  field: t('label.data-asset-plural'),
                })}
              />
            </Form.Item>
          ) : (
            <Button type="primary" onClick={handleAddTriggerClick}>
              {buttonLabel}
            </Button>
          )}
        </Col>
      </Row>
    </Card>
  );
}

export default ObservabilityFormTriggerItem;
