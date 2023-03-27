/*
 *  Copyright 2023 Collate.
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
import { Affix, Card } from 'antd';
import RichTextEditorPreviewer from 'components/common/rich-text-editor/RichTextEditorPreviewer';
import { oneofOrEndsWithNumberRegex } from 'constants/regex.constants';
import {
  addDBTIngestionGuide,
  addLineageIngestionGuide,
  addMetadataIngestionGuide,
  addProfilerIngestionGuide,
  addServiceGuide,
  addServiceGuideWOAirflow,
  addUsageIngestionGuide,
} from 'constants/service-guide.constant';
import { ServiceCategory } from 'enums/service.enum';
import { PipelineType } from 'generated/entity/services/ingestionPipelines/ingestionPipeline';
import { useAirflowStatus } from 'hooks/useAirflowStatus';
import { first, last, startCase } from 'lodash';
import React, { FC, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchMarkdownFile } from 'rest/miscAPI';
import { SupportedLocales } from 'utils/i18next/i18nextUtil';
import { getFormattedGuideText, getServiceType } from 'utils/ServiceUtils';

export type ExcludedPipelineType = Exclude<
  PipelineType,
  | PipelineType.DataInsight
  | PipelineType.ElasticSearchReindex
  | PipelineType.TestSuite
>;

interface RightPanelProps {
  activeStep: number;
  isIngestion: boolean;
  serviceName: string;
  isUpdating: boolean;
  selectedService: string;
  selectedServiceCategory: ServiceCategory;
  showDeployedTitle?: boolean;
  pipelineType?: ExcludedPipelineType;
  ingestionName?: string;
  activeField?: string;
}

const ingestionGuideMap = {
  [PipelineType.Usage]: addUsageIngestionGuide,
  [PipelineType.Lineage]: addLineageIngestionGuide,
  [PipelineType.Profiler]: addProfilerIngestionGuide,
  [PipelineType.Dbt]: addDBTIngestionGuide,
  [PipelineType.Metadata]: addMetadataIngestionGuide,
};

const RightPanel: FC<RightPanelProps> = ({
  isIngestion,
  pipelineType,
  activeStep,
  isUpdating,
  ingestionName,
  serviceName,
  activeField,
  selectedServiceCategory,
  selectedService,
  showDeployedTitle = false,
}) => {
  const { isAirflowAvailable } = useAirflowStatus();
  const { t, i18n } = useTranslation();
  const [activeFieldDocument, setActiveFieldDocument] = useState<string>('');

  const activeStepGuide = useMemo(() => {
    let guideTemp;

    if (isIngestion && pipelineType) {
      guideTemp = ingestionGuideMap[pipelineType]?.find(
        (item) => item.step === activeStep
      );
    } else {
      guideTemp =
        !isAirflowAvailable && activeStep === 4
          ? addServiceGuideWOAirflow
          : addServiceGuide.find((item) => item.step === activeStep);
    }

    return guideTemp;
  }, [isIngestion, pipelineType, isAirflowAvailable, activeStep]);

  const activeFieldName = useMemo(() => {
    /**
     * active field is like root_fieldName
     * so we need to split and get the fieldName
     */
    const fieldNameArr = activeField?.split('/');

    const fieldName = last(fieldNameArr);

    // check if activeField is select or list field
    if (oneofOrEndsWithNumberRegex.test(fieldName ?? '')) {
      return first(fieldName?.split('_'));
    } else {
      return fieldName;
    }
  }, [activeField]);

  const getActiveStepTitle = (title: string) => {
    const deployMessage = showDeployedTitle ? ` & ${t('label.deployed')}` : '';
    const updateTitle = title.replace(
      t('label.added'),
      `${t('label.updated')}${deployMessage}`
    );
    const newTitle = showDeployedTitle
      ? title.replace(t('label.added'), `${t('label.added')}${deployMessage}`)
      : title;

    return isUpdating ? updateTitle : newTitle;
  };

  const getActiveStepDescription = (description: string) => {
    const replaceText = isIngestion
      ? `<${t('label.ingestion-pipeline-name')}>`
      : `<${t('label.service-name')}>`;

    const replacement = isIngestion ? ingestionName || '' : serviceName;

    return getFormattedGuideText(description, replaceText, replacement);
  };

  const activeStepGuideElement = activeStepGuide ? (
    <>
      <h6 className="tw-heading tw-text-base">
        {getActiveStepTitle(activeStepGuide.title)}
      </h6>
      <div className="tw-mb-5" data-test="current-step-guide">
        {getActiveStepDescription(activeStepGuide.description)}
      </div>
    </>
  ) : null;

  const activeFieldDocumentElement = activeFieldName ? (
    <>
      <h6 className="tw-heading tw-text-base" data-testid="active-field-name">
        {startCase(activeFieldName)}
      </h6>
      <RichTextEditorPreviewer
        enableSeeMoreVariant={false}
        markdown={activeFieldDocument}
        maxLength={activeFieldDocument.length}
      />
    </>
  ) : null;

  const fetchFieldDocument = async () => {
    const serviceType = getServiceType(selectedServiceCategory);
    try {
      let response = '';
      const isEnglishLanguage = i18n.language === SupportedLocales.English;
      const filePath = `${i18n.language}/${serviceType}/${selectedService}/fields/${activeFieldName}.md`;
      const fallbackFilePath = `${SupportedLocales.English}/${serviceType}/${selectedService}/fields/${activeFieldName}.md`;

      const [translation, fallbackTranslation] = await Promise.allSettled([
        fetchMarkdownFile(filePath),
        isEnglishLanguage
          ? Promise.reject('')
          : fetchMarkdownFile(fallbackFilePath),
      ]);

      if (translation.status === 'fulfilled') {
        response = translation.value;
      }

      if (isEnglishLanguage && fallbackTranslation.status === 'fulfilled') {
        response = fallbackTranslation.value;
      }

      setActiveFieldDocument(response);
    } catch (error) {
      setActiveFieldDocument('');
    }
  };

  useEffect(() => {
    // only fetch file when required fields are present
    const shouldFetchFieldDoc =
      selectedService && selectedServiceCategory && activeFieldName;
    if (shouldFetchFieldDoc) {
      fetchFieldDocument();
    }
  }, [selectedService, selectedServiceCategory, activeFieldName]);

  const showActiveFieldDocument = activeFieldName && activeFieldDocument;

  return (
    <Affix offsetTop={0}>
      <Card>
        {showActiveFieldDocument
          ? activeFieldDocumentElement
          : activeStepGuideElement}
      </Card>
    </Affix>
  );
};

export default RightPanel;
