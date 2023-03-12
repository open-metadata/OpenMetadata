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

import { Checkbox, Col, Form, Input, Modal, Row, Select } from 'antd';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ELASTIC_SEARCH_INDEX_ENTITIES,
  ELASTIC_SEARCH_INITIAL_VALUES,
  RECREATE_INDEX_OPTIONS,
} from '../../constants/elasticsearch.constant';
import { CreateEventPublisherJob } from '../../generated/api/createEventPublisherJob';

interface ReIndexAllModalInterface {
  visible: boolean;
  onCancel: () => void;
  onSave?: (data: CreateEventPublisherJob) => void;
  confirmLoading: boolean;
}

const ReIndexAllModal = ({
  visible,
  onCancel,
  onSave,
  confirmLoading,
}: ReIndexAllModalInterface) => {
  const { t } = useTranslation();
  const [entities, setEntities] = useState<string[]>(
    ELASTIC_SEARCH_INITIAL_VALUES.entities
  );

  return (
    <Modal
      centered
      closable={false}
      confirmLoading={confirmLoading}
      okButtonProps={{
        form: 're-index-form',
        type: 'primary',
        htmlType: 'submit',
      }}
      okText="Submit"
      open={visible}
      title={t('label.re-index-elasticsearch')}
      width={650}
      onCancel={onCancel}>
      <Form
        id="re-index-form"
        layout="vertical"
        name="elastic-search-re-index"
        onFinish={onSave}>
        <Form.Item
          initialValue
          label={t('label.recreate-index-plural')}
          name="recreateIndex">
          <Select
            data-testid="re-index-selector"
            options={RECREATE_INDEX_OPTIONS}
          />
        </Form.Item>

        <Form.Item
          initialValue={entities}
          label={t('label.entity-plural')}
          name="entities">
          <Checkbox.Group
            onChange={(values) => setEntities(values as string[])}>
            <Row gutter={[16, 16]}>
              {ELASTIC_SEARCH_INDEX_ENTITIES.map((option) => (
                <Col key={option.value} span={8}>
                  <Checkbox value={option.value}>{option.label}</Checkbox>
                </Col>
              ))}
            </Row>
          </Checkbox.Group>
        </Form.Item>
        <Form.Item
          initialValue={ELASTIC_SEARCH_INITIAL_VALUES.flushIntervalInSec}
          label={t('label.flush-interval-secs')}
          name="flushIntervalInSec">
          <Input
            data-testid="flush-interval-in-sec"
            placeholder={t('label.enter-entity', {
              entity: t('label.second-plural'),
            })}
          />
        </Form.Item>

        <Form.Item
          initialValue={ELASTIC_SEARCH_INITIAL_VALUES.batchSize}
          label={`${t('label.batch-size')}:`}
          name="batchSize">
          <Input
            data-testid="batch-size"
            placeholder={t('label.enter-entity', {
              entity: t('label.batch-size'),
            })}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ReIndexAllModal;
