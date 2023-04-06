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
import RichTextEditorPreviewer from 'components/common/rich-text-editor/RichTextEditorPreviewer';
import Loader from 'components/Loader/Loader';
import { oneofOrEndsWithNumberRegex } from 'constants/regex.constants';
import { first, last } from 'lodash';
import React, { FC, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchMarkdownFile } from 'rest/miscAPI';
import { SupportedLocales } from 'utils/i18next/i18nextUtil';
import './ServiceDocPanel.less';

interface ServiceDocPanelProp {
  serviceName: string;
  serviceType: string;
  isPipelineDeployed?: boolean;
  activeField?: string;
}

const ServiceDocPanel: FC<ServiceDocPanelProp> = ({
  serviceType,
  serviceName,
  activeField,
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

      const fieldName = last(fieldNameArr) ?? '';

      // check if activeField is select or list field
      if (oneofOrEndsWithNumberRegex.test(fieldName)) {
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
      let response = '';
      const isEnglishLanguage = i18n.language === SupportedLocales.English;
      const filePath = `${i18n.language}/${serviceType}/${serviceName}.md`;
      const fallbackFilePath = `${SupportedLocales.English}/${serviceType}/${serviceName}.md`;

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
    const fieldName = getActiveFieldName(activeField);
    if (fieldName) {
      const element = document.getElementById(fieldName);
      if (element) {
        element.scrollIntoView({
          block: 'center',
          behavior: 'smooth',
          inline: 'center',
        });
        element.setAttribute('data-highlighted', 'true');
        setTimeout(() => {
          element.setAttribute('data-highlighted', 'false');
        }, 2000);
      }
    }
  }, [activeField, getActiveFieldName]);

  if (isLoading) {
    return <Loader />;
  }

  return (
    <Row data-testid="service-requirements">
      <Col span={24}>
        <RichTextEditorPreviewer
          enableSeeMoreVariant={false}
          markdown={markdownContent}
          maxLength={markdownContent.length}
        />
      </Col>
    </Row>
  );
};

export default ServiceDocPanel;
