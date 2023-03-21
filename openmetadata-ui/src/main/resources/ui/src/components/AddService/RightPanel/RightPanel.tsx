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
import { startCase } from 'lodash';
import React, { FC, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchMarkdownFile } from 'rest/miscAPI';
import { getFormattedGuideText, getServiceType } from 'utils/ServiceUtils';

type ExcludedPipelineType = Exclude<
  PipelineType,
  | PipelineType.DataInsight
  | PipelineType.ElasticSearchReindex
  | PipelineType.TestSuite
>;

interface RightPanelProps {
  activeStep: number;
  isIngestion: boolean;
  ingestionName: string;
  serviceName: string;
  pipelineType: ExcludedPipelineType;
  isUpdating: boolean;
  isAirflowRunning: boolean;
  selectedService: string;
  selectedServiceCategory: ServiceCategory;
  showDeployedTitle: boolean;
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
  isAirflowRunning,
  showDeployedTitle,
  isUpdating,
  ingestionName,
  serviceName,
  activeField,
  selectedServiceCategory,
  selectedService,
}) => {
  const { t, i18n } = useTranslation();
  const [activeFieldDocument, setActiveFieldDocument] = useState<string>('');

  const activeStepGuide = useMemo(() => {
    let guideTemp;

    if (isIngestion) {
      guideTemp = ingestionGuideMap[pipelineType]?.find(
        (item) => item.step === activeStep
      );
    } else {
      guideTemp =
        !isAirflowRunning && activeStep === 4
          ? addServiceGuideWOAirflow
          : addServiceGuide.find((item) => item.step === activeStep);
    }

    return guideTemp;
  }, [isIngestion, pipelineType, activeField, isAirflowRunning]);

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

    const replacement = isIngestion ? ingestionName : serviceName;

    return getFormattedGuideText(description, replaceText, replacement);
  };

  const activeStepGuideElement = activeStepGuide ? (
    <>
      <h6 className="tw-heading tw-text-base">
        {getActiveStepTitle(activeStepGuide.title)}
      </h6>
      <div className="tw-mb-5">
        {getActiveStepDescription(activeStepGuide.description)}
      </div>
    </>
  ) : null;

  const activeFieldDocumentElement = activeField ? (
    <>
      <h6 className="tw-heading tw-text-base">{startCase(activeField)}</h6>
      <RichTextEditorPreviewer
        markdown={activeFieldDocument}
        maxLength={activeFieldDocument.length}
      />
    </>
  ) : null;

  const fetchFieldDocument = async () => {
    const filePath = `${i18n.language}/${getServiceType(
      selectedServiceCategory
    )}/${selectedService}/connections/fields/${activeField}.md`;

    try {
      const response = await fetchMarkdownFile(filePath);

      setActiveFieldDocument(response);
    } catch (error) {
      setActiveFieldDocument('');
    }
  };

  useEffect(() => {
    fetchFieldDocument();
  }, [selectedService, selectedServiceCategory, activeField]);

  return (
    <Affix offsetTop={0}>
      <Card>
        {activeField ? activeFieldDocumentElement : activeStepGuideElement}
      </Card>
    </Affix>
  );
};

export default RightPanel;
