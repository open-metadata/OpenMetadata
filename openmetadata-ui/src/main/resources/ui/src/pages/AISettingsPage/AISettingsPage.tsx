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
import { Settings, SettingType } from '../../generated/settings/settings';
import {
  getSettingsByType,
  restoreSettingsConfig,
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

  const breadcrumbs: TitleBreadcrumbProps['titleLinks'] = useMemo(
    () =>
      getSettingPageEntityBreadCrumb(
        GlobalSettingsMenuCategory.PREFERENCES,
        t('label.ai')
      ),
    [t]
  );

  const fetchAIConfig = async () => {
    try {
      setIsLoading(true);

      const configValue = await getSettingsByType(SettingType.AiSettings);

      setAiConfig(configValue as AISettings);
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
        config_type: SettingType.AiSettings,
        config_value: aiConfig,
      };

      await updateSettingsConfig(configData);

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
      await restoreSettingsConfig(SettingType.AiSettings);
      await fetchAIConfig();
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
    fetchAIConfig();
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
          <div className="tw:flex tw:gap-3">
            <Button
              color="primary"
              isDisabled={isUpdating}
              isLoading={isUpdating}
              onPress={handleSave}>
              {t('label.save')}
            </Button>

            <Button
              color="secondary"
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
