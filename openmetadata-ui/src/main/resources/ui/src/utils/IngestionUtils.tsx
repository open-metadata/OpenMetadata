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

import { Typography } from 'antd';
import ErrorPlaceHolder from '../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import {
  DATA_INSIGHTS_PIPELINE_DOCS,
  ELASTIC_SEARCH_RE_INDEX_PIPELINE_DOCS,
  INGESTION_FRAMEWORK_DEPLOYMENT_DOCS,
  WORKFLOWS_METADATA_DOCS,
} from '../constants/docs.constants';
import { PIPELINE_TYPE_LOCALIZATION } from '../constants/Ingestions.constant';
import { ERROR_PLACEHOLDER_TYPE } from '../enums/common.enum';
import { FormSubmitType } from '../enums/form.enum';
import { PipelineType } from '../generated/api/services/ingestionPipelines/createIngestionPipeline';
import { UIThemePreference } from '../generated/configuration/uiThemePreference';
import i18n, { Transi18next } from './i18next/LocalUtil';
import {
  getBreadCrumbsArray,
  getDefaultFilterPropertyFieldsFromSchema,
  getDefaultFilterPropertyValues,
  getDefaultIngestionSchedule,
  getIngestionHeadingName,
  getIngestionStatusCountData,
  getIngestionTypes,
  getSettingsPathFromPipelineType,
  getSupportedPipelineTypes,
  getTypeAndStatusMenuItems,
} from './IngestionConfigUtils';

export {
  getBreadCrumbsArray,
  getDefaultFilterPropertyFieldsFromSchema,
  getDefaultFilterPropertyValues,
  getDefaultIngestionSchedule,
  getIngestionHeadingName,
  getIngestionStatusCountData,
  getIngestionTypes,
  getSettingsPathFromPipelineType,
  getSupportedPipelineTypes,
  getTypeAndStatusMenuItems,
};

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
          <Typography.Paragraph className="w-max-500">
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
          </Typography.Paragraph>
        </>
      );
    case PipelineType.ElasticSearchReindex:
      return (
        <>
          <Typography.Paragraph className="w-max-500">
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
          </Typography.Paragraph>
        </>
      );
    default:
      return (
        <Typography.Paragraph className="w-max-500">
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
                style={{ color: theme.primaryColor }}
                target="_blank"
              />
            }
            values={{
              link: t(
                `label.${
                  isPlatFormDisabled
                    ? 'documentation-lowercase'
                    : 'metadata-ingestion'
                }`
              ),
            }}
          />
        </Typography.Paragraph>
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
      <ErrorPlaceHolder
        className="p-y-lg border-none"
        type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
        {getPipelineExtraInfo(isPlatFormDisabled, theme, pipelineType)}
      </ErrorPlaceHolder>
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

