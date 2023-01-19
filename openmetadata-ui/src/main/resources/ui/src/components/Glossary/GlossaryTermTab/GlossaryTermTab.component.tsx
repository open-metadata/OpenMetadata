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

import { Card, Col, Row, Space, Tag, Tooltip, Typography } from 'antd';
import { AxiosError } from 'axios';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import RichTextEditorPreviewer from 'components/common/rich-text-editor/RichTextEditorPreviewer';
import Searchbar from 'components/common/searchbar/Searchbar';
import Loader from 'components/Loader/Loader';
import { FQN_SEPARATOR_CHAR } from 'constants/char.constants';
import { API_RES_MAX_SIZE } from 'constants/constants';
import { GlossaryTerm } from 'generated/entity/data/glossaryTerm';
import { isEmpty, isUndefined } from 'lodash';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { getGlossaryTerms } from 'rest/glossaryAPI';
import { getGlossaryPath, getTagPath } from 'utils/RouterUtils';
import { showErrorToast } from 'utils/ToastUtils';
import { GlossaryTermTabProps } from './GlossaryTermTab.interface';

const GlossaryTermTab = ({
  glossaryId,
  glossaryTermId,
}: GlossaryTermTabProps) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [glossaryTerms, setGlossaryTerms] = useState<GlossaryTerm[]>([]);
  const [filterData, setFilterData] = useState<GlossaryTerm[]>([]);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    if (value) {
      setFilterData(
        glossaryTerms.filter(
          (term) =>
            term.name.toLowerCase().includes(value) ||
            term?.displayName?.toLowerCase().includes(value)
        )
      );
    } else {
      setFilterData(glossaryTerms);
    }
  };

  const fetchGlossaryTerm = async () => {
    setIsLoading(true);
    try {
      const { data } = await getGlossaryTerms({
        glossary: glossaryId,
        parent: glossaryTermId,
        limit: API_RES_MAX_SIZE,
        fields: 'tags',
      });
      const updatedData = data.filter((glossaryTerm) => {
        if (glossaryId) {
          return isUndefined(glossaryTerm.parent);
        }

        return glossaryTerm?.parent?.id === glossaryTermId;
      });
      setGlossaryTerms(updatedData);
      setFilterData(updatedData);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGlossaryTerm();
  }, []);

  if (isLoading) {
    return <Loader />;
  }

  if (glossaryTerms.length === 0) {
    return (
      <ErrorPlaceHolder>
        {t('message.no-entity-data-available', {
          entity: t('label.glossary-term'),
        })}
      </ErrorPlaceHolder>
    );
  }

  return (
    <Row gutter={[0, 16]}>
      <Col span={6}>
        <Searchbar
          removeMargin
          showLoadingStatus
          placeholder={`${t('label.search-for-type', {
            type: t('label.glossary-term'),
          })}...`}
          searchValue={searchTerm}
          typingInterval={500}
          onSearch={handleSearch}
        />
      </Col>
      {filterData.length > 0 ? (
        filterData.map((term) => (
          <Col key={term.name} span={24}>
            <Card data-testid={`${term.name}-card`}>
              <Space direction="vertical" size={8}>
                <Link to={getGlossaryPath(term.fullyQualifiedName)}>
                  <Typography.Text className="text-base font-medium">
                    {term.name}
                  </Typography.Text>
                </Link>
                <Space
                  className="w-full tw-flex-wrap"
                  data-testid="tag-container"
                  size={4}>
                  <Typography.Text className="text-grey-muted m-r-xs">
                    {t('label.tag-plural')}:
                  </Typography.Text>
                  {term.tags?.length
                    ? term.tags.map((tag) => (
                        <Tooltip
                          className="cursor-pointer"
                          key={tag.tagFQN}
                          placement="bottomLeft"
                          title={
                            <div className="text-left p-xss">
                              <div className="m-b-xs">
                                <RichTextEditorPreviewer
                                  enableSeeMoreVariant={false}
                                  markdown={
                                    !isEmpty(tag.description)
                                      ? `**${tag.tagFQN}**\n${tag.description}`
                                      : t('label.no-entity', {
                                          entity: t('label.description'),
                                        })
                                  }
                                  textVariant="white"
                                />
                              </div>
                            </div>
                          }
                          trigger="hover">
                          <Link
                            to={getTagPath(
                              tag.tagFQN.split(FQN_SEPARATOR_CHAR)[0]
                            )}>
                            <Tag>{tag.tagFQN}</Tag>
                          </Link>
                        </Tooltip>
                      ))
                    : '--'}
                </Space>
                <div data-testid="description-text">
                  <Typography.Text className="text-grey-muted m-b-xs">
                    {t('label.description')}:
                  </Typography.Text>
                  {term.description.trim() ? (
                    <RichTextEditorPreviewer
                      enableSeeMoreVariant={false}
                      markdown={term.description}
                    />
                  ) : (
                    <span className="tw-no-description">
                      {t('label.no-description')}
                    </span>
                  )}
                </div>
              </Space>
            </Card>
          </Col>
        ))
      ) : (
        <ErrorPlaceHolder>
          {t('message.no-entity-found-for-name', {
            entity: t('label.glossary-term'),
            name: searchTerm,
          })}
        </ErrorPlaceHolder>
      )}
    </Row>
  );
};

export default GlossaryTermTab;
