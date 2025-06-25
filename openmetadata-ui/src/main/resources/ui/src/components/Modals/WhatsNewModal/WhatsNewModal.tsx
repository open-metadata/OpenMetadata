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
  Alert,
  Button,
  Carousel,
  Col,
  Modal,
  Row,
  Space,
  Spin,
  Typography,
} from 'antd';
import axios, { AxiosError } from 'axios';
import classNames from 'classnames';
import { CookieStorage } from 'cookie-storage';
import { t } from 'i18next';
import React, {
  FunctionComponent,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { DE_ACTIVE_COLOR } from '../../../constants/constants';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { getReleaseVersionExpiry } from '../../../utils/WhatsNewModal.util';
import BlockEditor from '../../BlockEditor/BlockEditor';
import Loader from '../../common/Loader/Loader';
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
  const { theme } = useApplicationStore();

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
  const [error, setError] = useState<string | null>(null);

  // Fetch versions list from external API
  const fetchVersions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get<ExternalVersionData[]>(VERSIONS_API);
      const versions = response.data;
      setVersions(versions);

      // Set the latest version (first in array) as active by default
      if (versions.length > 0) {
        setActiveVersion(versions[0]);
      }
    } catch (err) {
      const errorMessage =
        err instanceof AxiosError
          ? `Failed to fetch versions: ${err.message}`
          : 'Failed to fetch versions';
      setError(errorMessage);
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

    // Set default toggle based on available content
    // if (
    //   releaseInfo.hasFeatures &&
    //   releaseInfo.features &&
    //   releaseInfo.features.length > 0
    // ) {
    //   setCheckedValue(ToggleType.FEATURES);
    // } else {
    //   setCheckedValue(ToggleType.CHANGE_LOG);
    // }

    // // Split content by headers to find different sections
    // const sections = markdown.split(/^#+\s/m);

    // let features: string[] = [];
    // const changelog = markdown; // Default to full content

    // // Look for Features section
    // const featuresSection = sections.find(
    //   (section) =>
    //     section.toLowerCase().includes('feature') ||
    //     section.toLowerCase().includes('new')
    // );

    // if (featuresSection) {
    //   // Extract feature items (assuming they're in list format)
    //   const featureMatches = featuresSection.match(/^\s*[-*+]\s(.+)$/gm);
    //   if (featureMatches) {
    //     features = featureMatches.map((match) =>
    //       match.replace(/^\s*[-*+]\s/, '').trim()
    //     );
    //   }
    // }

    // // If no specific features found but hasFeatures is true, create a single feature from title
    // if (features.length === 0 && activeVersion?.hasFeatures) {
    //   const titleMatch = markdown.match(/^#\s+(.+)$/m);
    //   if (titleMatch) {
    //     features = [titleMatch[1]];
    //   }
    // }

    // return {
    //   markdown,
    //   features,
    //   changelog,
    // };
  };

  // Fetch content for a specific version
  const fetchVersionContent = useCallback(
    async (version: string) => {
      try {
        setContentLoading(true);
        setError(null);
        const contentUrl = `${CONTENT_BASE_URL}/${version}.md`;
        const response = await axios.get<string>(contentUrl);

        const parsedContent = parseMarkdownContent(response.data);
        setVersionContent(parsedContent);
      } catch (err) {
        const errorMessage =
          err instanceof AxiosError
            ? `Failed to fetch content for ${version}: ${err.message}`
            : `Failed to fetch content for ${version}`;
        setError(errorMessage);
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
          <Carousel autoplay>
            {versionContent.features.map((feature, index) => (
              <div className="h-full" key={index}>
                <div
                  className="h-full overflow-y-auto p-4 border rounded-lg bg-gray-50"
                  style={{ minHeight: '400px', maxHeight: '500px' }}>
                  <BlockEditor
                    autoFocus={false}
                    content={convertToYouTubeEmbedFormat(feature)}
                    editable={false}
                  />
                </div>
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
      {error && (
        <Alert
          closable
          className="mb-4"
          description={error}
          message="Error"
          type="error"
          onClose={() => setError(null)}
        />
      )}

      <Row className="w-auto h-full h-min-75">
        <Col
          className="border-r-2 p-x-md p-y-md border-separate whats-new-version-timeline"
          span={3}
          style={{ height: '600px', display: 'flex', flexDirection: 'column' }}>
          {loading ? (
            <Loader fullScreen />
          ) : (
            <div
              className="overflow-y-auto flex-1"
              style={{ maxHeight: '600px', paddingRight: '8px' }}>
              <Space className="w-full" direction="vertical">
                {versions.map((version) => (
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
                    key={version.version}
                    size="small"
                    type="text"
                    onClick={() => handleVersionSelect(version)}>
                    {version.version}
                  </Button>
                ))}
              </Space>
            </div>
          )}
        </Col>

        <Col className="overflow-hidden" span={21} style={{ height: '600px' }}>
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
    </Modal>
  );
};

export default WhatsNewModal;
