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

import { Button, Modal, Space, Typography } from 'antd';
import { cloneDeep } from 'lodash';
import React, { FunctionComponent, useEffect } from 'react';
import {
  Builder,
  FieldGroup,
  Query,
  ValueSource,
} from 'react-awesome-query-builder';
import { useTranslation } from 'react-i18next';
import { getTypeByFQN } from '../../rest/metadataTypeAPI';
import { EntitiesSupportedCustomProperties } from '../../utils/CustomProperties/CustomProperty.utils';
import { getEntityTypeFromSearchIndex } from '../../utils/SearchUtils';
import './advanced-search-modal.less';
import { useAdvanceSearch } from './AdvanceSearchProvider/AdvanceSearchProvider.component';

interface Props {
  visible: boolean;
  onSubmit: () => void;
  onCancel: () => void;
}

export const AdvancedSearchModal: FunctionComponent<Props> = ({
  visible,
  onSubmit,
  onCancel,
}: Props) => {
  const { t } = useTranslation();
  const {
    config,
    treeInternal,
    onTreeUpdate,
    onReset,
    onUpdateConfig,
    searchIndex,
  } = useAdvanceSearch();

  const updatedConfig = cloneDeep(config);

  async function getCustomAttributesSubfields() {
    try {
      const entityType = getEntityTypeFromSearchIndex(searchIndex);
      if (!entityType) {
        return;
      }
      const res = await getTypeByFQN(entityType);
      const customAttributes = res.customProperties;

      const subfields: Record<
        string,
        { type: string; valueSources: ValueSource[] }
      > = {};

      if (customAttributes) {
        customAttributes.forEach((attr) => {
          subfields[attr.name] = {
            type: 'text',
            valueSources: ['value'],
          };
        });
      }
      (updatedConfig.fields.extension as FieldGroup).subfields = subfields;
      onUpdateConfig(updatedConfig);
    } catch (error) {
      // Error
    }
  }

  useEffect(() => {
    if (visible && EntitiesSupportedCustomProperties.includes(searchIndex)) {
      getCustomAttributesSubfields();
    }
  }, [visible, searchIndex]);

  return (
    <Modal
      closable
      destroyOnClose
      className="advanced-search-modal"
      closeIcon={null}
      footer={
        <Space className="justify-between w-full">
          <Button className="float-right" size="small" onClick={onReset}>
            {t('label.reset')}
          </Button>
          <div>
            <Button onClick={onCancel}>{t('label.cancel')}</Button>
            <Button type="primary" onClick={onSubmit}>
              {t('label.apply')}
            </Button>
          </div>
        </Space>
      }
      maskClosable={false}
      okText={t('label.submit')}
      open={visible}
      title={t('label.advanced-entity', {
        entity: t('label.search'),
      })}
      width={950}
      onCancel={onCancel}>
      <Typography.Text data-testid="advanced-search-message">
        {t('message.advanced-search-message')}
      </Typography.Text>
      <Query
        {...config}
        renderBuilder={(props) => (
          <div className="query-builder-container query-builder qb-lite">
            <Builder {...props} />
          </div>
        )}
        value={treeInternal}
        onChange={onTreeUpdate}
      />
    </Modal>
  );
};
