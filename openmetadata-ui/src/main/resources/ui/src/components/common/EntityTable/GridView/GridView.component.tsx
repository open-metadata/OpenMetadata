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
import { Avatar, Col, List, Row, Tooltip, Typography } from 'antd';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as LayersIcon } from '../../../../assets/svg/ic-layers-white-lg.svg';
import { ReactComponent as TagIcon } from '../../../../assets/svg/ic-tag-gray.svg';
import { ReactComponent as AggregateIcon } from '../../../../assets/svg/tags/ic-aggregate.svg';
import { ReactComponent as ConsumerAlignedIcon } from '../../../../assets/svg/tags/ic-consumer-aligned.svg';
import { ReactComponent as SourceAlignedIcon } from '../../../../assets/svg/tags/ic-source-aligned.svg';
import { DomainType } from '../../../../generated/entity/domains/domain';
import { EntityReference } from '../../../../generated/entity/type';
import { TagLabel } from '../../../../generated/type/tagLabel';
import { getDomainsPath } from '../../../../utils/RouterUtils';
import RichTextEditorPreviewerV1 from '../../RichTextEditor/RichTextEditorPreviewerV1';
import { EntityData } from '../EntityTable.interface';
import { GridViewProps } from './GridView.interface';

import './grid-view.less';

const { Text } = Typography;

const GridView = <T extends EntityData>({
  header,
  data,
  loading,
}: GridViewProps<T>) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const generateEntityIcon = useCallback((record: EntityData) => {
    const style = record.style;

    if (style?.iconURL) {
      return (
        <Avatar className="entity-card-icon" size={54} src={style.iconURL} />
      );
    }

    return (
      <div
        className="entity-card-icon-container"
        style={{
          backgroundColor: style?.color || '#1470EF',
        }}>
        <LayersIcon className="entity-card-icon-layers" />
      </div>
    );
  }, []);

  const getDomainTypeForDisplay = useCallback((record: EntityData): string => {
    if ('domainType' in record) {
      return record.domainType || DomainType.Aggregate;
    }

    return 'Data Product';
  }, []);

  const getDomainTypeClass = useCallback((domainType: string) => {
    switch (domainType) {
      case 'Aggregate':
        return 'aggregate-domain-type';
      case 'Consumer-aligned':
        return 'consumer-aligned-domain-type';
      case 'Source-aligned':
        return 'source-aligned-domain-type';
      case 'Data Product':
        return 'badge-secondary';
      default:
        return 'badge-secondary';
    }
  }, []);

  const getDomainTypeIcon = useCallback((domainType: string) => {
    switch (domainType) {
      case 'Aggregate':
        return <AggregateIcon />;
      case 'Consumer-aligned':
        return <ConsumerAlignedIcon />;
      case 'Source-aligned':
        return <SourceAlignedIcon />;
      default:
        return null;
    }
  }, []);

  const handleCardClick = useCallback(
    (record: EntityData) => {
      navigate(getDomainsPath(record.fullyQualifiedName));
    },
    [navigate]
  );

  const getOwnerInitials = useCallback((owner: EntityReference) => {
    const displayName = owner.displayName || owner.name || '';

    return displayName
      .split(' ')
      .map((word) => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }, []);

  const renderMultipleOwners = useCallback(
    (owners: EntityReference[]) => {
      if (owners.length === 0) {
        return <Text className="text-grey-muted">-</Text>;
      }

      // Single owner case - show avatar + name
      if (owners.length === 1) {
        const owner = owners[0];

        return (
          <div className="entity-card-single-owner">
            <Avatar
              className="entity-card-owner-avatar"
              size={32}
              src={(owner as any).profile?.images?.image512}>
              {!(owner as any).profile?.images?.image512 &&
                getOwnerInitials(owner)}
            </Avatar>
            <Text className="entity-card-owner-name">
              {owner.displayName || owner.name}
            </Text>
          </div>
        );
      }

      // Multiple owners case - show overlapping avatars with tooltips
      const maxVisible = 4;
      const totalOwners = owners.length;
      const visibleOwners = owners.slice(0, maxVisible);
      const remainingCount = totalOwners - maxVisible;
      const remainingOwners = owners.slice(maxVisible);
      const remainingOwnersNames = remainingOwners
        .map((owner) => owner.displayName || owner.name)
        .join(', ');
      const countText = `+${remainingCount}`;

      return (
        <div className="entity-card-owners">
          {visibleOwners.map((owner, index) => (
            <Tooltip
              key={`owner-${index}-${owner.id}`}
              placement="top"
              title={owner.displayName || owner.name}>
              <Avatar
                className="entity-card-owner-avatar"
                size={32}
                src={(owner as any).profile?.images?.image512}
                style={{ zIndex: index + 1 }}>
                {!(owner as any).profile?.images?.image512 &&
                  getOwnerInitials(owner)}
              </Avatar>
            </Tooltip>
          ))}
          {remainingCount > 0 && (
            <Tooltip placement="top" title={remainingOwnersNames}>
              <Avatar
                className="entity-card-owner-avatar entity-card-owners-count"
                size={32}
                style={{ zIndex: maxVisible + 1 }}>
                {countText}
              </Avatar>
            </Tooltip>
          )}
        </div>
      );
    },
    [getOwnerInitials]
  );

  const renderGlossaryTermsWithCount = useCallback(
    (glossaryTerms: TagLabel[]) => {
      if (glossaryTerms.length === 0) {
        return (
          <div className="entity-card-required">
            <Text className="required-text">-</Text>
          </div>
        );
      }

      const maxVisible = 1;
      const visibleTerms = glossaryTerms.slice(0, maxVisible);
      const remainingCount = glossaryTerms.length - maxVisible;

      return (
        <div className="entity-card-badges">
          {visibleTerms.map((term) => (
            <span className="entity-badge badge-secondary" key={term.tagFQN}>
              {term.name || term.tagFQN}
            </span>
          ))}
          {remainingCount > 0 && (
            <div className="entity-card-count-badge">
              <Text className="count-text">+{remainingCount}</Text>
            </div>
          )}
        </div>
      );
    },
    [t]
  );

  const renderTagsWithCount = useCallback(
    (nonGlossaryTags: TagLabel[]) => {
      if (nonGlossaryTags.length === 0) {
        return (
          <div className="entity-card-required">
            <Text className="required-text">-</Text>
          </div>
        );
      }

      const maxVisible = 1;
      const visibleTags = nonGlossaryTags.slice(0, maxVisible);
      const remainingCount = nonGlossaryTags.length - maxVisible;

      return (
        <div className="entity-card-badges">
          {visibleTags.map((tag) => (
            <span className="entity-badge tags-badge" key={tag.tagFQN}>
              <TagIcon className="tag-icon" />
              <span className="tag-text">{tag.name || tag.tagFQN}</span>
            </span>
          ))}
          {remainingCount > 0 && (
            <div className="entity-card-count-badge">
              <Text className="count-text">+{remainingCount}</Text>
            </div>
          )}
        </div>
      );
    },
    [t]
  );

  const renderCard = useCallback(
    (record: EntityData) => {
      const domainType = getDomainTypeForDisplay(record);
      const domainTypeIcon = getDomainTypeIcon(domainType);
      const domainTypeClass = getDomainTypeClass(domainType);

      const owners = (record.owners as EntityReference[]) || [];
      const tags = (record.tags as TagLabel[]) || [];
      const glossaryTerms = tags.filter((tag) => tag.source === 'Glossary');
      const nonGlossaryTags = tags.filter((tag) => tag.source !== 'Glossary');

      return (
        <div
          className="entity-card"
          key={record.id}
          onClick={() => handleCardClick(record)}>
          {/* Header with Icon and Title */}
          <div className="entity-card-header">
            <div className="entity-card-icon-wrapper">
              {generateEntityIcon(record)}
            </div>
            <div className="entity-card-content">
              <Text className="entity-card-title" ellipsis={{ tooltip: true }}>
                {record.displayName || record.name}
              </Text>
              <Text
                className="entity-card-description"
                ellipsis={{ tooltip: true }}>
                <RichTextEditorPreviewerV1
                  showTooltipOnTruncate
                  markdown={record.description || '-'}
                  maxLength={50}
                  showReadMoreBtn={false}
                />
              </Text>
            </div>
          </div>

          {/* Card Body */}
          <div className="entity-card-body">
            {/* Row 1: Owner and Domain Type */}
            <Row className="entity-card-row">
              <Col className="entity-card-column" span={12}>
                <div className="entity-card-field">
                  <Text className="entity-card-label owner-label">
                    {t('label.owner')}
                  </Text>
                  <div className="entity-card-value">
                    {renderMultipleOwners([...owners, ...owners, ...owners])}
                  </div>
                </div>
              </Col>
              <Col className="entity-card-column" span={12}>
                <div className="entity-card-field">
                  <Text className="entity-card-label">
                    {t('label.domain-type')}
                  </Text>
                  <div className="entity-card-value">
                    <div className={`entity-badge ${domainTypeClass}`}>
                      <div className="d-flex badge-icon">
                        {domainTypeIcon}
                        {domainType}
                      </div>
                    </div>
                  </div>
                </div>
              </Col>
            </Row>

            {/* Row 2: Glossary Terms and Tags */}
            <Row className="entity-card-row">
              <Col className="entity-card-column" span={12}>
                <div className="entity-card-field">
                  <Text className="entity-card-label">
                    {t('label.glossary-term-plural')}
                  </Text>
                  <div className="entity-card-value">
                    {renderGlossaryTermsWithCount(glossaryTerms)}
                  </div>
                </div>
              </Col>
              <Col className="entity-card-column" span={12}>
                <div className="entity-card-field">
                  <Text className="entity-card-label">
                    {t('label.tag-plural')}
                  </Text>
                  <div className="entity-card-value">
                    {renderTagsWithCount(nonGlossaryTags)}
                  </div>
                </div>
              </Col>
            </Row>
          </div>
        </div>
      );
    },
    [
      getDomainTypeForDisplay,
      getDomainTypeIcon,
      getDomainTypeClass,
      generateEntityIcon,
      handleCardClick,
      renderMultipleOwners,
      renderGlossaryTermsWithCount,
      renderTagsWithCount,
      t,
    ]
  );

  return (
    <List
      className="entity-grid-container"
      dataSource={data}
      grid={{
        lg: 3,
        xl: 3,
        xxl: 3,
      }}
      header={header}
      loading={loading}
      renderItem={renderCard}
    />
  );
};

export default GridView;
