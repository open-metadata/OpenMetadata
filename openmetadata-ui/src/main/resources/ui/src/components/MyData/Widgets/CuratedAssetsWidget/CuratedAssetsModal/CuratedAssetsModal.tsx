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

import {
  Box,
  Button,
  Dialog,
  HookForm,
  Input,
  Modal,
  ModalOverlay,
  Typography,
} from '@openmetadata/ui-core-components';
import { Plus } from '@openmetadata/ui-core-components/icons';
import { isEmpty, isUndefined } from 'lodash';
import { useCallback, useState } from 'react';
import { Controller, FormProvider, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { isValidElasticsearchQuery } from '../../../../../utils/CuratedAssetsPureUtils';
import {
  CuratedAssetsFormSelectedAssetsInfo,
  getSelectedResourceCount,
} from '../../../../../utils/CuratedAssetsUtils';
import { AdvancedAssetsFilterField } from '../AdvancedAssetsFilterField/AdvancedAssetsFilterField.component';
import { SelectAssetTypeField } from '../SelectAssetTypeField/SelectAssetTypeField.component';
import {
  CuratedAssetsConfig,
  CuratedAssetsModalProps,
} from './CuratedAssetsModal.interface';

type CuratedAssetsFormProps = Omit<CuratedAssetsModalProps, 'isOpen'> & {
  title: string;
};

// Mounted only while the modal is open, so each open starts from fresh defaults.
const CuratedAssetsForm = ({
  curatedAssetsConfig,
  onCancel,
  onSave,
  title,
}: CuratedAssetsFormProps) => {
  const { t } = useTranslation();
  const form = useForm<CuratedAssetsConfig>({
    defaultValues: {
      title: curatedAssetsConfig?.title ?? '',
      resources: curatedAssetsConfig?.resources ?? [],
      // Undefined on create so the filter field resets the shared query-builder tree.
      queryFilter: curatedAssetsConfig
        ? curatedAssetsConfig.queryFilter ?? '{}'
        : undefined,
    },
  });
  const [selectedAssetsInfo, setSelectedAssetsInfo] =
    useState<CuratedAssetsFormSelectedAssetsInfo>({
      resourceCount: 0,
      resourcesWithNonZeroCount: [],
    });

  const [widgetTitle, selectedResource, queryFilter] = useWatch({
    control: form.control,
    name: ['title', 'resources', 'queryFilter'],
  });

  const disableSave =
    isEmpty(widgetTitle) ||
    isEmpty(selectedResource) ||
    !isValidElasticsearchQuery(queryFilter || '{}');

  const handleSave = useCallback(
    (value: CuratedAssetsConfig) => {
      onSave({ ...value });
      onCancel();
    },
    [onSave, onCancel]
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

  return (
    <>
      <Box
        align="center"
        className="tw:bg-brand-solid tw:px-6 tw:py-4 tw:text-primary_on-brand"
        gap={2}>
        <Box
          align="center"
          className="tw:size-5 tw:rounded-md tw:border-2 tw:border-current"
          justify="center">
          <Plus aria-hidden className="tw:size-3.5" />
        </Box>
        <Typography
          className="tw:text-primary_on-brand"
          data-testid="curated-assets-modal-title"
          weight="semibold">
          {title}
        </Typography>
      </Box>
      <Dialog.Content className="tw:max-h-[70vh] tw:px-6">
        <HookForm
          className="tw:flex tw:flex-col tw:gap-4"
          data-testid="curated-assets-form"
          form={form}
          id="curated-assets-form"
          onSubmit={form.handleSubmit(handleSave)}>
          <Controller
            control={form.control}
            name="title"
            render={({ field }) => (
              <Input
                // eslint-disable-next-line jsx-a11y/no-autofocus -- focus the title input when the modal opens
                autoFocus
                inputDataTestId="title-input"
                label={t('label.title')}
                name={field.name}
                placeholder={t(
                  'message.curated-assets-widget-title-placeholder'
                )}
                value={field.value ?? ''}
                onBlur={field.onBlur}
                onChange={field.onChange}
              />
            )}
          />
          {/* The fields read the form through useFormContext. The core HookForm
            provider comes from the core package's own react-hook-form copy at
            runtime, so provide the app's copy explicitly. */}
          <FormProvider {...form}>
            <SelectAssetTypeField
              fetchEntityCount={fetchEntityCount}
              selectedAssetsInfo={selectedAssetsInfo}
            />
            <AdvancedAssetsFilterField
              fetchEntityCount={fetchEntityCount}
              selectedAssetsInfo={selectedAssetsInfo}
            />
          </FormProvider>
        </HookForm>
      </Dialog.Content>
      <Dialog.Footer>
        <Button color="secondary" data-testid="cancelButton" onPress={onCancel}>
          {t('label.cancel')}
        </Button>
        <Button
          color="primary"
          data-testid="saveButton"
          form="curated-assets-form"
          isDisabled={disableSave}
          type="submit">
          {t('label.save')}
        </Button>
      </Dialog.Footer>
    </>
  );
};

const CuratedAssetsModal = ({
  curatedAssetsConfig,
  onCancel,
  onSave,
  isOpen,
}: CuratedAssetsModalProps) => {
  const { t } = useTranslation();
  const title = isEmpty(curatedAssetsConfig)
    ? t('label.create-widget')
    : t('label.edit-widget');

  return (
    <ModalOverlay
      isDismissable
      isOpen={isOpen}
      onOpenChange={(open) => !open && onCancel()}>
      <Modal>
        <Dialog
          showCloseButton
          aria-label={title}
          data-testid="curated-assets-modal-container"
          dividers="scroll"
          panelClassName="tw:[&>button]:text-primary_on-brand"
          width={700}
          onClose={onCancel}>
          <CuratedAssetsForm
            curatedAssetsConfig={curatedAssetsConfig}
            title={title}
            onCancel={onCancel}
            onSave={onSave}
          />
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default CuratedAssetsModal;
