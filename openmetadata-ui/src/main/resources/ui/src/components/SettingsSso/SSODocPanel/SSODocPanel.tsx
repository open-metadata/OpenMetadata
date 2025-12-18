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
import { Typography } from 'antd';
import { first, last } from 'lodash';
import { FC, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ENDS_WITH_NUMBER_REGEX,
  ONEOF_ANYOF_ALLOF_REGEX,
} from '../../../constants/regex.constants';
import { AuthProvider } from '../../../generated/settings/settings';
import { fetchMarkdownFile } from '../../../rest/miscAPI';
import { SupportedLocales } from '../../../utils/i18next/LocalUtil.interface';
import {
  getProviderDisplayName,
  getProviderIcon,
} from '../../../utils/SSOUtils';
import Loader from '../../common/Loader/Loader';
import RichTextEditorPreviewer from '../../common/RichTextEditor/RichTextEditorPreviewer';
import './sso-doc-panel.less';
import { FIELD_MAPPINGS, PROVIDER_FILE_MAP } from './SSODocPanel.constants';

interface SSODocPanelProp {
  serviceName: string;
  activeField?: string;
}

const SSODocPanel: FC<SSODocPanelProp> = ({ serviceName, activeField }) => {
  const { i18n, t } = useTranslation();

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [markdownContent, setMarkdownContent] = useState<string>('');

  const getFieldGroup = (fieldName: string): string => {
    const lowerFieldName = fieldName.toLowerCase();

    // Direct mapping first
    if (FIELD_MAPPINGS[fieldName]) {
      return FIELD_MAPPINGS[fieldName];
    }

    // Try to find partial matches
    for (const [key, value] of Object.entries(FIELD_MAPPINGS)) {
      if (
        lowerFieldName.includes(key.toLowerCase()) ||
        key.toLowerCase().includes(lowerFieldName)
      ) {
        return value;
      }
    }

    return fieldName;
  };

  const getActiveFieldName = useCallback(
    (activeFieldValue?: SSODocPanelProp['activeField']) => {
      if (!activeFieldValue) {
        return;
      }

      const fieldNameArr = activeFieldValue.split('/');

      if (ENDS_WITH_NUMBER_REGEX.test(activeFieldValue)) {
        const result = fieldNameArr[1];

        return result;
      }

      const fieldName = last(fieldNameArr) ?? '';

      if (ONEOF_ANYOF_ALLOF_REGEX.test(fieldName)) {
        const result = first(fieldName.split('_'));

        return result;
      } else {
        return fieldName;
      }
    },
    []
  );

  const fetchRequirement = async () => {
    setIsLoading(true);
    try {
      const fileName = PROVIDER_FILE_MAP[serviceName] || serviceName;
      const isEnglishLanguage = i18n.language === SupportedLocales.English;
      const filePath = `${i18n.language}/SSO/${fileName}.md`;
      const fallbackFilePath = `${SupportedLocales.English}/SSO/${fileName}.md`;

      const [translation, fallbackTranslation] = await Promise.allSettled([
        fetchMarkdownFile(filePath),
        isEnglishLanguage
          ? Promise.reject('')
          : fetchMarkdownFile(fallbackFilePath),
      ]);

      let response = '';
      if (translation.status === 'fulfilled') {
        response = translation.value;
      } else {
        if (fallbackTranslation.status === 'fulfilled') {
          response = fallbackTranslation.value;
        }
      }

      const cleanedResponse = response.replace(/^---\n[\s\S]*?\n---\n/, '');
      setMarkdownContent(cleanedResponse);
    } catch (error) {
      setMarkdownContent('');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequirement();
  }, [serviceName]);

  useEffect(() => {
    const previouslyHighlighted = document.querySelectorAll(
      '[data-highlighted="true"]'
    );
    previouslyHighlighted.forEach((element) => {
      element.removeAttribute('data-highlighted');
    });

    const fieldName = getActiveFieldName(activeField);

    if (fieldName && markdownContent) {
      // Add delay to allow ToastUI viewer to render the DOM
      setTimeout(() => {
        const groupName = getFieldGroup(fieldName);

        let element = document.querySelector(`[data-id="${fieldName}"]`);

        if (!element) {
          element = document.querySelector(`[data-id="${groupName}"]`);
        }

        if (!element) {
          const possibleMatches = document.querySelectorAll('[data-id]');
          for (const match of possibleMatches) {
            const dataId = match.getAttribute('data-id');
            if (
              dataId &&
              (dataId === fieldName ||
                dataId.includes(fieldName) ||
                fieldName.includes(dataId) ||
                dataId === groupName ||
                dataId.includes(groupName) ||
                groupName.includes(dataId))
            ) {
              element = match;

              break;
            }
          }
        }

        if (element) {
          let targetElement: Element | null = element;
          while (
            targetElement &&
            !['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(
              targetElement.tagName
            )
          ) {
            targetElement = targetElement.parentElement;
          }

          const headingElement = targetElement || element;

          headingElement.scrollIntoView({
            block: 'center',
            behavior: 'smooth',
            inline: 'center',
          });

          // Collect all elements in the section
          const sectionElements = [headingElement];
          let nextElement = headingElement.nextElementSibling;
          while (
            nextElement &&
            !['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(nextElement.tagName)
          ) {
            if (
              nextElement.tagName === 'UL' ||
              nextElement.tagName === 'P' ||
              nextElement.tagName === 'DIV'
            ) {
              sectionElements.push(nextElement);
            }
            nextElement = nextElement.nextElementSibling;
          }

          // Apply highlighting class to all section elements
          sectionElements.forEach((sectionElement, index) => {
            sectionElement.setAttribute('data-highlighted', 'true');

            // Add position classes for seamless styling
            if (index === 0) {
              sectionElement.setAttribute('data-highlight-position', 'first');
            } else if (index === sectionElements.length - 1) {
              sectionElement.setAttribute('data-highlight-position', 'last');
            } else {
              sectionElement.setAttribute('data-highlight-position', 'middle');
            }
          });

          if (targetElement && element !== targetElement) {
            element.setAttribute('data-highlighted', 'true');
          }
        }
      }, 100);
    }
  }, [activeField, getActiveFieldName, markdownContent]);

  if (isLoading) {
    return <Loader />;
  }

  return (
    <div className="sso-doc-panel" data-testid="sso-requirements">
      <div className="sso-doc-content-wrapper">
        <div className="sso-doc-header">
          {getProviderIcon(serviceName) && (
            <div className="sso-provider-icon">
              <img
                alt={`${serviceName} icon`}
                height={22}
                src={getProviderIcon(serviceName) as string}
                width={22}
              />
            </div>
          )}
          <Typography.Title className="sso-provider-title text-md">
            {serviceName === AuthProvider.Basic
              ? t('label.basic-configuration')
              : `${getProviderDisplayName(serviceName)} ${t(
                  'label.sso-configuration'
                )}`}
          </Typography.Title>
        </div>
        <RichTextEditorPreviewer
          enableSeeMoreVariant={false}
          markdown={markdownContent}
        />
      </div>
    </div>
  );
};

export default SSODocPanel;
