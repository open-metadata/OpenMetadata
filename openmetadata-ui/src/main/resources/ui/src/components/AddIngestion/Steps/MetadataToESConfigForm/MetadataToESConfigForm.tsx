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

import { Button, Col, Divider, Form, Input, Row, Select } from 'antd';
import { AddIngestionState } from 'components/AddIngestion/addIngestion.interface';
import {
  ELASTIC_SEARCH_INITIAL_VALUES,
  RECREATE_INDEX_OPTIONS,
  RE_INDEX_LANG_OPTIONS,
} from 'constants/elasticsearch.constant';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pipeline } from '../../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import './MetadataToESConfigForm.less';

interface Props {
  data: AddIngestionState;
  handleMetadataToESConfig: (data: Pipeline) => void;
  handlePrev: () => void;
  handleNext: () => void;
  onFocus: (fieldId: string) => void;
}

const { Item } = Form;

const MetadataToESConfigForm = ({
  handleMetadataToESConfig,
  handlePrev,
  handleNext,
  onFocus,
  data,
}: Props) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();

  const handleSubmit = (values: Pipeline) => {
    handleMetadataToESConfig({
      ...values,
    });
    handleNext();
  };

  const initialValues = useMemo(
    () => ({
      recreateIndex:
        data.metadataToESConfig?.recreateIndex ??
        ELASTIC_SEARCH_INITIAL_VALUES.recreateIndexPipeline,
      searchIndexMappingLanguage:
        data.metadataToESConfig?.searchIndexMappingLanguage ??
        ELASTIC_SEARCH_INITIAL_VALUES.searchIndexMappingLanguage,
      batchSize:
        data.metadataToESConfig?.batchSize ??
        ELASTIC_SEARCH_INITIAL_VALUES.batchSize,
    }),
    [data]
  );

  return (
    <Form
      className="metadata-to-es-config-form"
      form={form}
      initialValues={initialValues}
      layout="vertical"
      onFinish={handleSubmit}
      onFocus={(e) => onFocus(e.target.id)}>
      <Item label={t('label.batch-size')} name="batchSize">
        <Input id="root/batchSize" type="number" />
      </Item>
      <Item label={t('label.language')} name="searchIndexMappingLanguage">
        <Select
          id="root/searchIndexMappingLanguage"
          options={RE_INDEX_LANG_OPTIONS}
        />
      </Item>
      <Item label={t('label.recreate-index-plural')} name="recreateIndex">
        <Select id="root/recreateIndex" options={RECREATE_INDEX_OPTIONS} />
      </Item>
      <Divider />
      <Row justify="end">
        <Col>
          <Button type="link" onClick={handlePrev}>
            {t('label.back')}
          </Button>
        </Col>
        <Col>
          <Button htmlType="submit" type="primary">
            {t('label.next')}
          </Button>
        </Col>
      </Row>
    </Form>
  );
};

export default MetadataToESConfigForm;
