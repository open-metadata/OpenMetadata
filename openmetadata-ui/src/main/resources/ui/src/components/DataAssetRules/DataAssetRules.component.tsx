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

import {
  Button,
  Card,
  Col,
  Form,
  Input,
  Modal,
  Row,
  Switch,
  Typography,
} from 'antd';
import { FormInstance } from 'antd/es/form/Form';
import { AxiosError } from 'axios';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SemanticsRule } from '../../generated/configuration/entityRulesSettings';
import { Settings, SettingType } from '../../generated/settings/settings';
import {
  getSettingsConfigFromConfigType,
  updateSettingsConfig,
} from '../../rest/settingConfigAPI';
import i18n, { t } from '../../utils/i18next/LocalUtil';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import QueryBuilderWidget from '../common/Form/JSONSchema/JsonSchemaWidgets/QueryBuilderWidget/QueryBuilderWidget';
import { SearchOutputType } from '../Explore/AdvanceSearchProvider/AdvanceSearchProvider.interface';
import './DataAssetRules.less';

export const useSemanticsRulesState = () => {
  const { t } = useTranslation();
  const [semanticsRules, setSemanticsRules] = useState<SemanticsRule[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [isSaveLoading, setIsSaveLoading] = useState<boolean>(false);

  const fetchSemanticsRules = useCallback(async () => {
    try {
      setLoading(true);

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
      setLoading(false);
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
    loading,
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
      <Form.Item label={t('label.name')} name="name">
        <Input placeholder={t('label.name')} />
      </Form.Item>
      <Form.Item label={t('label.description')} name="description">
        <Input.TextArea placeholder={t('label.description')} rows={2} />
      </Form.Item>
      <Form.Item label={t('label.rule')} name="rule">
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
  onSave: (semanticsRule: SemanticsRule) => void;
  onCancel: () => void;
}> = ({ semanticsRule, onSave, onCancel }) => {
  const [form] = Form.useForm();

  const handleSave = () => {
    onSave({ ...form.getFieldsValue(), enabled: true });
  };

  return (
    <Modal
      open
      title={t('label.add-data-asset-rule')}
      onCancel={onCancel}
      onOk={handleSave}>
      <SemanticsRuleForm form={form} semanticsRule={semanticsRule} />
    </Modal>
  );
};

const { Text } = Typography;

export const SemanticsRuleCard: React.FC<{
  semanticsRule: SemanticsRule;
  onEdit: (semanticsRule: SemanticsRule) => void;
}> = ({ semanticsRule, onEdit }) => {
  const cartTitle = useMemo(() => {
    return (
      <div className="d-flex items-center">
        <div>{semanticsRule.name}</div>
        <div className="m-l-auto">
          <Switch defaultChecked={semanticsRule.enabled} />
          <Button type="link" onClick={() => onEdit(semanticsRule)}>
            {t('label.edit')}
          </Button>
        </div>
      </div>
    );
  }, [semanticsRule]);

  return (
    <Card className="data-asset-rules-card" size="small" title={cartTitle}>
      <Text type="secondary">{t('label.description')}</Text>
      <Text className="sematic-value-text d-block m-b-md">
        {semanticsRule.description}
      </Text>
      <Text type="secondary">{t('label.rule')}</Text>
      <Text className="sematic-value-text d-block">{semanticsRule.rule}</Text>
    </Card>
  );
};

export const useSemanticsRuleList = ({
  semanticsRules,
  onSemanticsRuleChange,
}: {
  semanticsRules: SemanticsRule[];
  onSemanticsRuleChange: (updatedSemanticsRules: SemanticsRule[]) => void;
}) => {
  const [addEditSemanticsRule, setAddEditSemanticsRule] =
    useState<SemanticsRule | null>(null);

  const handleSave = async (semanticsRule: SemanticsRule) => {
    // Update the semanticsRules, replace if exists by name, otherwise add in the end
    let updatedSemanticsRules = [...semanticsRules];
    if (
      !updatedSemanticsRules.find((rule) => rule.name === semanticsRule.name)
    ) {
      updatedSemanticsRules.push(semanticsRule);
    } else {
      updatedSemanticsRules = updatedSemanticsRules.map((rule) =>
        rule.name === semanticsRule.name ? { ...rule, ...semanticsRule } : rule
      );
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
              onEdit={handleEditSemanticsRule}
            />
          </Col>
        ))}
      </Row>
    );
  }, [semanticsRules]);

  return {
    addSemanticsRuleButton: (
      <Button type="primary" onClick={handleAddDataAssetRule}>
        {t('label.add-data-asset-rule')}
      </Button>
    ),
    semanticsRuleList: (
      <>
        {dataAssetRuleList}
        {addEditSemanticsRule && (
          <AddEditSemanticsRuleModal
            semanticsRule={addEditSemanticsRule}
            onCancel={() => setAddEditSemanticsRule(null)}
            onSave={handleSave}
          />
        )}
      </>
    ),
  };
};
