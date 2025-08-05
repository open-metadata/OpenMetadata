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

import Icon, { PlusOutlined } from '@ant-design/icons';
import {
  Button,
  Col,
  Form,
  Input,
  Modal,
  Row,
  Space,
  Switch,
  Table,
  Typography,
} from 'antd';
import { FormInstance } from 'antd/es/form/Form';
import { AxiosError } from 'axios';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as AddPlaceHolderIcon } from '../../assets/svg/add-placeholder.svg';
import { ReactComponent as IconEdit } from '../../assets/svg/edit-new.svg';
import { ReactComponent as IconDelete } from '../../assets/svg/ic-delete.svg';
import { SIZE } from '../../enums/common.enum';
import {
  ProviderType,
  SemanticsRule,
  Settings,
  SettingType,
} from '../../generated/settings/settings';
import {
  getSettingsConfigFromConfigType,
  updateSettingsConfig,
} from '../../rest/settingConfigAPI';
import { CONTRACT_SEMANTIC_FIELDS } from '../../utils/DataContract/DataContractUtils';
import i18n, { t } from '../../utils/i18next/LocalUtil';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import QueryBuilderWidget from '../common/Form/JSONSchema/JsonSchemaWidgets/QueryBuilderWidget/QueryBuilderWidget';
import RichTextEditorPreviewerNew from '../common/RichTextEditor/RichTextEditorPreviewNew';
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
  form: FormInstance<SemanticsRule>;
}> = ({ semanticsRule, otherSemanticsRules, form }) => {
  useEffect(() => {
    form.setFieldsValue(semanticsRule);
  }, [semanticsRule]);

  return (
    <Form form={form} layout="vertical">
      <Form.Item
        label={t('label.name')}
        name="name"
        rules={[
          {
            required: true,
            // Do not allow name if already exists
            validator: (_, value) => {
              if (otherSemanticsRules.some((rule) => rule.name === value)) {
                return Promise.reject(
                  new Error(t('message.name-already-exists'))
                );
              }

              return Promise.resolve();
            },
          },
        ]}>
        <Input placeholder={t('label.name')} />
      </Form.Item>
      <Form.Item
        label={t('label.description')}
        name="description"
        rules={[
          {
            required: true,
          },
        ]}>
        <Input.TextArea placeholder={t('label.description')} rows={2} />
      </Form.Item>
      <Form.Item
        label={t('label.rule')}
        name="rule"
        rules={[
          {
            required: true,
          },
        ]}>
        {/* @ts-expect-error because Form.Item will provide value and onChange */}
        <QueryBuilderWidget
          fields={CONTRACT_SEMANTIC_FIELDS}
          schema={{
            outputType: SearchOutputType.JSONLogic,
          }}
        />
      </Form.Item>
    </Form>
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
  const [form] = Form.useForm();

  const handleSave = () => {
    form.validateFields().then((values) => {
      onSave(values, semanticsRule.name);
    });
  };

  return (
    <Modal
      open
      okButtonProps={{ loading: isSaveLoading }}
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
    </Modal>
  );
};

export const DeleteSemanticsRuleConfirmationModal: React.FC<{
  semanticsRule: SemanticsRule;
  onCancel: () => void;
  onConfirm: (semanticsRule: SemanticsRule) => void;
  isSaveLoading?: boolean;
}> = ({ semanticsRule, onCancel, onConfirm, isSaveLoading }) => {
  return (
    <Modal
      open
      okButtonProps={{ loading: isSaveLoading }}
      okText={t('label.delete')}
      title={t('label.delete-data-asset-rule')}
      onCancel={onCancel}
      onOk={() => onConfirm(semanticsRule)}>
      <p>
        {t('message.delete-data-asset-rule-confirmation', {
          name: semanticsRule.name,
        })}
      </p>
    </Modal>
  );
};

export const useSemanticsRuleList = ({
  semanticsRules,
  onSemanticsRuleChange,
  isSaveLoading,
  isLoading,
}: {
  semanticsRules: SemanticsRule[];
  onSemanticsRuleChange: (updatedSemanticsRules: SemanticsRule[]) => void;
  isSaveLoading?: boolean;
  isLoading?: boolean;
}) => {
  const [addEditSemanticsRule, setAddEditSemanticsRule] =
    useState<SemanticsRule | null>(null);
  const [deleteSemanticsRule, setDeleteSemanticsRule] =
    useState<SemanticsRule | null>(null);

  const handleSave = async (
    semanticsRule: SemanticsRule,
    previousName?: string
  ) => {
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
  };

  const handleAddDataAssetRule = () => {
    setAddEditSemanticsRule({
      name: '',
      description: '',
      enabled: true,
      rule: '',
    });
  };

  const handleEditSemanticsRule = (semanticsRule: SemanticsRule) => {
    setAddEditSemanticsRule(semanticsRule);
  };

  const handleDelete = (semanticsRule: SemanticsRule) => {
    setDeleteSemanticsRule(semanticsRule);
  };

  const onConfirmDelete = async (semanticsRule: SemanticsRule) => {
    const updatedSemanticsRules = semanticsRules.filter(
      (rule) => rule.name !== semanticsRule.name
    );
    await onSemanticsRuleChange(updatedSemanticsRules);
    setDeleteSemanticsRule(null);
  };

  const columns = [
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
        <Switch
          checked={enabled}
          onChange={() => {
            handleSave({ ...record, enabled: !enabled });
          }}
        />
      ),
    },
    {
      title: t('label.action'),
      dataIndex: 'actions',
      render: (_: unknown, record: SemanticsRule) => (
        <Space className="custom-icon-button">
          <Button
            className="text-secondary p-0 remove-button-background-hover"
            disabled={record.provider === ProviderType.System}
            icon={<Icon component={IconEdit} />}
            type="text"
            onClick={() => handleEditSemanticsRule(record)}
          />
          <Button
            className="text-secondary p-0 remove-button-background-hover"
            disabled={record.provider === ProviderType.System}
            icon={<Icon component={IconDelete} />}
            type="text"
            onClick={() => handleDelete(record)}
          />
        </Space>
      ),
    },
  ];

  const dataAssetRuleList = useMemo(() => {
    return (
      <Row className="m-t-md table-container">
        <Col span={24}>
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
        </Col>
      </Row>
    );
  }, [semanticsRules, isLoading, isSaveLoading, columns]);

  const quickAddSemanticsRule = !isLoading && semanticsRules.length === 0 && (
    <Row align="middle" className="h-full" justify="center">
      <Col>
        <Space
          align="center"
          className="w-full custom-icon-button"
          direction="vertical"
          size={0}>
          <AddPlaceHolderIcon
            data-testid="no-data-image"
            height={SIZE.MEDIUM}
            width={SIZE.MEDIUM}
          />
          <Typography.Text>
            {t('message.adding-new-entity-is-easy-just-give-it-a-spin', {
              entity: t('label.data-asset-rules'),
            })}
          </Typography.Text>
          <Button
            ghost
            className="add-button"
            data-testid="add-widget-button"
            icon={<PlusOutlined />}
            type="primary"
            onClick={handleAddDataAssetRule}>
            {t('label.add')}
          </Button>
        </Space>
      </Col>
    </Row>
  );

  return {
    addSemanticsRuleButton: (
      <Button type="primary" onClick={handleAddDataAssetRule}>
        {t('label.add-data-asset-rule')}
      </Button>
    ),
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
