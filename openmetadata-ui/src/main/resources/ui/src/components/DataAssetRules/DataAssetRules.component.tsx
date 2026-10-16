/*
 *  Copyright 2025 Collate.
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

import { PlusOutlined } from '@ant-design/icons';
import {
  Box,
  Button,
  FormField,
  Grid,
  HintText,
  HookForm,
  Input,
  SimpleModal,
  TextArea,
  Toggle,
  Typography,
} from '@openmetadata/ui-core-components';
import { Registry } from '@rjsf/utils';
import { AxiosError } from 'axios';
import { noop } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm, UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ReactComponent as AddPlaceHolderIcon } from '../../assets/svg/add-placeholder.svg';
import { EntityReferenceFields } from '../../enums/AdvancedSearch.enum';
import { SIZE } from '../../enums/common.enum';
import {
  SemanticsRule,
  Settings,
  SettingType,
} from '../../generated/settings/settings';
import {
  getSettingsConfigFromConfigType,
  updateSettingsConfig,
} from '../../rest/settingConfigAPI';
import i18n, { t } from '../../utils/i18next/LocalUtil';
import jsonLogicSearchClassBase from '../../utils/JSONLogicSearchClassBase';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import QueryBuilderWidget from '../common/Form/JSONSchema/JsonSchemaWidgets/QueryBuilderWidget/QueryBuilderWidget';
import RichTextEditorPreviewerNew from '../common/RichTextEditor/RichTextEditorPreviewNew';
import Table from '../common/Table/TableV2';
import { SearchOutputType } from '../Explore/AdvanceSearchProvider/AdvanceSearchProvider.interface';
import './DataAssetRules.less';

export const useSemanticsRulesState = () => {
  const { t } = useTranslation();
  const [semanticsRules, setSemanticsRules] = useState<SemanticsRule[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaveLoading, setIsSaveLoading] = useState<boolean>(false);

  const fetchSemanticsRules = useCallback(async () => {
    try {
      setIsLoading(true);

      const { data } = await getSettingsConfigFromConfigType(
        SettingType.EntityRulesSettings
      );

      setSemanticsRules(data?.config_value?.entitySemantics || []);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-fetch-error', {
          entity: t('label.email-configuration-lowercase'),
        })
      );
    } finally {
      setIsLoading(false);
    }
  }, [setSemanticsRules]);

  useEffect(() => {
    fetchSemanticsRules();
  }, []);

  const updateSemanticsRules = useCallback(
    async (configValues: SemanticsRule[]) => {
      try {
        setIsSaveLoading(true);
        const settingsConfigData: Settings = {
          config_type: SettingType.EntityRulesSettings,
          config_value: {
            entitySemantics: configValues,
          },
        };
        await updateSettingsConfig(settingsConfigData);
        fetchSemanticsRules();

        showSuccessToast(
          t('server.update-entity-success', {
            entity: t('label.data-asset-rules'),
          })
        );
      } catch (error) {
        showErrorToast(
          error as AxiosError,
          t('server.entity-updating-error', {
            entity: t('label.data-asset-rules').toLocaleLowerCase(
              i18n.language
            ),
          })
        );

        throw error;
      } finally {
        setIsSaveLoading(false);
      }
    },
    []
  );

  return {
    semanticsRules,
    setSemanticsRules,
    isLoading,
    isSaveLoading,
    updateSemanticsRules,
  };
};

export const SemanticsRuleForm: React.FC<{
  semanticsRule: SemanticsRule;
  otherSemanticsRules: SemanticsRule[];
  form: UseFormReturn<SemanticsRule>;
}> = ({ semanticsRule, otherSemanticsRules, form }) => {
  useEffect(() => {
    form.reset(semanticsRule);
  }, [semanticsRule, form]);

  const queryBuilderFields = useMemo(() => {
    const fields = jsonLogicSearchClassBase.getMapFields();

    return {
      [EntityReferenceFields.TAG]: fields[EntityReferenceFields.TAG],
      [EntityReferenceFields.TIER]: fields[EntityReferenceFields.TIER],
      [EntityReferenceFields.DOMAIN]: fields[EntityReferenceFields.DOMAIN],
      [EntityReferenceFields.DATA_PRODUCTS]:
        fields[EntityReferenceFields.DATA_PRODUCTS],
    };
  }, []);

  const requiredRule = (field: string) => ({
    required: t('label.field-required', { field }),
  });

  return (
    <HookForm className="tw:flex tw:flex-col tw:gap-4" form={form}>
      <FormField
        control={form.control}
        name="name"
        rules={{
          ...requiredRule(t('label.name')),
          validate: (value) =>
            !otherSemanticsRules.some((rule) => rule.name === value) ||
            t('message.name-already-exists'),
        }}>
        {({ field, fieldState }) => (
          <Input
            isRequired
            hint={fieldState.error?.message}
            isInvalid={fieldState.invalid}
            label={t('label.name')}
            placeholder={t('label.name')}
            value={field.value}
            onBlur={field.onBlur}
            onChange={field.onChange}
          />
        )}
      </FormField>
      <FormField
        control={form.control}
        name="description"
        rules={requiredRule(t('label.description'))}>
        {({ field, fieldState }) => (
          <TextArea
            isRequired
            hint={fieldState.error?.message}
            isInvalid={fieldState.invalid}
            label={t('label.description')}
            placeholder={t('label.description')}
            rows={2}
            value={field.value}
            onBlur={field.onBlur}
            onChange={field.onChange}
          />
        )}
      </FormField>
      <FormField
        control={form.control}
        name="rule"
        rules={requiredRule(t('label.rule'))}>
        {({ field, fieldState }) => (
          <Box direction="col" gap={1}>
            <QueryBuilderWidget
              defaultField={EntityReferenceFields.TAG}
              fields={queryBuilderFields}
              id="semantics-rule"
              label={t('label.rule')}
              name="rule"
              options={{}}
              registry={{} as Registry}
              schema={{
                outputType: SearchOutputType.JSONLogic,
              }}
              subField="tagFQN"
              value={field.value}
              onBlur={noop}
              onChange={field.onChange}
              onFocus={noop}
            />
            {fieldState.error && (
              <HintText isInvalid>{fieldState.error.message}</HintText>
            )}
          </Box>
        )}
      </FormField>
    </HookForm>
  );
};

export const AddEditSemanticsRuleModal: React.FC<{
  semanticsRule: SemanticsRule;
  onSave: (semanticsRule: SemanticsRule, previousName?: string) => void;
  onCancel: () => void;
  isSaveLoading?: boolean;
  otherSemanticsRules: SemanticsRule[];
}> = ({
  semanticsRule,
  onSave,
  onCancel,
  isSaveLoading,
  otherSemanticsRules,
}) => {
  const form = useForm<SemanticsRule>({ defaultValues: semanticsRule });

  const handleSave = form.handleSubmit((values) =>
    onSave(values, semanticsRule.name)
  );

  return (
    <SimpleModal
      isOpen
      isDismissable={false}
      isOkLoading={isSaveLoading}
      okText={t('label.save')}
      title={
        semanticsRule.name
          ? t('label.edit-data-asset-rule')
          : t('label.add-data-asset-rule')
      }
      width={800}
      onCancel={onCancel}
      onOk={handleSave}>
      <SemanticsRuleForm
        form={form}
        otherSemanticsRules={otherSemanticsRules}
        semanticsRule={semanticsRule}
      />
    </SimpleModal>
  );
};

export const DeleteSemanticsRuleConfirmationModal: React.FC<{
  semanticsRule: SemanticsRule;
  onCancel: () => void;
  onConfirm: (semanticsRule: SemanticsRule) => void;
  isSaveLoading?: boolean;
}> = ({ semanticsRule, onCancel, onConfirm, isSaveLoading }) => {
  return (
    <SimpleModal
      isOpen
      isOkLoading={isSaveLoading}
      okButtonColor="primary-destructive"
      okText={t('label.delete')}
      title={t('label.delete-data-asset-rule')}
      onCancel={onCancel}
      onOk={() => onConfirm(semanticsRule)}>
      <p>
        {t('message.delete-data-asset-rule-confirmation', {
          name: semanticsRule.name,
        })}
      </p>
    </SimpleModal>
  );
};

export const useSemanticsRuleList = ({
  semanticsRules,
  onSemanticsRuleChange,
  isSaveLoading,
  isLoading,
}: {
  semanticsRules: SemanticsRule[];
  onSemanticsRuleChange: (
    updatedSemanticsRules: SemanticsRule[]
  ) => Promise<void>;
  isSaveLoading?: boolean;
  isLoading?: boolean;
}) => {
  const [addEditSemanticsRule, setAddEditSemanticsRule] =
    useState<SemanticsRule | null>(null);
  const [deleteSemanticsRule, setDeleteSemanticsRule] =
    useState<SemanticsRule | null>(null);

  const handleSave = useCallback(
    async (semanticsRule: SemanticsRule, previousName?: string) => {
      // previousName: pass this if editing and the name was changed
      let updatedSemanticsRules = [...semanticsRules];

      // Remove the old rule if editing and the name has changed
      if (previousName && previousName !== semanticsRule.name) {
        updatedSemanticsRules = updatedSemanticsRules.filter(
          (rule) => rule.name !== previousName
        );
      }

      // Check if a rule with the new name already exists
      const existingIndex = updatedSemanticsRules.findIndex(
        (rule) => rule.name === semanticsRule.name
      );

      if (existingIndex > -1) {
        // Replace the existing rule
        updatedSemanticsRules[existingIndex] = semanticsRule;
      } else {
        // Add as new rule in the beginning
        updatedSemanticsRules.unshift(semanticsRule);
      }

      await onSemanticsRuleChange(updatedSemanticsRules);
      setAddEditSemanticsRule(null);
    },
    [semanticsRules, onSemanticsRuleChange]
  );

  const handleAddDataAssetRule = () => {
    setAddEditSemanticsRule({
      name: '',
      description: '',
      enabled: true,
      rule: '',
    });
  };

  const onConfirmDelete = async (semanticsRule: SemanticsRule) => {
    const updatedSemanticsRules = semanticsRules.filter(
      (rule) => rule.name !== semanticsRule.name
    );
    await onSemanticsRuleChange(updatedSemanticsRules);
    setDeleteSemanticsRule(null);
  };

  const columns = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'name',
        className: 'col-name',
      },
      {
        title: t('label.description'),
        dataIndex: 'description',
        className: 'col-description',
        render: (description: string) => (
          <RichTextEditorPreviewerNew markdown={description} />
        ),
      },
      {
        title: t('label.enabled'),
        dataIndex: 'enabled',
        render: (enabled: boolean, record: SemanticsRule) => (
          <Toggle
            isSelected={enabled}
            size="sm"
            onChange={() => {
              handleSave({ ...record, enabled: !enabled });
            }}
          />
        ),
      },
    ],
    [t, handleSave]
  );

  const dataAssetRuleList = useMemo(() => {
    return (
      <Grid className="layout-row layout-grid m-t-md table-container">
        <Grid.Item className="layout-column" span={24}>
          <Table
            columns={columns}
            dataSource={semanticsRules}
            loading={
              isLoading ||
              (isSaveLoading && !addEditSemanticsRule && !deleteSemanticsRule)
            }
            pagination={false}
            rowKey="name"
          />
        </Grid.Item>
      </Grid>
    );
  }, [semanticsRules, isLoading, isSaveLoading, columns]);

  const quickAddSemanticsRule = !isLoading && semanticsRules.length === 0 && (
    <Box
      align="center"
      className="layout-row h-full"
      justify="center"
      wrap="wrap">
      <Box className="layout-column tw:block">
        <Box
          inline
          align="center"
          className="layout-space w-full custom-icon-button"
          direction="col"
          gap={0}
          itemClassName="layout-space-item">
          <AddPlaceHolderIcon
            data-testid="no-data-image"
            height={SIZE.MEDIUM}
            width={SIZE.MEDIUM}
          />
          <Typography>
            {t('message.adding-new-entity-is-easy-just-give-it-a-spin', {
              entity: t('label.data-asset-rules'),
            })}
          </Typography>
          <Button
            color="secondary-brand"
            data-testid="add-widget-button"
            iconLeading={<PlusOutlined />}
            onClick={handleAddDataAssetRule}>
            {t('label.add')}
          </Button>
        </Box>
      </Box>
    </Box>
  );

  return {
    addSemanticsRuleButton: null,
    semanticsRuleList: (
      <>
        {quickAddSemanticsRule || dataAssetRuleList}
        {addEditSemanticsRule && (
          <AddEditSemanticsRuleModal
            isSaveLoading={isSaveLoading}
            otherSemanticsRules={semanticsRules.filter(
              (rule) => rule.name !== addEditSemanticsRule?.name
            )}
            semanticsRule={addEditSemanticsRule}
            onCancel={() => setAddEditSemanticsRule(null)}
            onSave={handleSave}
          />
        )}
        {deleteSemanticsRule && (
          <DeleteSemanticsRuleConfirmationModal
            isSaveLoading={isSaveLoading}
            semanticsRule={deleteSemanticsRule}
            onCancel={() => setDeleteSemanticsRule(null)}
            onConfirm={onConfirmDelete}
          />
        )}
      </>
    ),
  };
};
