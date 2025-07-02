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

import { CloseOutlined } from '@ant-design/icons';
import { Button, Form, Input, Modal, Typography } from 'antd';
import { useForm } from 'antd/lib/form/Form';
import { isEmpty, isUndefined } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as PlusSquare } from '../../../../../assets/svg/plus-square.svg';
import { VALIDATION_MESSAGES } from '../../../../../constants/constants';
import {
  CuratedAssetsFormSelectedAssetsInfo,
  getSelectedResourceCount,
} from '../../../../../utils/CuratedAssetsUtils';
import { AdvancedAssetsFilterField } from '../AdvancedAssetsFilterField/AdvancedAssetsFilterField.component';
import { SelectAssetTypeField } from '../SelectAssetTypeField/SelectAssetTypeField.component';
import './curated-assets-modal.less';
import {
  CuratedAssetsConfig,
  CuratedAssetsModalProps,
} from './CuratedAssetsModal.interface';

const CuratedAssetsModal = ({
  curatedAssetsConfig,
  onCancel,
  onSave,
  isOpen,
}: CuratedAssetsModalProps) => {
  const { t } = useTranslation();
  const [form] = useForm<CuratedAssetsConfig>();
  const [selectedAssetsInfo, setSelectedAssetsInfo] =
    useState<CuratedAssetsFormSelectedAssetsInfo>({
      resourceCount: 0,
      resourcesWithNonZeroCount: [],
    });

  const selectedResource = Form.useWatch('resources', form);

  const queryFilter = Form.useWatch('queryFilter', form);

  const title = Form.useWatch('title', form);

  useEffect(() => {
    if (isOpen && curatedAssetsConfig) {
      form.setFieldsValue({
        title: curatedAssetsConfig.title || '',
        resources: curatedAssetsConfig.resources || [],
        queryFilter: curatedAssetsConfig.queryFilter || '{}',
      });
    }
  }, [isOpen, curatedAssetsConfig, form]);

  const disableSave = useMemo(() => {
    return isEmpty(title) || isEmpty(selectedResource) || isEmpty(queryFilter);
  }, [title, selectedResource, queryFilter]);

  const handleCancel = useCallback(() => {
    form.resetFields();
    onCancel();
  }, [form, onCancel]);

  const handleSave = useCallback(
    (value: CuratedAssetsConfig) => {
      onSave({ ...value });
      form.resetFields();
      onCancel();
    },
    [onSave, form, onCancel]
  );

  const fetchEntityCount = useCallback(
    async ({
      countKey,
      selectedResource,
      queryFilter,
      shouldUpdateResourceList = true,
    }: {
      countKey: string;
      selectedResource: string[];
      queryFilter?: string;
      shouldUpdateResourceList?: boolean;
    }) => {
      try {
        const { entityCount, resourcesWithNonZeroCount } =
          await getSelectedResourceCount({
            selectedResource,
            queryFilter,
            shouldUpdateResourceList,
          });

        setSelectedAssetsInfo((prev) => ({
          ...prev,
          ...(isUndefined(resourcesWithNonZeroCount)
            ? {}
            : { resourcesWithNonZeroCount }),
          [countKey]: entityCount,
        }));
      } catch {
        return;
      }
    },
    []
  );

  const modalTitle = useMemo(
    () => (
      <div className="flex items-center">
        <PlusSquare className="text-xl" />
        <Typography.Text strong className="m-l-xs text-white">
          {!isEmpty(curatedAssetsConfig)
            ? t('label.edit-widget')
            : t('label.create-widget')}
        </Typography.Text>
      </div>
    ),
    [curatedAssetsConfig, t]
  );

  const modalFooter = useMemo(
    () => [
      <Button
        data-testid="cancelButton"
        key="cancelButton"
        type="ghost"
        onClick={handleCancel}
      >
        {t('label.cancel')}
      </Button>,
      <Button
        data-testid="saveButton"
        disabled={disableSave}
        key="saveButton"
        type="primary"
        onClick={() => form.submit()}
      >
        {t('label.save')}
      </Button>,
    ],
    [handleCancel, disableSave, form, t]
  );

  return (
    <Modal
      centered
      closable
      destroyOnClose
      className="curated-assets-modal"
      closeIcon={<CloseOutlined className="text-2xl text-white" />}
      data-testid="curated-assets-modal-container"
      footer={modalFooter}
      open={isOpen}
      title={modalTitle}
      width={700}
      onCancel={handleCancel}
    >
      <Form<CuratedAssetsConfig>
        data-testid="curated-assets-form"
        form={form}
        id="curated-assets-form"
        layout="vertical"
        validateMessages={VALIDATION_MESSAGES}
        onFinish={handleSave}
      >
        <Form.Item label="Widget's Title" name="title">
          <Input
            autoFocus
            data-testid="title-input"
            placeholder={t('message.curated-assets-widget-title-placeholder')}
          />
        </Form.Item>
        <SelectAssetTypeField
          fetchEntityCount={fetchEntityCount}
          selectedAssetsInfo={selectedAssetsInfo}
        />
        <AdvancedAssetsFilterField
          fetchEntityCount={fetchEntityCount}
          selectedAssetsInfo={selectedAssetsInfo}
        />
      </Form>
    </Modal>
  );
};

export default CuratedAssetsModal;
