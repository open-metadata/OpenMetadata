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
import { ArrowUpRight, BookOpen01, Key01, Lock01 } from '@untitledui/icons';
import { Col, Row } from 'antd';
import { TFunction } from 'i18next';
import { first, last, noop, startCase } from 'lodash';
import {
  FC,
  lazy,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { CONNECTORS_DOCS } from '../../../constants/docs.constants';
import {
  ENDS_WITH_NUMBER_REGEX,
  ONEOF_ANYOF_ALLOF_REGEX,
} from '../../../constants/regex.constants';
import { OPTIONAL_SCOPE_PROPERTIES } from '../../../constants/ServiceType.constant';
import { PipelineType } from '../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { fetchMarkdownFile } from '../../../rest/miscAPI';
import { getServiceLogo } from '../../../utils/EntityDisplayUtils';
import { languageMap } from '../../../utils/i18next/i18nextUtil';
import { SupportedLocales } from '../../../utils/i18next/LocalUtil.interface';
import { ConnectionFieldSection } from '../../../utils/ServiceConnectionUtils';
import { getActiveFieldNameForAppDocs } from '../../../utils/ServicePureUtils';
import { processDocMarkdown } from '../../../utils/ServiceUtils';
import withSuspenseFallback from '../../AppRouter/withSuspenseFallback';
import { SearchedDataProps } from '../../SearchedData/SearchedData.interface';
import Loader from '../Loader/Loader';
import RichTextEditorPreviewerV1 from '../RichTextEditor/RichTextEditorPreviewerV1';
import './service-doc-panel.less';
const EntitySummaryPanel = withSuspenseFallback(
  lazy(
    () =>
      import('../../Explore/EntitySummaryPanel/EntitySummaryPanel.component')
  )
);
interface ServiceDocPanelProp {
  serviceName: string;
  serviceType: string;
  activeField?: string;
  activeFieldMeta?: {
    title?: string;
    description?: string;
    section?: ConnectionFieldSection;
  };
  focusedMode?: boolean;
  isWorkflow?: boolean;
  workflowType?: PipelineType;
  selectedEntity?: SearchedDataProps['data'][number]['_source'];
}

const supportedLocales = Object.values(SupportedLocales) as string[];
const AUTH_FIELD_NAMES = new Set([
  'authType',
  'password',
  'privateKey',
  'snowflakePrivatekeyPassphrase',
  'passphrase',
  'token',
  'apiKey',
  'secretKey',
  'clientSecret',
  'consumerSecret',
  'securityToken',
]);
const NESTED_FOCUS_FIELDS = new Set([
  'connectionOptions',
  'connectionArguments',
  'sampleDataStorageConfig',
  'policyAgentConfig',
]);
const LINEAGE_FIELDS = new Set(['useAccessHistory', 'accessHistoryChunkSize']);

const SECTION_EYEBROW_LABELS: Record<ConnectionFieldSection, string> = {
  connection: 'label.connection',
  authentication: 'label.authentication',
  scope: 'label.scope-and-option-plural',
  advanced: 'label.advanced-config',
};

const getSectionEyebrow = (
  fieldName: string | undefined,
  isWorkflow: boolean | undefined,
  t: TFunction,
  resolvedSection?: ConnectionFieldSection
): string => {
  let eyebrow = t('label.connection');
  if (resolvedSection) {
    eyebrow = t(SECTION_EYEBROW_LABELS[resolvedSection]);
  } else if (fieldName && LINEAGE_FIELDS.has(fieldName)) {
    eyebrow = t('label.advanced-config');
  } else if (fieldName && OPTIONAL_SCOPE_PROPERTIES.has(fieldName)) {
    eyebrow = t('label.scope-and-option-plural');
  } else if (isWorkflow) {
    eyebrow = t('label.configuration');
  }

  return eyebrow;
};

interface FocusedDocDetails {
  eyebrow: string;
  title: string;
  description: string;
  markdown: string;
  beforeRequirements?: ReactNode;
}

interface RequirementLabels {
  autoClassification: string;
  lineage: string;
  metadata: string;
  profiler: string;
}

const getSupportedLanguage = (language: string): SupportedLocales => {
  if (supportedLocales.includes(language)) {
    return language as SupportedLocales;
  }

  return languageMap[language.split('-')[0]] ?? SupportedLocales.English;
};

const isUsableMarkdown = (content: string) => {
  const trimmedContent = content.trimStart().toLowerCase();

  return (
    Boolean(trimmedContent) &&
    !trimmedContent.startsWith('<!--') &&
    !trimmedContent.startsWith('<!doctype') &&
    !trimmedContent.startsWith('<html')
  );
};

const extractRequirementsMarkdown = (content: string): string => {
  const startIndex = content.search(/^## Requirements\b/m);
  if (startIndex < 0) {
    return '';
  }

  const fromRequirements = content.slice(startIndex);
  const nextHeadingIndex = fromRequirements.slice(1).search(/\n##\s/);

  return (
    nextHeadingIndex < 0
      ? fromRequirements
      : fromRequirements.slice(0, nextHeadingIndex + 1)
  ).trim();
};

const stripMarkdownScaffold = (content: string): string =>
  content
    .replace(/^\$\$section\s*$/gm, '')
    .replace(/^\$\$\s*$/gm, '')
    .replace(/\s*\$\(id="[^"]+"\)/g, '')
    .trim();

const stripRequirementMarkdownScaffold = (content: string): string =>
  content.replace(/\s*\$\(id="[^"]+"\)/g, '').trim();

const extractFocusedRequirementsMarkdown = (
  content: string,
  labels: RequirementLabels
): string => {
  const requirementsMarkdown = extractRequirementsMarkdown(content);
  const body = stripRequirementMarkdownScaffold(
    requirementsMarkdown.replace(/^## Requirements\s*/m, '')
  );

  if (!body) {
    return '';
  }

  const firstSubHeadingIndex = body.search(/^###\s/m);
  const markdownWithMetadataHeading =
    firstSubHeadingIndex > 0
      ? [
          `### ${labels.metadata}`,
          body.slice(0, firstSubHeadingIndex).trim(),
          body.slice(firstSubHeadingIndex).trim(),
        ].join('\n\n')
      : body;

  return markdownWithMetadataHeading
    .replace(/^### Usage & Lineage\b/gm, `### ${labels.lineage}`)
    .replace(/^### Profiler & Data Quality\b/gm, `### ${labels.profiler}`)
    .replace(/^### Auto Classification\b/gm, `### ${labels.autoClassification}`)
    .trim();
};

const extractHeadingSection = (
  content: string,
  heading: string,
  level: number
): string => {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const startIndex = content.search(
    new RegExp(`^#{${level}}\\s+${escapedHeading}\\b`, 'm')
  );

  if (startIndex < 0) {
    return '';
  }

  const section = content.slice(startIndex);
  const nextHeadingIndex = section
    .slice(1)
    .search(new RegExp(`\\n#{1,${level}}\\s`));

  return stripMarkdownScaffold(
    (nextHeadingIndex < 0
      ? section
      : section.slice(0, nextHeadingIndex + 1)
    ).trim()
  );
};

const extractSectionById = (content: string, fieldName: string): string => {
  const section = content
    .split('$$section')
    .slice(1)
    .map((block) => `$$section${block}`)
    .find((block) => block.includes(`$(id="${fieldName}")`));

  return section?.trim() ?? '';
};

const getFocusedFieldNames = (fieldName?: string): string[] => {
  if (!fieldName) {
    return [];
  }

  if (fieldName === 'authType') {
    return [
      'password',
      'privateKey',
      'snowflakePrivatekeyPassphrase',
      'token',
      'apiKey',
      'secretKey',
      'clientSecret',
      'consumerSecret',
      'securityToken',
    ];
  }

  return [fieldName];
};

const getFieldMarkdown = (
  markdownContent: string,
  fieldName?: string
): string => {
  if (!fieldName) {
    return '';
  }

  if (LINEAGE_FIELDS.has(fieldName)) {
    return extractHeadingSection(markdownContent, 'Usage & Lineage', 3);
  }

  return stripMarkdownScaffold(
    getFocusedFieldNames(fieldName)
      .map((name) => extractSectionById(markdownContent, name))
      .filter(Boolean)
      .join('\n\n')
  );
};

const getFocusedMarkdown = (
  markdownContent: string,
  fieldName?: string
): string => {
  const fieldMarkdown = getFieldMarkdown(markdownContent, fieldName);

  return fieldMarkdown || markdownContent;
};

const getConnectorDocsUrl = (markdownContent: string) => {
  const docsPath = markdownContent.match(
    /https:\/\/docs\.open-metadata\.org\/(?:latest\/|v[\d.x]+\/)?connectors\/([^"'\s)]+)/
  )?.[1];

  return docsPath ? `${CONNECTORS_DOCS}/${docsPath}` : CONNECTORS_DOCS;
};

const getMarkdownHeading = (markdown: string) =>
  markdown.match(/^#{1,6}\s+(.+)$/m)?.[1];

const stripLeadingMarkdownHeading = (markdown: string) =>
  markdown.replace(/^#{1,6}\s+.+\n?/m, '').trim();

const getServiceTypeDisplay = (serviceType: string, serviceLabel: string) =>
  serviceType.endsWith('Service')
    ? startCase(serviceType)
    : `${startCase(serviceType)} ${serviceLabel}`;

const MarkdownBlock = ({
  markdown,
  className,
}: {
  markdown: string;
  className?: string;
}) => {
  const processedMarkdown = useMemo(
    () => processDocMarkdown(markdown),
    [markdown]
  );

  if (!markdown) {
    return null;
  }

  return (
    <RichTextEditorPreviewerV1
      className={`service-doc-content focused-doc-markdown${
        className ? ` ${className}` : ''
      }`}
      enableSeeMoreVariant={false}
      extensionOptions={{
        enableAdmonitionNode: true,
        enableCodeBlockCopy: true,
        enableSectionNode: true,
      }}
      markdown={processedMarkdown}
    />
  );
};

const AuthGuidance = ({
  passwordLabel,
  keyPairLabel,
  passwordDescription,
  keyPairDescription,
}: {
  passwordLabel: string;
  keyPairLabel: string;
  passwordDescription: string;
  keyPairDescription: string;
}) => (
  <div className="focused-doc-auth-grid">
    <div className="focused-doc-auth-card focused-doc-auth-card-password">
      <div className="focused-doc-auth-title-row">
        <Lock01 size={16} />
        <span>{passwordLabel}</span>
      </div>
      <p>{passwordDescription}</p>
    </div>
    <div className="focused-doc-auth-card focused-doc-auth-card-keypair">
      <div className="focused-doc-auth-title-row">
        <Key01 size={16} />
        <span>{keyPairLabel}</span>
      </div>
      <p>{keyPairDescription}</p>
    </div>
  </div>
);

const ServiceDocPanel: FC<ServiceDocPanelProp> = ({
  serviceType,
  serviceName,
  activeField,
  activeFieldMeta,
  focusedMode = false,
  isWorkflow,
  workflowType,
  selectedEntity,
}) => {
  const { i18n, t } = useTranslation();

  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [markdownContent, setMarkdownContent] = useState<string>('');
  const [isMarkdownReady, setIsMarkdownReady] = useState<boolean>(false);

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
      const nestedField = fieldNameArr.find((field) =>
        NESTED_FOCUS_FIELDS.has(field)
      );
      if (nestedField) {
        return nestedField;
      }

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
      const language = getSupportedLanguage(i18n.language);
      const isEnglishLanguage = language === SupportedLocales.English;
      let filePath = `${language}/${supportedServiceType}/${serviceName}.md`;
      let fallbackFilePath = `${SupportedLocales.English}/${supportedServiceType}/${serviceName}.md`;

      if (isWorkflow && workflowType) {
        filePath = `${i18n.language}/${supportedServiceType}/workflows/${workflowType}.md`;
        fallbackFilePath = `${SupportedLocales.English}/${supportedServiceType}/workflows/${workflowType}.md`;
      }

      const [translation, fallbackTranslation] = await Promise.allSettled([
        fetchMarkdownFile(filePath),
        isEnglishLanguage
          ? Promise.reject(new Error('Fallback not needed for English locale'))
          : fetchMarkdownFile(fallbackFilePath),
      ]);

      if (
        translation.status === 'fulfilled' &&
        isUsableMarkdown(translation.value)
      ) {
        response = translation.value;
      } else if (
        fallbackTranslation.status === 'fulfilled' &&
        isUsableMarkdown(fallbackTranslation.value)
      ) {
        response = fallbackTranslation.value;
      }

      setMarkdownContent(
        response.replaceAll(
          'OpenMetadata',
          process.env.BRAND_NAME ?? 'OpenMetadata'
        )
      );
    } catch {
      setMarkdownContent('');
    } finally {
      setIsLoading(false);
      setIsMarkdownReady(true);
    }
  };

  useEffect(() => {
    fetchRequirement();
  }, [serviceName, serviceType]);

  const activeFieldName = useMemo(
    () =>
      serviceType === 'Applications'
        ? getActiveFieldNameForAppDocs(activeField)
        : getActiveFieldName(activeField),
    [activeField, getActiveFieldName, serviceType]
  );

  useEffect(() => {
    if (!isMarkdownReady || focusedMode) {
      return;
    }

    if (activeFieldName) {
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        // Remove all previous highlights first
        const previousHighlighted = document.querySelectorAll(
          '[data-highlighted="true"]'
        );
        previousHighlighted.forEach((el) => {
          (el as HTMLElement).dataset.highlighted = 'false';
        });

        const element = document.querySelector(
          `[data-id="${CSS.escape(activeFieldName)}"]`
        );
        if (element) {
          element.scrollIntoView({
            block: activeFieldName === 'selected-entity' ? 'start' : 'center',
            behavior: 'smooth',
            inline: 'center',
          });
          (element as HTMLElement).dataset.highlighted = 'true';
        }
      });
    }
  }, [activeFieldName, focusedMode, isMarkdownReady]);

  const displayMarkdown = useMemo(
    () =>
      focusedMode
        ? getFocusedMarkdown(markdownContent, activeFieldName)
        : markdownContent,
    [activeFieldName, focusedMode, markdownContent]
  );

  const processedHtml = useMemo(
    () => (focusedMode ? '' : processDocMarkdown(displayMarkdown)),
    [displayMarkdown, focusedMode]
  );

  const activeFieldMarkdown = useMemo(
    () => getFieldMarkdown(markdownContent, activeFieldName),
    [activeFieldName, markdownContent]
  );

  const focusedDocDetails = useMemo<FocusedDocDetails>(() => {
    const fieldTitle = getMarkdownHeading(activeFieldMarkdown);
    const fieldBody = stripLeadingMarkdownHeading(activeFieldMarkdown);

    if (activeFieldName === 'serviceName') {
      return {
        eyebrow: t('label.connection'),
        title: t('label.name-this-service'),
        description: t('message.service-name-doc-description', {
          serviceName,
        }),
        markdown: [
          `### ${t('label.service-name')}`,
          t('message.service-name-rule'),
        ].join('\n\n'),
      };
    }

    if (activeFieldName === 'serviceDescription') {
      return {
        eyebrow: t('label.connection'),
        title: t('label.description'),
        description: t('message.service-description-doc-description'),
        markdown: '',
      };
    }

    if (activeFieldName && AUTH_FIELD_NAMES.has(activeFieldName)) {
      if (activeFieldName === 'authType') {
        return {
          eyebrow: t('label.authentication'),
          title: t('message.authentication-doc-title'),
          description: t('message.authentication-doc-description'),
          markdown: fieldBody,
          beforeRequirements: (
            <AuthGuidance
              keyPairDescription={t('message.key-pair-auth-doc-description')}
              keyPairLabel={t('label.key-pair')}
              passwordDescription={t('message.password-auth-doc-description')}
              passwordLabel={t('label.password')}
            />
          ),
        };
      }

      return {
        eyebrow: t('label.authentication'),
        title: fieldTitle ?? startCase(activeFieldName),
        description: fieldBody
          ? t('message.focused-docs-fallback-description')
          : t('message.authentication-doc-description'),
        markdown: fieldBody,
      };
    }

    if (activeFieldName && !activeFieldMarkdown) {
      return {
        eyebrow: getSectionEyebrow(
          activeFieldName,
          isWorkflow,
          t,
          activeFieldMeta?.section
        ),
        title: activeFieldMeta?.title ?? startCase(activeFieldName),
        description:
          activeFieldMeta?.description ??
          t('message.openmetadata-docs-description'),
        markdown: '',
      };
    }

    return {
      eyebrow: getSectionEyebrow(
        activeFieldName,
        isWorkflow,
        t,
        activeFieldMeta?.section
      ),
      title:
        fieldTitle ??
        (activeFieldName ? startCase(activeFieldName) : t('label.setup-guide')),
      description:
        fieldBody || fieldTitle
          ? t('message.focused-docs-fallback-description')
          : t('message.openmetadata-docs-description'),
      markdown: fieldBody,
    };
  }, [
    activeFieldMarkdown,
    activeFieldMeta,
    activeFieldName,
    isWorkflow,
    serviceName,
    t,
  ]);

  const showFocusedRequirements = !activeFieldName;

  const focusedRequirementsMarkdown = useMemo(
    () =>
      showFocusedRequirements
        ? extractFocusedRequirementsMarkdown(markdownContent, {
            autoClassification: t('label.auto-classification'),
            lineage: t('label.lineage'),
            metadata: t('label.metadata'),
            profiler: t('label.profiler'),
          })
        : '',
    [markdownContent, showFocusedRequirements, t]
  );

  const connectorDocsUrl = useMemo(
    () => getConnectorDocsUrl(markdownContent),
    [markdownContent]
  );

  const docsPanel = useMemo(() => {
    if (focusedMode) {
      return (
        <div className="focused-service-docs">
          <div className="focused-service-docs-header">
            <div className="focused-service-docs-logo-wrap">
              {getServiceLogo(serviceName, 'focused-service-docs-logo')}
            </div>
            <div className="focused-service-docs-title-wrap">
              <div className="focused-service-docs-title">{serviceName}</div>
              <div className="focused-service-docs-subtitle">
                {getServiceTypeDisplay(serviceType, t('label.service'))}
              </div>
            </div>
          </div>

          <div className="focused-service-docs-intro">
            <div className="focused-service-docs-eyebrow">
              {focusedDocDetails.eyebrow}
            </div>
            <h1>{focusedDocDetails.title}</h1>
            <p>{focusedDocDetails.description}</p>
          </div>

          {focusedDocDetails.beforeRequirements}
          {focusedDocDetails.markdown && (
            <MarkdownBlock
              className="focused-service-docs-field-markdown"
              markdown={focusedDocDetails.markdown}
            />
          )}

          {focusedRequirementsMarkdown && (
            <div className="focused-service-docs-section">
              <h1>{t('label.requirement-plural')}</h1>
              <MarkdownBlock
                className="focused-service-docs-requirements-markdown"
                markdown={focusedRequirementsMarkdown}
              />
            </div>
          )}

          <div className="focused-service-docs-link-section">
            <a
              className="focused-service-docs-link"
              href={connectorDocsUrl}
              rel="noreferrer"
              target="_blank">
              <BookOpen01 size={16} />
              <span>
                {t('message.view-service-openmetadata-docs', {
                  serviceName,
                })}
              </span>
              <ArrowUpRight size={15} />
            </a>
            <span className="tw:text-xs tw:text-tertiary">
              {t('message.openmetadata-docs-description')}
            </span>
          </div>
        </div>
      );
    }

    return (
      <>
        <div className="entity-summary-in-docs" data-id="selected-entity">
          {selectedEntity && (
            <EntitySummaryPanel
              entityDetails={{
                details: selectedEntity,
              }}
              handleClosePanel={noop}
            />
          )}
        </div>
        <RichTextEditorPreviewerV1
          className={`service-doc-content${
            focusedMode ? ' service-doc-content-focused' : ''
          }`}
          enableSeeMoreVariant={false}
          extensionOptions={{
            enableAdmonitionNode: true,
            enableCodeBlockCopy: true,
            enableSectionNode: true,
          }}
          markdown={processedHtml}
        />
      </>
    );
  }, [
    connectorDocsUrl,
    focusedDocDetails,
    focusedMode,
    processedHtml,
    focusedRequirementsMarkdown,
    selectedEntity,
    serviceName,
    serviceType,
    t,
  ]);

  if (isLoading) {
    return <Loader />;
  }

  return (
    <Row
      className={focusedMode ? 'service-doc-panel-focused' : undefined}
      data-testid="service-requirements">
      <Col span={24}>{docsPanel}</Col>
    </Row>
  );
};

export default ServiceDocPanel;
