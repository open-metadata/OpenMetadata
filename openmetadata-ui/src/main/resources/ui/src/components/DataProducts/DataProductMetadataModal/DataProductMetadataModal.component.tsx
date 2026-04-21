/*
 *  Copyright 2026 Collate.
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

import { Form, Modal, Select } from 'antd';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DATA_PRODUCT_TYPE_LABEL_KEYS,
  PORTFOLIO_PRIORITY_LABEL_KEYS,
  VISIBILITY_LABEL_KEYS,
} from '../../../constants/DataProduct.constants';
import {
  DataProductType,
  PortfolioPriority,
  Visibility,
} from '../../../generated/api/domains/createDataProduct';
import { DataProduct } from '../../../generated/entity/domains/dataProduct';

export interface DataProductMetadataModalProps {
  open: boolean;
  dataProduct: DataProduct;
  onCancel: () => void;
  onSubmit: (values: {
    dataProductType?: DataProductType;
    visibility?: Visibility;
    portfolioPriority?: PortfolioPriority;
  }) => Promise<void> | void;
}

const DataProductMetadataModal = ({
  open,
  dataProduct,
  onCancel,
  onSubmit,
}: DataProductMetadataModalProps) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();

  useEffect(() => {
    if (open) {
      form.setFieldsValue({
        dataProductType: dataProduct.dataProductType,
        visibility: dataProduct.visibility,
        portfolioPriority: dataProduct.portfolioPriority,
      });
    }
  }, [open, dataProduct, form]);

  const handleOk = async () => {
    const values = await form.validateFields();
    await onSubmit(values);
  };

  return (
    <Modal
      destroyOnClose
      cancelText={t('label.cancel')}
      data-testid="data-product-metadata-modal"
      okText={t('label.save')}
      open={open}
      title={t('label.edit-entity', {
        entity: t('label.data-product'),
      })}
      onCancel={onCancel}
      onOk={handleOk}>
      <Form data-testid="metadata-form" form={form} layout="vertical">
        <Form.Item label={t('label.type')} name="dataProductType">
          <Select
            allowClear
            data-testid="type-select"
            options={Object.values(DataProductType).map((v) => ({
              label: t(DATA_PRODUCT_TYPE_LABEL_KEYS[v]),
              value: v,
            }))}
            placeholder={t('label.select-entity', { entity: t('label.type') })}
          />
        </Form.Item>
        <Form.Item label={t('label.visibility')} name="visibility">
          <Select
            allowClear
            data-testid="visibility-select"
            options={Object.values(Visibility).map((v) => ({
              label: t(VISIBILITY_LABEL_KEYS[v]),
              value: v,
            }))}
            placeholder={t('label.select-entity', {
              entity: t('label.visibility'),
            })}
          />
        </Form.Item>
        <Form.Item
          label={t('label.portfolio-priority')}
          name="portfolioPriority">
          <Select
            allowClear
            data-testid="priority-select"
            options={Object.values(PortfolioPriority).map((v) => ({
              label: t(PORTFOLIO_PRIORITY_LABEL_KEYS[v]),
              value: v,
            }))}
            placeholder={t('label.select-entity', {
              entity: t('label.portfolio-priority'),
            })}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default DataProductMetadataModal;
