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
import { Col, Row } from 'antd';
import { first, last } from 'lodash';
import { FC, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ENDS_WITH_NUMBER_REGEX,
  ONEOF_ANYOF_ALLOF_REGEX,
} from '../../../constants/regex.constants';
import { PipelineType } from '../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { fetchMarkdownFile } from '../../../rest/miscAPI';
import { SupportedLocales } from '../../../utils/i18next/i18nextUtil';
import { getActiveFieldNameForAppDocs } from '../../../utils/ServiceUtils';
import Loader from '../Loader/Loader';
import RichTextEditorPreviewer from '../RichTextEditor/RichTextEditorPreviewer';
import './service-doc-panel.less';

interface ServiceDocPanelProp {
  serviceName: string;
  serviceType: string;
  activeField?: string;
  isWorkflow?: boolean;
  workflowType?: PipelineType;
}

const ServiceDocPanel: FC<ServiceDocPanelProp> = ({
  serviceType,
  serviceName,
  activeField,
  isWorkflow,
  workflowType,
}) => {
  const { i18n } = useTranslation();

  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [markdownContent, setMarkdownContent] = useState<string>('');

  const getActiveFieldName = useCallback(
    (activeFieldValue?: ServiceDocPanelProp['activeField']) => {
      if (!activeFieldValue) {
        return;
      }

      /**
       * active field is like root/fieldName
       * so we need to split and get the fieldName
       */
      const fieldNameArr = activeFieldValue.split('/');

      /**
       * If active field ends with number then return the first index value
       */
      if (ENDS_WITH_NUMBER_REGEX.test(activeFieldValue)) {
        return fieldNameArr[1];
      }

      const fieldName = last(fieldNameArr) ?? '';

      /**
       * check if active field is select that is oneof, anyof or allof
       * then split it with "_" and return the first value
       */
      if (ONEOF_ANYOF_ALLOF_REGEX.test(fieldName)) {
        return first(fieldName.split('_'));
      } else {
        return fieldName;
      }
    },
    []
  );

  const fetchRequirement = async () => {
    setIsLoading(true);
    try {
      const supportedServiceType =
        serviceType === 'Api' ? 'ApiEntity' : serviceType;
      let response = '';
      const isEnglishLanguage = i18n.language === SupportedLocales.English;
      let filePath = `${i18n.language}/${supportedServiceType}/${serviceName}.md`;
      let fallbackFilePath = `${SupportedLocales.English}/${supportedServiceType}/${serviceName}.md`;

      if (isWorkflow && workflowType) {
        filePath = `${i18n.language}/${supportedServiceType}/workflows/${workflowType}.md`;
        fallbackFilePath = `${SupportedLocales.English}/${supportedServiceType}/workflows/${workflowType}.md`;
      }

      const [translation, fallbackTranslation] = await Promise.allSettled([
        fetchMarkdownFile(filePath),
        isEnglishLanguage
          ? Promise.reject('')
          : fetchMarkdownFile(fallbackFilePath),
      ]);

      if (translation.status === 'fulfilled') {
        response = translation.value;
      } else {
        if (fallbackTranslation.status === 'fulfilled') {
          response = fallbackTranslation.value;
        }
      }

      setMarkdownContent(response);
    } catch (error) {
      setMarkdownContent('');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequirement();
  }, [serviceName, serviceType]);

  useEffect(() => {
    const fieldName =
      serviceType === 'Applications'
        ? getActiveFieldNameForAppDocs(activeField)
        : getActiveFieldName(activeField);
    if (fieldName) {
      const element = document.querySelector(`[data-id="${fieldName}"]`);
      if (element) {
        element.scrollIntoView({
          block: 'center',
          behavior: 'smooth',
          inline: 'center',
        });
        element.setAttribute('data-highlighted', 'true');
      }
    }
  }, [activeField, getActiveFieldName, serviceType]);

  if (isLoading) {
    return <Loader />;
  }

  return (
    <Row data-testid="service-requirements">
      <Col span={24}>
        <RichTextEditorPreviewer
          enableSeeMoreVariant={false}
          markdown={markdownContent}
        />
      </Col>
    </Row>
  );
};

export default ServiceDocPanel;
