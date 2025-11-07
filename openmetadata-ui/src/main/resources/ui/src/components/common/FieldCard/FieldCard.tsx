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
import { Badge, Typography } from 'antd';
import { startCase } from 'lodash';
import { useTranslation } from 'react-i18next';
import { MAX_CHAR_LIMIT_ENTITY_SUMMARY } from '../../../constants/constants';
import { TagSource } from '../../../generated/tests/testCase';
import {
  getDataTypeString,
  prepareConstraintIcon,
} from '../../../utils/TableUtils';
import RichTextEditorPreviewerV1 from '../RichTextEditor/RichTextEditorPreviewerV1';
import { FieldCardProps } from './FieldCard.interface';
import './FieldCard.less';

const { Text, Paragraph } = Typography;

const FieldCard: React.FC<FieldCardProps> = ({
  fieldName,
  dataType,
  description,
  tags = [],
  columnConstraint,
  tableConstraints,
  isHighlighted = false,
}) => {
  const { t } = useTranslation();

  const glossaryTerms = tags.filter((tag) => tag.source === TagSource.Glossary);

  return (
    <div
      className={`field-card ${isHighlighted ? 'field-card-highlighted' : ''}`}
      data-testid={`field-card-${fieldName}`}>
      <div className="field-card-header" data-testid="field-card-header">
        <Badge
          className="data-type-badge"
          data-testid={`data-type-badge-${dataType}`}>
          {getDataTypeString(startCase(dataType))}
        </Badge>
        <div className="field-name-container">
          {columnConstraint && (
            <span className="constraint-icon">
              {prepareConstraintIcon({
                columnName: fieldName,
                columnConstraint,
                tableConstraints,
                iconClassName: 'm-r-xss',
                iconWidth: '14px',
              })}
            </span>
          )}
          <Typography.Text
            strong
            className="field-name"
            data-testid={`field-name-${fieldName}`}>
            {fieldName}
          </Typography.Text>
        </div>
      </div>

      <div className="field-card-content" data-testid="field-card-content">
        <Paragraph
          className="field-description"
          data-testid={`field-description-${fieldName}`}>
          {description ? (
            <RichTextEditorPreviewerV1
              markdown={description}
              maxLength={MAX_CHAR_LIMIT_ENTITY_SUMMARY}
            />
          ) : (
            <Text className="no-description-text">
              {t('label.no-entity', { entity: t('label.description') })}
            </Text>
          )}
        </Paragraph>

        <div className="field-metadata">
          {tags.length > 0 && (
            <div className="metadata-item">
              <Text className="metadata-label">
                {t('label.-with-colon', { text: t('label.tag-plural') })}
              </Text>
              <Text className="metadata-value">{tags.length}</Text>
            </div>
          )}
          {glossaryTerms.length > 0 && (
            <div className="metadata-item">
              <Text className="metadata-label">
                {t('label.-with-colon', {
                  text: t('label.glossary-term-plural'),
                })}
              </Text>
              <Text className="metadata-value">{glossaryTerms.length}</Text>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FieldCard;
