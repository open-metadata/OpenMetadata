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
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as PlusSquare } from '../../../../../assets/svg/plus-square.svg';
import { VALIDATION_MESSAGES } from '../../../../../constants/constants';
import { IngestionPipeline } from '../../../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import {
  APP_CONFIG_PATH,
  CuratedAssetsFormSelectedAssetsInfo,
  getSelectedResourceCount,
} from '../../../../../utils/CuratedAssetsUtils';
import { AdvanceSearchProvider } from '../../../../Explore/AdvanceSearchProvider/AdvanceSearchProvider.component';
import { AdvancedAssetsFilterField } from '../AdvancedAssetsFilterField/AdvancedAssetsFilterField.component';
import { SelectAssetTypeField } from '../SelectAssetTypeField/SelectAssetTypeField.component';
import './curated-assets-modal.less';
import { CuratedAssetsModalProps } from './CuratedAssetsModal.interface';

const CuratedAssetsModal = ({
  curatedAssetsData,
  onCancel,
  onSave,
  isSaveButtonDisabled,
  isOpen,
}: CuratedAssetsModalProps) => {
  const { t } = useTranslation();
  const [form] = useForm<IngestionPipeline>();
  const [selectedAssetsInfo, setSelectedAssetsInfo] =
    useState<CuratedAssetsFormSelectedAssetsInfo>({
      resourceCount: 0,
      resourcesWithNonZeroCount: [],
    });

  const selectedResource = Form.useWatch<Array<string>>(
    [...APP_CONFIG_PATH, 'resources', 'type'],
    form
  );

  const queryFilter = Form.useWatch<string>(
    [...APP_CONFIG_PATH, 'resources', 'queryFilter'],
    form
  );

  const title = Form.useWatch<string>(['title'], form);

  const disableSave = useMemo(() => {
    return (
      isEmpty(title) ||
      isEmpty(selectedResource) ||
      isEmpty(queryFilter) ||
      isSaveButtonDisabled
    );
  }, [title, selectedResource, queryFilter, isSaveButtonDisabled]);

  const handleCancel = useCallback(() => {
    form.resetFields();
    onCancel();
  }, [form, onCancel]);

  const handleSave = useCallback(
    (value) => {
      onSave({ ...value });
      handleCancel();
    },
    [onSave, handleCancel]
  );

  const fetchEntityCount = useCallback(
    async ({
      countKey,
      selectedResource,
      queryFilter,
      shouldUpdateResourceList = true,
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
          {!isEmpty(curatedAssetsData)
            ? t('label.edit-widget')
            : t('label.create-widget')}
        </Typography.Text>
      </div>
    ),
    [curatedAssetsData, t]
  );

  const modalFooter = useMemo(
    () => [
      <Button
        data-testid="cancelButton"
        key="cancelButton"
        type="ghost"
        onClick={handleCancel}>
        {t('label.cancel')}
      </Button>,
      <Button
        data-testid="saveButton"
        disabled={disableSave}
        key="saveButton"
        type="primary"
        onClick={() => form.submit()}>
        {t('label.save')}
      </Button>,
    ],
    [handleCancel, disableSave, form, t]
  );

  const initialValues = useMemo(
    () => ({
      ...(curatedAssetsData || {}),
      sourceConfig: {
        ...(curatedAssetsData?.sourceConfig || {}),
        config: {
          ...(curatedAssetsData?.sourceConfig?.config || {}),
          appConfig: {
            ...(curatedAssetsData?.sourceConfig?.config?.appConfig || {}),
            resources: {
              ...(curatedAssetsData?.sourceConfig?.config?.appConfig
                ?.resources || {}),
              type: [
                ...(curatedAssetsData?.sourceConfig?.config?.appConfig
                  ?.resources?.type || []),
              ],
            },
          },
        },
      },
    }),
    [curatedAssetsData]
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
      onCancel={handleCancel}>
      <AdvanceSearchProvider isExplorePage={false} updateURL={false}>
        <Form<IngestionPipeline>
          data-testid="curated-assets-form"
          form={form}
          id="curated-assets-form"
          initialValues={initialValues}
          layout="vertical"
          validateMessages={VALIDATION_MESSAGES}
          onFinish={handleSave}>
          <Form.Item label="Widget's Title" name="title">
            <Input
              autoFocus
              placeholder="Enter a title for your widget, Ex: Recommended Tables"
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
      </AdvanceSearchProvider>
    </Modal>
  );
};

export default CuratedAssetsModal;
