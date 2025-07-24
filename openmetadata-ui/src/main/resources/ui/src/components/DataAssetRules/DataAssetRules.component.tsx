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
import { Utils as QbUtils } from '@react-awesome-query-builder/antd';
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  Modal,
  Row,
  Space,
  Switch,
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
import { SearchIndex } from '../../enums/search.enum';
import { SemanticsRule } from '../../generated/configuration/entityRulesSettings';
import { Settings, SettingType } from '../../generated/settings/settings';
import {
  getSettingsConfigFromConfigType,
  updateSettingsConfig,
} from '../../rest/settingConfigAPI';
import { getTreeConfig } from '../../utils/AdvancedSearchUtils';
import i18n, { t } from '../../utils/i18next/LocalUtil';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import QueryBuilderWidget from '../common/Form/JSONSchema/JsonSchemaWidgets/QueryBuilderWidget/QueryBuilderWidget';
import Loader from '../common/Loader/Loader';
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

      setSemanticsRules(data?.config_value?.entitySemantics);
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
        await fetchSemanticsRules();

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
  form: FormInstance<SemanticsRule>;
}> = ({ semanticsRule, form }) => {
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
        <QueryBuilderWidget
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
}> = ({ semanticsRule, onSave, onCancel, isSaveLoading }) => {
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
      onCancel={onCancel}
      onOk={handleSave}>
      <SemanticsRuleForm form={form} semanticsRule={semanticsRule} />
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

const { Text } = Typography;

export const SemanticsRuleCard: React.FC<{
  semanticsRule: SemanticsRule;
  onEdit: (semanticsRule: SemanticsRule) => void;
  onSave: (semanticsRule: SemanticsRule, previousName?: string) => void;
  onDelete: (semanticsRule: SemanticsRule) => void;
}> = ({ semanticsRule, onEdit, onSave, onDelete }) => {
  const cartTitle = useMemo(() => {
    return (
      <div className="d-flex items-center">
        <div>{semanticsRule.name}</div>
        <div className="m-l-auto">
          <Switch
            defaultChecked={semanticsRule.enabled}
            onChange={() =>
              onSave({ ...semanticsRule, enabled: !semanticsRule.enabled })
            }
          />
          <Button
            className="text-primary p-0 remove-button-background-hover"
            icon={<Icon component={IconEdit} />}
            type="text"
            onClick={() => onEdit(semanticsRule)}
          />
          <Button
            className="text-primary p-0 remove-button-background-hover"
            icon={<Icon component={IconDelete} />}
            type="text"
            onClick={() => onDelete(semanticsRule)}
          />
        </div>
      </div>
    );
  }, [semanticsRule]);

  const config = getTreeConfig({
    searchIndex: SearchIndex.DATA_ASSET,
    searchOutputType: SearchOutputType.JSONLogic,
    isExplorePage: false,
    tierOptions: Promise.resolve([]),
  });
  const humanStringRule = useMemo(() => {
    const logic = JSON.parse(semanticsRule.rule);

    const tree = QbUtils.loadFromJsonLogic(logic, config);
    const humanString = tree ? QbUtils.queryString(tree, config) : '';

    // remove .fullyQualifiedName from the humanString
    return humanString
      ?.replace('.fullyQualifiedName', '')
      ?.replace('.name', '')
      ?.replace('.tagFQN', '');
  }, [semanticsRule.rule]);

  return (
    <Card className="data-asset-rules-card" size="small" title={cartTitle}>
      <Text type="secondary">{t('label.description')}</Text>
      <Text className="sematic-value-text d-block m-b-md">
        {semanticsRule.description}
      </Text>
      <Text type="secondary">{t('label.rule')}</Text>
      <Text className="sematic-value-text d-block">{humanStringRule}</Text>
    </Card>
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

  const dataAssetRuleList = useMemo(() => {
    return (
      <Row className="m-t-md" gutter={[16, 16]}>
        {semanticsRules?.map((semanticsRule) => (
          <Col
            className="data-asset-rules-col"
            key={semanticsRule.name}
            span={8}>
            <SemanticsRuleCard
              semanticsRule={semanticsRule}
              onDelete={handleDelete}
              onEdit={handleEditSemanticsRule}
              onSave={handleSave}
            />
          </Col>
        ))}
      </Row>
    );
  }, [semanticsRules]);

  const quickAddSemanticsRule = !isLoading && semanticsRules.length === 0 && (
    <Row align="middle" className="h-full" justify="center">
      <Col>
        <Space align="center" className="w-full" direction="vertical" size={0}>
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
        {isLoading ? <Loader /> : quickAddSemanticsRule || dataAssetRuleList}
        {addEditSemanticsRule && (
          <AddEditSemanticsRuleModal
            isSaveLoading={isSaveLoading}
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
