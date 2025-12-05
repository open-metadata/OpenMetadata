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
import { Typography, useTheme } from '@mui/material';
import { Typography as AntTypography } from 'antd';
import { startCase } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ClassificationIcon } from '../../../assets/svg/classification.svg';
import { ReactComponent as GlossaryIcon } from '../../../assets/svg/glossary.svg';
import { TagSource } from '../../../generated/tests/testCase';
import { getEntityName } from '../../../utils/EntityUtils';
import {
  getDataTypeString,
  prepareConstraintIcon,
} from '../../../utils/TableUtils';
import RichTextEditorPreviewerV1 from '../RichTextEditor/RichTextEditorPreviewerV1';
import { FieldCardProps } from './FieldCard.interface';
import './FieldCard.less';

const { Text } = AntTypography;

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
  const theme = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);
  const [shouldShowButton, setShouldShowButton] = useState(false);
  const [showAllTags, setShowAllTags] = useState(false);
  const [showAllTerms, setShowAllTerms] = useState(false);
  const [visibleTagsCount, setVisibleTagsCount] = useState<number | null>(null);
  const [visibleTermsCount, setVisibleTermsCount] = useState<number | null>(
    null
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const tagsContainerRef = useRef<HTMLDivElement>(null);
  const termsContainerRef = useRef<HTMLDivElement>(null);
  const cachedTagsCount = useRef<number | null>(null);
  const cachedTermsCount = useRef<number | null>(null);

  const glossaryTerms = useMemo(
    () => tags.filter((tag) => tag.source === TagSource.Glossary),
    [tags]
  );

  const nonGlossaryTags = useMemo(
    () => tags.filter((tag) => tag.source !== TagSource.Glossary),
    [tags]
  );

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const checkIfTextIsTruncated = useCallback(() => {
    if (containerRef.current) {
      const element = containerRef.current;
      const markdownParser = element.querySelector('.markdown-parser');
      const measureNode = (markdownParser as HTMLElement) || element;
      const isVisible = measureNode.getClientRects().length > 0;
      if (!isVisible) {
        return;
      }
      const isTruncated =
        measureNode.scrollHeight > measureNode.clientHeight + 1;
      setShouldShowButton(isTruncated);
    }
  }, []);

  useEffect(() => {
    if (!description) {
      return;
    }

    setIsExpanded(false);
    setShouldShowButton(false);

    const id = setTimeout(checkIfTextIsTruncated, 100);

    return () => clearTimeout(id);
  }, [description, checkIfTextIsTruncated]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(() => {
      checkIfTextIsTruncated();
    });
    observer.observe(node);

    return () => observer.disconnect();
  }, [checkIfTextIsTruncated]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      return;
    }
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          checkIfTextIsTruncated();
        }
      }
    });
    io.observe(node);

    return () => io.disconnect();
  }, [checkIfTextIsTruncated]);

  const calculateVisibleItems = useCallback(
    (containerRef: React.RefObject<HTMLDivElement>, itemsCount: number) => {
      if (!containerRef.current || itemsCount === 0) {
        return itemsCount;
      }

      const container = containerRef.current;
      const items = Array.from(
        container.querySelectorAll('.tag-item, .glossary-term-item')
      ) as HTMLElement[];

      if (items.length === 0) {
        return itemsCount;
      }

      // Find first line baseline
      const firstItemTop = items[0].offsetTop;
      let visibleCount = 0;

      // Count items on the first line
      for (const item of items) {
        if (item.offsetTop === firstItemTop) {
          visibleCount++;
        } else {
          // Item wrapped to second line
          break;
        }
      }

      // If all items fit on one line, return all
      if (visibleCount === items.length) {
        return items.length;
      }

      // Otherwise, reserve space for "+X more" button by reducing count by 1
      return Math.max(1, visibleCount - 1);
    },
    []
  );

  useEffect(() => {
    if (nonGlossaryTags.length === 0 || showAllTags) {
      setVisibleTagsCount(null);

      return;
    }

    // If we have cached count and just collapsed, use it immediately
    if (cachedTagsCount.current !== null && !showAllTags) {
      setVisibleTagsCount(cachedTagsCount.current);

      return;
    }

    const calculateTags = () => {
      const count = calculateVisibleItems(
        tagsContainerRef,
        nonGlossaryTags.length
      );

      cachedTagsCount.current = count;
      setVisibleTagsCount(count);
    };

    // Calculate after render
    const timeout = setTimeout(calculateTags, 100);

    return () => clearTimeout(timeout);
  }, [nonGlossaryTags, showAllTags, calculateVisibleItems]);

  useEffect(() => {
    if (glossaryTerms.length === 0 || showAllTerms) {
      setVisibleTermsCount(null);

      return;
    }

    // If we have cached count and just collapsed, use it immediately
    if (cachedTermsCount.current !== null && !showAllTerms) {
      setVisibleTermsCount(cachedTermsCount.current);

      return;
    }

    const calculateTerms = () => {
      const count = calculateVisibleItems(
        termsContainerRef,
        glossaryTerms.length
      );

      cachedTermsCount.current = count;
      setVisibleTermsCount(count);
    };

    // Calculate after render
    const timeout = setTimeout(calculateTerms, 100);

    return () => clearTimeout(timeout);
  }, [glossaryTerms, showAllTerms, calculateVisibleItems]);

  const dataTypeDisplay = useMemo(
    () => getDataTypeString(startCase(dataType)),
    [dataType]
  );

  const constraintIcon = useMemo(
    () =>
      columnConstraint
        ? prepareConstraintIcon({
            columnName: fieldName,
            columnConstraint,
            tableConstraints,
            iconClassName: 'm-r-xss',
            iconWidth: '14px',
          })
        : null,
    [columnConstraint, fieldName, tableConstraints]
  );

  const visibleTags = useMemo(
    () =>
      showAllTags || visibleTagsCount === null
        ? nonGlossaryTags
        : nonGlossaryTags.slice(0, visibleTagsCount),
    [showAllTags, visibleTagsCount, nonGlossaryTags]
  );

  const visibleTerms = useMemo(
    () =>
      showAllTerms || visibleTermsCount === null
        ? glossaryTerms
        : glossaryTerms.slice(0, visibleTermsCount),
    [showAllTerms, visibleTermsCount, glossaryTerms]
  );

  const tagsMoreLabel = useMemo(
    () =>
      visibleTagsCount === null
        ? ''
        : `+${nonGlossaryTags.length - visibleTagsCount} ${t(
            'label.more-lowercase'
          )}`,
    [visibleTagsCount, nonGlossaryTags.length, t]
  );

  const termsMoreLabel = useMemo(
    () =>
      visibleTermsCount === null
        ? ''
        : `+${glossaryTerms.length - visibleTermsCount} ${t(
            'label.more-lowercase'
          )}`,
    [visibleTermsCount, glossaryTerms.length, t]
  );

  const handleShowAllTags = useCallback(() => setShowAllTags(true), []);
  const handleHideAllTags = useCallback(() => setShowAllTags(false), []);
  const handleShowAllTerms = useCallback(() => setShowAllTerms(true), []);
  const handleHideAllTerms = useCallback(() => setShowAllTerms(false), []);

  return (
    <div
      className={`field-card ${isHighlighted ? 'field-card-highlighted' : ''}`}
      data-testid={`field-card-${fieldName}`}>
      <div className="field-card-header" data-testid="field-card-header">
        <div className="field-name-container">
          {constraintIcon && (
            <span className="constraint-icon">{constraintIcon}</span>
          )}
          <Typography
            color={theme.palette.grey[900]}
            data-testid={`field-name-${fieldName}`}
            fontSize="13px"
            fontWeight="600"
            marginBottom="4px"
            sx={{
              wordBreak: 'break-word',
            }}>
            {fieldName}
          </Typography>
        </div>
        <Typography
          alignContent="center"
          color={theme.palette.grey[700]}
          data-testid={`data-type-text-${dataType}`}
          fontSize="12px"
          fontWeight="400"
          lineHeight="19px"
          marginBottom="8px">
          {startCase(dataTypeDisplay)}
        </Typography>
      </div>

      <div className="field-card-content" data-testid="field-card-content">
        <Typography
          className="field-description"
          data-testid={`field-description-${fieldName}`}
          variant="body1">
          {description ? (
            <div className="description-display">
              <div
                className={`description-text ${
                  isExpanded ? 'expanded' : 'collapsed'
                }`}
                ref={containerRef}>
                <RichTextEditorPreviewerV1
                  enableSeeMoreVariant={false}
                  isDescriptionExpanded={isExpanded}
                  markdown={description}
                />
              </div>
              {(shouldShowButton || isExpanded) && (
                <button
                  className="show-more-button"
                  type="button"
                  onClick={toggleExpanded}>
                  {isExpanded ? t('label.show-less') : t('label.show-more')}
                </button>
              )}
            </div>
          ) : (
            <Text className="no-description-text">
              {t('label.no-entity', { entity: t('label.description') })}
            </Text>
          )}
        </Typography>

        <div className="field-metadata">
          {nonGlossaryTags.length > 0 && (
            <div
              className={`metadata-section ${showAllTags ? 'expanded' : ''}`}>
              <Text className="metadata-label">
                {t('label.-with-colon', { text: t('label.tag-plural') })}
              </Text>
              <div className="tags-display">
                <div className="tags-list" ref={tagsContainerRef}>
                  {visibleTags.map((tag) => (
                    <div
                      className="tag-item"
                      data-testid={`tag-${tag.tagFQN}`}
                      key={tag.tagFQN}>
                      <ClassificationIcon className="tag-icon" />
                      <span className="tag-name">{getEntityName(tag)}</span>
                    </div>
                  ))}
                  {visibleTagsCount !== null &&
                    nonGlossaryTags.length > visibleTagsCount &&
                    !showAllTags && (
                      <button
                        className="show-more-tags-button"
                        type="button"
                        onClick={handleShowAllTags}>
                        {tagsMoreLabel}
                      </button>
                    )}
                  {showAllTags && nonGlossaryTags.length > 1 && (
                    <button
                      className="show-more-tags-button"
                      type="button"
                      onClick={handleHideAllTags}>
                      {t('label.less')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
          {glossaryTerms.length > 0 && (
            <div
              className={`metadata-section ${showAllTerms ? 'expanded' : ''}`}>
              <Text className="metadata-label">
                {t('label.-with-colon', {
                  text: t('label.glossary-term-plural'),
                })}
              </Text>
              <div className="glossary-terms-display">
                <div className="glossary-terms-list" ref={termsContainerRef}>
                  {visibleTerms.map((glossaryTerm) => (
                    <div
                      className="glossary-term-item"
                      data-testid={`term-${glossaryTerm.tagFQN}`}
                      key={glossaryTerm.tagFQN}>
                      <GlossaryIcon className="glossary-term-icon" />
                      <span className="glossary-term-name">
                        {getEntityName(glossaryTerm)}
                      </span>
                    </div>
                  ))}
                  {visibleTermsCount !== null &&
                    glossaryTerms.length > visibleTermsCount &&
                    !showAllTerms && (
                      <button
                        className="show-more-terms-button"
                        type="button"
                        onClick={handleShowAllTerms}>
                        {termsMoreLabel}
                      </button>
                    )}
                  {showAllTerms && glossaryTerms.length > 1 && (
                    <button
                      className="show-more-terms-button"
                      type="button"
                      onClick={handleHideAllTerms}>
                      {t('label.less')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FieldCard;
