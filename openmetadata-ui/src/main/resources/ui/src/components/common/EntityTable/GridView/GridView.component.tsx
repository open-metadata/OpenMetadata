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
import { ReactComponent as LayersIcon } from '../../../../assets/svg/ic-layers-white-lg.svg';
import { ReactComponent as TagIcon } from '../../../../assets/svg/ic-tag-gray.svg';
import { DomainType } from '../../../../generated/entity/domains/domain';
import { EntityReference } from '../../../../generated/entity/type';
import { TagLabel } from '../../../../generated/type/tagLabel';
import DomainTypeTag from '../../../Domains/DomainTypeTag/DomainTypeTag.component';
import RichTextEditorPreviewerV1 from '../../RichTextEditor/RichTextEditorPreviewerV1';
import { EntityData } from '../EntityTable.interface';
import { GridViewProps } from './GridView.interface';

import './grid-view.less';

const { Text } = Typography;

const GridView = <T extends EntityData>({
  header,
  data,
  loading,
  type,
  onCardClick,
}: GridViewProps<T>) => {
  const { t } = useTranslation();

  const generateEntityIcon = useCallback((record: T) => {
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

  const getDomainTypeForDisplay = useCallback(
    (record: EntityData): string => {
      if (type === 'data-products') {
        return 'Data Product';
      }

      if ('domainType' in record) {
        return record.domainType || DomainType.Aggregate;
      }

      return DomainType.Aggregate;
    },
    [type]
  );

  const handleCardClick = useCallback(
    (record: T) => {
      if (onCardClick) {
        onCardClick(record);
      }
    },
    [onCardClick]
  );

  const getOwnerInitials = useCallback((owner: EntityReference) => {
    const name = owner.displayName || owner.name || '';

    return name
      .split(' ')
      .map((word) => word.charAt(0))
      .join('')
      .substring(0, 2)
      .toUpperCase();
  }, []);

  const renderMultipleOwners = useCallback(
    (owners: EntityReference[], maxVisible = 2) => {
      const visibleOwners = owners.slice(0, maxVisible);
      const remainingCount = owners.length - maxVisible;

      return (
        <div className="entity-card-owners">
          {visibleOwners.map((owner, index) => (
            <Tooltip
              key={owner.id || index}
              title={owner.displayName || owner.name}>
              <Avatar className="entity-card-owner-avatar" size={24}>
                {getOwnerInitials(owner)}
              </Avatar>
            </Tooltip>
          ))}
          {remainingCount > 0 && (
            <Tooltip
              title={owners
                .slice(maxVisible)
                .map((owner) => owner.displayName || owner.name)
                .join(', ')}>
              <Avatar
                className="entity-card-owner-avatar entity-card-owners-count"
                size={24}>
                {`+${remainingCount}`}
              </Avatar>
            </Tooltip>
          )}
        </div>
      );
    },
    [getOwnerInitials]
  );

  const renderSingleOwner = useCallback(
    (owner: EntityReference) => {
      return (
        <div className="entity-card-single-owner">
          <Tooltip title={owner.displayName || owner.name}>
            <Avatar className="entity-card-owner-avatar" size={24}>
              {getOwnerInitials(owner)}
            </Avatar>
          </Tooltip>
          <Text
            className="entity-card-owner-name owner-name"
            ellipsis={{ tooltip: true }}>
            {owner.displayName || owner.name}
          </Text>
        </div>
      );
    },
    [getOwnerInitials]
  );

  const renderGlossaryTermsWithCount = useCallback(
    (glossaryTerms: TagLabel[]) => {
      if (glossaryTerms.length === 0) {
        return <Text className="entity-card-no-data">-</Text>;
      }

      if (glossaryTerms.length === 1) {
        return (
          <Text
            className="entity-card-glossary-term"
            ellipsis={{
              tooltip: true,
            }}>
            {glossaryTerms[0].name || glossaryTerms[0].tagFQN}
          </Text>
        );
      }

      return (
        <Tooltip
          title={glossaryTerms
            .map((term) => term.name || term.tagFQN)
            .join(', ')}>
          <Text className="entity-card-glossary-count">
            {glossaryTerms.length} {t('label.term-plural')}
          </Text>
        </Tooltip>
      );
    },
    [t]
  );

  const renderTagsWithCount = useCallback(
    (tags: TagLabel[]) => {
      if (tags.length === 0) {
        return <Text className="entity-card-no-data">-</Text>;
      }

      if (tags.length === 1) {
        return (
          <div className="entity-card-single-tag">
            <TagIcon className="tag-icon" />
            <Text className="tag-text" ellipsis={{ tooltip: true }}>
              {tags[0].name || tags[0].tagFQN}
            </Text>
          </div>
        );
      }

      return (
        <Tooltip title={tags.map((tag) => tag.name || tag.tagFQN).join(', ')}>
          <div className="entity-card-tag-count">
            <TagIcon className="tag-icon" />
            <Text className="tag-count">
              {tags.length} {t('label.tag-plural')}
            </Text>
          </div>
        </Tooltip>
      );
    },
    [t]
  );

  const renderCard = useCallback(
    (record: T) => {
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
            <Row className="entity-card-row">
              <Col className="entity-card-column" span={12}>
                <div className="entity-card-field">
                  <Text className="entity-card-label">{t('label.owner')}</Text>
                  <div className="entity-card-value">
                    {owners.length === 0 ? (
                      <Text className="entity-card-no-data">-</Text>
                    ) : owners.length === 1 ? (
                      renderSingleOwner(owners[0])
                    ) : (
                      renderMultipleOwners(owners)
                    )}
                  </div>
                </div>
              </Col>
              <Col className="entity-card-column" span={12}>
                <div className="entity-card-field">
                  <Text className="entity-card-label">
                    {t('label.domain-type')}
                  </Text>
                  <div className="entity-card-value">
                    <DomainTypeTag
                      domainType={getDomainTypeForDisplay(record)}
                      size="small"
                    />
                  </div>
                </div>
              </Col>
            </Row>

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
      generateEntityIcon,
      handleCardClick,
      renderMultipleOwners,
      renderSingleOwner,
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
