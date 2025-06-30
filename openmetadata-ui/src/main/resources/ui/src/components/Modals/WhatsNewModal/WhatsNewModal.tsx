/*
 *  Copyright 2025 Collate.
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
  Carousel,
  Col,
  Modal,
  Row,
  Space,
  Spin,
  Typography,
} from 'antd';
import axios from 'axios';
import classNames from 'classnames';
import { CookieStorage } from 'cookie-storage';
import { FunctionComponent, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DE_ACTIVE_COLOR } from '../../../constants/constants';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { getReleaseVersionExpiry } from '../../../utils/WhatsNewModal.util';
import BlockEditor from '../../BlockEditor/BlockEditor';
import Loader from '../../common/Loader/Loader';
import RichTextEditorPreviewerV1 from '../../common/RichTextEditor/RichTextEditorPreviewerV1';
import CloseIcon from '../CloseIcon.component';
import { VersionIndicatorIcon } from '../VersionIndicatorIcon.component';
import './whats-new-modal.less';
import {
  ExternalVersionData,
  ToggleType,
  VersionContent,
  WhatsNewModalProps,
} from './WhatsNewModal.interface';

const cookieStorage = new CookieStorage();

// External API endpoints
const VERSIONS_API =
  'https://raw.githubusercontent.com/open-metadata/openmetadata-site/refs/heads/main/content/product-updates/versions.json';
const CONTENT_BASE_URL =
  'https://raw.githubusercontent.com/open-metadata/openmetadata-site/refs/heads/main/content/product-updates';

const WhatsNewModal: FunctionComponent<WhatsNewModalProps> = ({
  header,
  onCancel,
  visible,
}: WhatsNewModalProps) => {
  const { theme, appVersion } = useApplicationStore();
  const { t } = useTranslation();
  const [versions, setVersions] = useState<ExternalVersionData[]>([]);
  const [activeVersion, setActiveVersion] =
    useState<ExternalVersionData | null>(null);
  const [versionContent, setVersionContent] = useState<VersionContent | null>(
    null
  );
  const [checkedValue, setCheckedValue] = useState<ToggleType>(
    ToggleType.FEATURES
  );
  const [loading, setLoading] = useState(false);
  const [contentLoading, setContentLoading] = useState(false);

  // Fetch versions list from external API
  const fetchVersions = useCallback(async () => {
    try {
      setLoading(true);

      const response = await axios.get<ExternalVersionData[]>(VERSIONS_API);
      const versions = response.data;
      setVersions(versions);

      // Set the latest version (first in array) as active by default
      if (versions.length > 0) {
        setActiveVersion(versions[0]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Parse markdown content to extract features and changelog
  const parseMarkdownContent = (content: string): VersionContent => {
    // Parse frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    const frontmatter = frontmatterMatch ? frontmatterMatch[1] : '';

    // Extract version info from frontmatter or use selected release
    const versionMatch = frontmatter.match(/version:\s*(.+)/);
    const dateMatch = frontmatter.match(/date:\s*(.+)/);
    const noteMatch = frontmatter.match(/note:\s*(.+)/);

    // Find version metadata
    const versionMeta = versions.find(
      (v) => v.version === activeVersion?.version
    );

    // Parse content sections
    const featuresMatch = content.match(/## Features\n([\s\S]*?)(?=\n## |$)/);
    const changelogMatch = content.match(/## Changelog\n([\s\S]*?)(?=\n## |$)/);

    // Parse individual features from the features section
    let features: string[] = [];
    if (featuresMatch) {
      const featuresContent = featuresMatch[1].trim();
      // Split by ### headers to get individual features
      const featureSections = featuresContent.split(/\n### /);

      // Process each feature section
      features = featureSections
        .map((section, index) => {
          if (index === 0) {
            // First section might not have ### prefix, so we need to handle it
            const lines = section.split('\n');
            if (lines[0].startsWith('###')) {
              // Remove the ### prefix from the first line
              lines[0] = lines[0].replace(/^###\s*/, '');

              return lines.join('\n').trim();
            }

            return section.trim();
          }

          return section.trim();
        })
        .filter((section) => section.length > 0); // Remove empty sections
    }

    const releaseInfo: VersionContent = {
      version: versionMatch ? versionMatch[1].trim() : activeVersion?.version,
      date: dateMatch
        ? dateMatch[1].trim().replace(/"/g, '')
        : versionMeta?.date || '',
      hasFeatures: versionMeta?.hasFeatures || false,
      note: noteMatch
        ? noteMatch[1].trim().replace(/"/g, '')
        : versionMeta?.note,
      markdown: content,
      features: features,
      changelog: changelogMatch ? changelogMatch[1].trim() : '',
    };

    return releaseInfo;
  };

  // Fetch content for a specific version
  const fetchVersionContent = useCallback(
    async (version: string) => {
      try {
        setContentLoading(true);

        const contentUrl = `${CONTENT_BASE_URL}/${version}.md`;
        const response = await axios.get<string>(contentUrl);

        const parsedContent = parseMarkdownContent(response.data);
        setVersionContent(parsedContent);
      } finally {
        setContentLoading(false);
      }
    },
    [activeVersion]
  );

  // Handle version selection
  const handleVersionSelect = (version: ExternalVersionData) => {
    setActiveVersion(version);
    setVersionContent(null); // Clear previous content
  };

  const handleToggleChange = (type: ToggleType) => {
    setCheckedValue(type);
  };

  const handleCancel = () => {
    cookieStorage.setItem('VERSION_1_8_0', 'true', {
      expires: getReleaseVersionExpiry(),
    });
    onCancel();
  };

  // Fetch versions on modal open
  useEffect(() => {
    if (visible && versions.length === 0) {
      fetchVersions();
    }
  }, [visible, fetchVersions, versions.length]);

  // Fetch content when active version changes
  useEffect(() => {
    if (activeVersion) {
      fetchVersionContent(activeVersion.version);
    }
  }, [activeVersion, fetchVersionContent]);

  // Set initial toggle state based on version features
  useEffect(() => {
    if (activeVersion) {
      setCheckedValue(
        activeVersion.hasFeatures ? ToggleType.FEATURES : ToggleType.CHANGE_LOG
      );
    }
  }, [activeVersion]);

  // Convert YouTube components to proper YouTubeEmbed format
  const convertToYouTubeEmbedFormat = (content: string): string => {
    // Check if content contains YouTube components
    const youtubeRegex = /<YouTube\s+videoId=["']([^"']+)["']\s*\/?>/gi;
    const hasYouTubeComponents = youtubeRegex.test(content);

    if (hasYouTubeComponents) {
      // Reset regex for replacement
      const youtubeRegexForReplace =
        /<YouTube\s+videoId=["']([^"']+)["']\s*\/?>/gi;

      // Convert <YouTube videoId="..."/> to iframe format that YouTubeEmbed extension expects
      const processedContent = content.replace(
        youtubeRegexForReplace,
        (_match, videoId) => {
          const embedUrl = `https://www.youtube.com/embed/${videoId}`;

          return `<iframe src="${embedUrl}" width="560" height="315"></iframe>`;
        }
      );

      return processedContent;
    }

    return content;
  };

  const renderContent = () => {
    if (contentLoading) {
      return (
        <div className="flex justify-center items-center h-full">
          <Spin size="large" />
        </div>
      );
    }

    if (!versionContent) {
      return (
        <div className="flex justify-center items-center h-full">
          <Typography.Text type="secondary">
            {t('message.no-content-available')}
          </Typography.Text>
        </div>
      );
    }

    if (
      checkedValue === ToggleType.FEATURES &&
      versionContent.features.length > 0
    ) {
      return (
        <div className="feature-carousal-container h-full">
          <Carousel>
            {versionContent.features.map((feature, index) => (
              <div className="h-full" key={index}>
                <BlockEditor
                  autoFocus={false}
                  content={convertToYouTubeEmbedFormat(feature)}
                  editable={false}
                />
              </div>
            ))}
          </Carousel>
        </div>
      );
    }

    if (checkedValue === ToggleType.CHANGE_LOG) {
      return (
        <div className="changelog-content h-full overflow-y-auto">
          <BlockEditor
            autoFocus={false}
            content={convertToYouTubeEmbedFormat(versionContent.changelog)}
            editable={false}
          />
        </div>
      );
    }

    return null;
  };

  return (
    <Modal
      centered
      destroyOnClose
      className="whats-new-modal"
      closeIcon={
        <CloseIcon dataTestId="closeWhatsNew" handleCancel={handleCancel} />
      }
      data-testid="whats-new-dialog-v2"
      footer={null}
      maskClosable={false}
      open={visible}
      title={
        <Typography.Text strong data-testid="whats-new-header">
          {header}
        </Typography.Text>
      }
      width={1200}>
      {loading ? (
        <Loader fullScreen />
      ) : (
        <Row className="w-auto h-full h-min-75">
          <Col
            className="border-r-2 p-x-md p-y-md border-separate whats-new-version-timeline"
            span={4}
            style={{
              height: '600px',
              display: 'flex',
              flexDirection: 'column',
            }}>
            <div
              className="overflow-y-auto w-full"
              style={{ maxHeight: '600px' }}>
              <Space className="w-full" direction="vertical">
                {versions.map((version) => (
                  <div
                    className="flex items-center gap-1"
                    key={version.version}>
                    <Button
                      className={classNames(
                        'p-0 w-full text-left',
                        activeVersion?.version === version.version
                          ? 'text-primary'
                          : null
                      )}
                      icon={
                        <VersionIndicatorIcon
                          fill={
                            activeVersion?.version === version.version
                              ? theme.primaryColor ?? ''
                              : DE_ACTIVE_COLOR
                          }
                        />
                      }
                      size="small"
                      type="text"
                      onClick={() => handleVersionSelect(version)}>
                      {version.version}
                    </Button>
                    {'v1.7.5' === version.version && (
                      <Button className="text-xs" size="small" type="link">
                        {t('label.current')}
                      </Button>
                    )}
                  </div>
                ))}
              </Space>
            </div>
          </Col>

          <Col
            className="overflow-hidden"
            span={20}
            style={{ height: '600px' }}>
            <div className="h-full flex flex-col">
              <div className="p-t-md px-10 flex-shrink-0">
                <div className="flex justify-between items-center p-b-sm gap-1">
                  <div>
                    <p className="text-base font-medium">
                      {activeVersion?.version}
                    </p>
                    <p className="text-grey-muted text-xs">
                      {activeVersion?.date}
                    </p>
                    {versionContent?.note && (
                      <RichTextEditorPreviewerV1
                        className="m-t-xs"
                        markdown={versionContent.note}
                      />
                    )}
                  </div>
                  <div>
                    {activeVersion?.hasFeatures &&
                      versionContent?.features &&
                      versionContent.features.length > 0 && (
                        <div className="whats-new-modal-button-container">
                          <Button.Group>
                            <Button
                              data-testid="WhatsNewModalV2Features"
                              ghost={checkedValue !== ToggleType.FEATURES}
                              type="primary"
                              onClick={() =>
                                handleToggleChange(ToggleType.FEATURES)
                              }>
                              {t('label.feature-plural')}
                            </Button>

                            <Button
                              data-testid="WhatsNewModalV2ChangeLogs"
                              ghost={checkedValue !== ToggleType.CHANGE_LOG}
                              type="primary"
                              onClick={() =>
                                handleToggleChange(ToggleType.CHANGE_LOG)
                              }>
                              {t('label.change-log-plural')}
                            </Button>
                          </Button.Group>
                        </div>
                      )}
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-hidden px-10 pb-4">
                <div className="h-full overflow-y-auto">{renderContent()}</div>
              </div>
            </div>
          </Col>
        </Row>
      )}
    </Modal>
  );
};

export default WhatsNewModal;
