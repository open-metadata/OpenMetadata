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

import { Utils as QbUtils } from '@react-awesome-query-builder/ui';
import { Button, Modal, Space, Typography } from 'antd';
import { FunctionComponent, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../enums/entity.enum';
import QueryBuilder from '../common/QueryBuilder/QueryBuilder';
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
  const { config, treeInternal, onTreeUpdate, onReset, modalProps } =
    useAdvanceSearch();

  // The provider holds an ImmutableTree; the builder takes a plain JsonTree.
  const treeJson = useMemo(() => QbUtils.getTree(treeInternal), [treeInternal]);

  return (
    <Modal
      closable
      destroyOnClose
      className="advanced-search-modal"
      closeIcon={null}
      data-testid="advanced-search-modal"
      footer={
        <Space className="justify-between w-full">
          <Button
            className="float-right"
            data-testid="reset-btn"
            size="small"
            onClick={onReset}>
            {t('label.reset')}
          </Button>
          <div>
            <Button data-testid="cancel-btn" onClick={onCancel}>
              {t('label.cancel')}
            </Button>
            <Button data-testid="apply-btn" type="primary" onClick={onSubmit}>
              {t('label.apply')}
            </Button>
          </div>
        </Space>
      }
      maskClosable={false}
      okText={t('label.submit')}
      open={visible}
      title={
        modalProps?.title ??
        t('label.advanced-entity', {
          entity: t('label.search'),
        })
      }
      width={1080}
      onCancel={onCancel}>
      <Typography.Text data-testid="advanced-search-message">
        {modalProps?.subTitle ?? t('message.advanced-search-message')}
      </Typography.Text>
      <QueryBuilder
        conjunctionMode="editable"
        entityType={EntityType.ALL}
        // The provider owns the enriched fields (custom properties, field
        // overrides) and, on submit, the query filter and Explore URL. The
        // builder only reports changes back into it.
        fields={config.fields}
        groupMode="nested"
        showCountPreview={false}
        tree={treeJson}
        onChange={(_value, nextTree) =>
          nextTree && onTreeUpdate(QbUtils.loadTree(nextTree), config)
        }
      />
    </Modal>
  );
};
