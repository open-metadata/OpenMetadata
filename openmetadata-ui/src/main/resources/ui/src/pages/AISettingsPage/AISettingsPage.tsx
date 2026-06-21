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
import {
  Button,
  Input,
  Select,
  TextArea,
  Toggle,
} from '@openmetadata/ui-core-components';
import { Col, Row, Typography } from 'antd';
import { AxiosError } from 'axios';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Loader from '../../components/common/Loader/Loader';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TitleBreadcrumbProps } from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import PageHeader from '../../components/PageHeader/PageHeader.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { GlobalSettingsMenuCategory } from '../../constants/GlobalSettings.constants';
import {
  AISettings,
  DeletionPolicy,
} from '../../generated/configuration/aiSettings';
import { MCPConfiguration } from '../../generated/configuration/mcpConfiguration';
import { Settings, SettingType } from '../../generated/settings/settings';
import {
  getMcpConfiguration,
  getSettingsByType,
  restoreSettingsConfig,
  updateMcpConfiguration,
  updateSettingsConfig,
} from '../../rest/settingConfigAPI';
import { getSettingPageEntityBreadCrumb } from '../../utils/GlobalSettingsUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';

const DELETION_POLICY_OPTIONS = [
  { id: DeletionPolicy.Cascade, labelKey: 'label.cascade' },
  { id: DeletionPolicy.Orphan, labelKey: 'label.orphan' },
  { id: DeletionPolicy.Deprecate, labelKey: 'label.deprecate' },
];

const AISettingsPage = () => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [aiConfig, setAiConfig] = useState<AISettings>({});
  const [mcpConfig, setMcpConfig] = useState<MCPConfiguration>({});

  const breadcrumbs: TitleBreadcrumbProps['titleLinks'] = useMemo(
    () =>
      getSettingPageEntityBreadCrumb(
        GlobalSettingsMenuCategory.PREFERENCES,
        t('label.ai')
      ),
    [t]
  );

  const fetchConfig = async () => {
    try {
      setIsLoading(true);

      const [aiValue, mcpValue] = await Promise.all([
        getSettingsByType(SettingType.AISettings),
        getMcpConfiguration(),
      ]);

      setAiConfig((aiValue as AISettings) ?? {});
      setMcpConfig(mcpValue ?? {});
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsUpdating(true);

      const configData: Settings = {
        config_type: SettingType.AISettings,
        config_value: aiConfig,
      };

      await Promise.all([
        updateSettingsConfig(configData),
        updateMcpConfiguration(mcpConfig),
      ]);

      showSuccessToast(
        t('server.update-entity-success', {
          entity: t('label.ai-setting-plural'),
        })
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleReset = async () => {
    try {
      setIsUpdating(true);
      await restoreSettingsConfig(SettingType.AISettings);
      await fetchConfig();
      showSuccessToast(
        t('server.update-entity-success', {
          entity: t('label.ai-setting-plural'),
        })
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsUpdating(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  if (isLoading) {
    return <Loader />;
  }

  return (
    <PageLayoutV1
      className="ai-settings"
      mainContainerClassName="p-t-0"
      pageTitle={t('label.ai')}>
      <Row className="p-md m-0" gutter={[0, 16]}>
        <Col span={24}>
          <TitleBreadcrumb titleLinks={breadcrumbs} />
        </Col>
        <Col span={24}>
          <PageHeader
            data={{
              header: t('label.ai'),
              subHeader: t('message.page-sub-header-for-ai-setting'),
            }}
          />
        </Col>
      </Row>

      <Row className="p-md m-x-0" gutter={[0, 24]}>
        <Col span={24}>
          <Typography.Title className="text-sm font-semibold" level={5}>
            {t('label.general')}
          </Typography.Title>

          <div className="tw:flex tw:flex-col tw:gap-4 tw:mt-3">
            <Toggle
              data-testid="ai-master-toggle"
              isDisabled={isUpdating}
              isSelected={aiConfig.enabled ?? false}
              label={t('label.enable-entity', { entity: t('label.ai') })}
              onChange={(isSelected) =>
                setAiConfig({ ...aiConfig, enabled: isSelected })
              }
            />
          </div>
        </Col>

        <Col span={24}>
          <Typography.Title className="text-sm font-semibold" level={5}>
            {t('label.memory-extraction')}
          </Typography.Title>

          <div className="tw:flex tw:flex-col tw:gap-4 tw:mt-3">
            <Toggle
              data-testid="memory-extraction-files-toggle"
              isDisabled={isUpdating}
              isSelected={aiConfig.memoryExtraction?.fromFiles ?? false}
              label={t('label.from-files')}
              onChange={(isSelected) =>
                setAiConfig({
                  ...aiConfig,
                  memoryExtraction: {
                    ...aiConfig.memoryExtraction,
                    fromFiles: isSelected,
                  },
                })
              }
            />

            <Toggle
              data-testid="memory-extraction-pages-toggle"
              isDisabled={isUpdating}
              isSelected={aiConfig.memoryExtraction?.fromPages ?? false}
              label={t('label.from-pages')}
              onChange={(isSelected) =>
                setAiConfig({
                  ...aiConfig,
                  memoryExtraction: {
                    ...aiConfig.memoryExtraction,
                    fromPages: isSelected,
                  },
                })
              }
            />
          </div>
        </Col>

        <Col span={24}>
          <Typography.Title className="text-sm font-semibold" level={5}>
            {t('label.ontology-agent')}
          </Typography.Title>

          <div className="tw:flex tw:flex-col tw:gap-4 tw:mt-3">
            <Toggle
              data-testid="ontology-agent-toggle"
              isDisabled={isUpdating}
              isSelected={aiConfig.ontologyAgent?.enabled ?? false}
              label={t('label.enable-entity', {
                entity: t('label.ontology-agent'),
              })}
              onChange={(isSelected) =>
                setAiConfig({
                  ...aiConfig,
                  ontologyAgent: {
                    ...aiConfig.ontologyAgent,
                    enabled: isSelected,
                  },
                })
              }
            />

            <Toggle
              isDisabled={isUpdating}
              isSelected={aiConfig.ontologyAgent?.deriveGlossaryTerms ?? false}
              label={t('label.derive-glossary-term-plural')}
              onChange={(isSelected) =>
                setAiConfig({
                  ...aiConfig,
                  ontologyAgent: {
                    ...aiConfig.ontologyAgent,
                    deriveGlossaryTerms: isSelected,
                  },
                })
              }
            />

            <Toggle
              isDisabled={isUpdating}
              isSelected={aiConfig.ontologyAgent?.deriveMetrics ?? false}
              label={t('label.derive-metric-plural')}
              onChange={(isSelected) =>
                setAiConfig({
                  ...aiConfig,
                  ontologyAgent: {
                    ...aiConfig.ontologyAgent,
                    deriveMetrics: isSelected,
                  },
                })
              }
            />

            <div className="tw:w-64">
              <Typography.Text className="tw:block tw:mb-1 tw:text-sm">
                {t('label.deletion-policy')}
              </Typography.Text>

              <Select
                isDisabled={isUpdating}
                label=""
                value={
                  aiConfig.ontologyAgent?.deletionPolicy ??
                  DeletionPolicy.Cascade
                }
                onChange={(key) =>
                  setAiConfig({
                    ...aiConfig,
                    ontologyAgent: {
                      ...aiConfig.ontologyAgent,
                      deletionPolicy: key as DeletionPolicy,
                    },
                  })
                }>
                {DELETION_POLICY_OPTIONS.map((opt) => (
                  <Select.Item
                    id={opt.id}
                    key={opt.id}
                    label={t(opt.labelKey)}
                  />
                ))}
              </Select>
            </div>
          </div>
        </Col>

        <Col span={24}>
          <Typography.Title className="text-sm font-semibold" level={5}>
            {t('label.prompt-plural')}
          </Typography.Title>

          <div className="tw:flex tw:flex-col tw:gap-6 tw:mt-3">
            <div>
              <TextArea
                data-testid="memory-extraction-prompt"
                isDisabled={isUpdating}
                label={t('label.memory-extraction-prompt')}
                placeholder={t('message.enter-system-prompt')}
                rows={6}
                value={aiConfig.prompts?.memoryExtraction?.systemPrompt ?? ''}
                onChange={(value) =>
                  setAiConfig({
                    ...aiConfig,
                    prompts: {
                      ...aiConfig.prompts,
                      memoryExtraction: {
                        ...aiConfig.prompts?.memoryExtraction,
                        systemPrompt: value,
                      },
                    },
                  })
                }
              />
            </div>

            <div>
              <TextArea
                data-testid="ontology-agent-prompt"
                isDisabled={isUpdating}
                label={t('label.ontology-agent-prompt')}
                placeholder={t('message.enter-system-prompt')}
                rows={6}
                value={aiConfig.prompts?.ontologyAgent?.systemPrompt ?? ''}
                onChange={(value) =>
                  setAiConfig({
                    ...aiConfig,
                    prompts: {
                      ...aiConfig.prompts,
                      ontologyAgent: {
                        ...aiConfig.prompts?.ontologyAgent,
                        systemPrompt: value,
                      },
                    },
                  })
                }
              />
            </div>
          </div>
        </Col>

        <Col span={24}>
          <Typography.Title className="text-sm font-semibold" level={5}>
            {t('label.mcp-chat')}
          </Typography.Title>

          <div className="tw:flex tw:flex-col tw:gap-4 tw:mt-3">
            <Toggle
              data-testid="mcp-chat-toggle"
              isDisabled={isUpdating}
              isSelected={aiConfig.mcpChat?.enabled ?? false}
              label={t('label.enable-entity', { entity: t('label.mcp-chat') })}
              onChange={(isSelected) =>
                setAiConfig({
                  ...aiConfig,
                  mcpChat: { ...aiConfig.mcpChat, enabled: isSelected },
                })
              }
            />

            <TextArea
              data-testid="mcp-chat-prompt"
              isDisabled={isUpdating}
              label={t('label.mcp-chat-prompt')}
              placeholder={t('message.enter-system-prompt')}
              rows={6}
              value={aiConfig.mcpChat?.systemPrompt ?? ''}
              onChange={(value) =>
                setAiConfig({
                  ...aiConfig,
                  mcpChat: { ...aiConfig.mcpChat, systemPrompt: value },
                })
              }
            />
          </div>
        </Col>

        <Col span={24}>
          <Typography.Title className="text-sm font-semibold" level={5}>
            {t('label.mcp-server')}
          </Typography.Title>

          <div className="tw:flex tw:flex-col tw:gap-4 tw:mt-3">
            <Toggle
              data-testid="mcp-server-toggle"
              isDisabled={isUpdating}
              isSelected={mcpConfig.enabled ?? false}
              label={t('label.enable-entity', {
                entity: t('label.mcp-server'),
              })}
              onChange={(isSelected) =>
                setMcpConfig({ ...mcpConfig, enabled: isSelected })
              }
            />

            <div className="tw:max-w-md">
              <Input
                data-testid="mcp-server-path"
                isDisabled={isUpdating}
                label={t('label.path')}
                value={mcpConfig.path ?? ''}
                onChange={(value) =>
                  setMcpConfig({ ...mcpConfig, path: value })
                }
              />
            </div>

            <Toggle
              data-testid="mcp-server-origin-validation-toggle"
              isDisabled={isUpdating}
              isSelected={mcpConfig.originValidationEnabled ?? false}
              label={t('label.origin-validation')}
              onChange={(isSelected) =>
                setMcpConfig({
                  ...mcpConfig,
                  originValidationEnabled: isSelected,
                })
              }
            />

            <div className="tw:max-w-md">
              <Input
                data-testid="mcp-server-origin-header"
                isDisabled={isUpdating}
                label={t('label.origin-header-uri')}
                value={mcpConfig.originHeaderUri ?? ''}
                onChange={(value) =>
                  setMcpConfig({ ...mcpConfig, originHeaderUri: value })
                }
              />
            </div>

            <div className="tw:max-w-md">
              <Input
                data-testid="mcp-server-allowed-origins"
                isDisabled={isUpdating}
                label={t('label.allowed-origin-plural')}
                value={(mcpConfig.allowedOrigins ?? []).join(', ')}
                onChange={(value) =>
                  setMcpConfig({
                    ...mcpConfig,
                    allowedOrigins: value
                      .split(',')
                      .map((origin) => origin.trim())
                      .filter(Boolean),
                  })
                }
              />
            </div>
          </div>
        </Col>

        <Col span={24}>
          <div className="tw:flex tw:gap-3">
            <Button
              color="primary"
              data-testid="ai-settings-save"
              isDisabled={isUpdating}
              isLoading={isUpdating}
              onPress={handleSave}>
              {t('label.save')}
            </Button>

            <Button
              color="secondary"
              data-testid="ai-settings-reset"
              isDisabled={isUpdating}
              onPress={handleReset}>
              {t('label.reset')}
            </Button>
          </div>
        </Col>
      </Row>
    </PageLayoutV1>
  );
};

export default AISettingsPage;
