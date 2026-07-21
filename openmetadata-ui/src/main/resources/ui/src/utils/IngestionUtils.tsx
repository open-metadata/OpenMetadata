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
  Typography as CoreTypography,
  EmptyPlaceholder,
} from '@openmetadata/ui-core-components';
import { Code01 } from '@untitledui/icons';
import { Typography } from 'antd';
import { startCase } from 'lodash';
import {
  LogViewerModalProps,
  LogViewerStatusTone,
} from '../components/common/LogViewerModal/LogViewerModal.interface';
import { AgentStatus } from '../components/ServiceAgents/AgentsPage.interface';
import {
  DATA_INSIGHTS_PIPELINE_DOCS,
  ELASTIC_SEARCH_RE_INDEX_PIPELINE_DOCS,
  INGESTION_FRAMEWORK_DEPLOYMENT_DOCS,
  WORKFLOWS_METADATA_DOCS,
} from '../constants/docs.constants';
import { PIPELINE_TYPE_LOCALIZATION } from '../constants/Ingestions.constant';
import { FormSubmitType } from '../enums/form.enum';
import { PipelineType } from '../generated/api/services/ingestionPipelines/createIngestionPipeline';
import { UIThemePreference } from '../generated/configuration/uiThemePreference';
import i18n, { Transi18next } from './i18next/LocalUtil';

const { t } = i18n;

const getPipelineExtraInfo = (
  isPlatFormDisabled: boolean,
  theme: UIThemePreference['customTheme'],
  pipelineType?: PipelineType
) => {
  switch (pipelineType) {
    case PipelineType.DataInsight:
      return (
        <>
          <CoreTypography
            className="w-max-500 tw:text-secondary"
            size="text-xs">
            <Transi18next
              i18nKey="message.data-insight-pipeline-description"
              renderElement={
                <a
                  href={DATA_INSIGHTS_PIPELINE_DOCS}
                  rel="noreferrer"
                  style={{ color: theme.primaryColor }}
                  target="_blank"
                />
              }
              values={{
                link: t('label.data-insight-ingestion'),
              }}
            />
          </CoreTypography>
        </>
      );
    case PipelineType.ElasticSearchReindex:
      return (
        <>
          <CoreTypography
            className="w-max-500 tw:text-secondary"
            size="text-xs">
            <Transi18next
              i18nKey="message.elastic-search-re-index-pipeline-description"
              renderElement={
                <a
                  href={ELASTIC_SEARCH_RE_INDEX_PIPELINE_DOCS}
                  rel="noreferrer"
                  style={{ color: theme.primaryColor }}
                  target="_blank"
                />
              }
              values={{
                link: t('label.search-index-ingestion'),
              }}
            />
          </CoreTypography>
        </>
      );
    default:
      return (
        <CoreTypography className="w-max-500 tw:text-secondary" size="text-xs">
          <Transi18next
            i18nKey={
              isPlatFormDisabled
                ? 'message.pipeline-disabled-ingestion-deployment'
                : 'message.no-ingestion-description'
            }
            renderElement={
              <a
                href={
                  isPlatFormDisabled
                    ? INGESTION_FRAMEWORK_DEPLOYMENT_DOCS
                    : WORKFLOWS_METADATA_DOCS
                }
                rel="noreferrer"
                style={{ color: theme.primaryColor, fontSize: 'inherit' }}
                target="_blank"
              />
            }
            values={{
              link: t(
                `label.${
                  isPlatFormDisabled
                    ? 'documentation-lowercase'
                    : 'metadata-agent-plural'
                }`
              ),
            }}
          />
        </CoreTypography>
      );
  }
};

export const getErrorPlaceHolder = (
  ingestionDataLength: number,
  isPlatFormDisabled: boolean,
  theme: UIThemePreference['customTheme'],
  pipelineType?: PipelineType
) => {
  if (ingestionDataLength === 0) {
    return (
      <EmptyPlaceholder
        className="tw:bg-primary tw:border tw:border-secondary tw:rounded-xl"
        description={getPipelineExtraInfo(
          isPlatFormDisabled,
          theme,
          pipelineType
        )}
        icon={<Code01 className="tw:text-fg-brand-primary" />}
        title={t('message.no-agents-set-up-yet') as string}
        variant="blank"
      />
    );
  }

  return null;
};

export const getMenuItems = (
  types: PipelineType[],
  isDataSightIngestionExists: boolean
) => {
  return types.map((type) => ({
    label: t('label.add-workflow-agent', {
      workflow: t(`label.${PIPELINE_TYPE_LOCALIZATION[type]}`),
    }),
    key: type,
    disabled:
      type === PipelineType.DataInsight ? isDataSightIngestionExists : false,
    ['data-testid']: `agent-item-${type}`,
  }));
};

export const getSuccessMessage = (
  ingestionName: string,
  status: FormSubmitType,
  showDeployButton?: boolean
) => {
  const updateMessage = showDeployButton
    ? t('message.action-has-been-done-but-failed-to-deploy', {
        action: t('label.updated-lowercase'),
      })
    : t('message.action-has-been-done-but-deploy-successfully', {
        action: t('label.updated-lowercase'),
      });
  const createMessage = showDeployButton
    ? t('message.action-has-been-done-but-failed-to-deploy', {
        action: t('label.created-lowercase'),
      })
    : t('message.action-has-been-done-but-deploy-successfully', {
        action: t('label.created-lowercase'),
      });

  return (
    <Typography.Text>
      <Typography.Text className="font-medium break-word">{`"${ingestionName}"`}</Typography.Text>
      <Typography.Text>
        {status === FormSubmitType.ADD ? createMessage : updateMessage}
      </Typography.Text>
    </Typography.Text>
  );
};

const agentStatusToneMap: Record<AgentStatus, LogViewerStatusTone> = {
  running: 'muted',
  failed: 'error',
  success: 'success',
  queued: 'muted',
  none: 'muted',
};

export const getLogViewerStatusFromAgentStatus = (
  agentStatus?: AgentStatus
): LogViewerModalProps['status'] | undefined => {
  if (!agentStatus) {
    return;
  }

  const status: LogViewerModalProps['status'] = {
    label: startCase(agentStatus),
    tone: agentStatus ? agentStatusToneMap[agentStatus] : 'muted',
  };

  return status;
};
