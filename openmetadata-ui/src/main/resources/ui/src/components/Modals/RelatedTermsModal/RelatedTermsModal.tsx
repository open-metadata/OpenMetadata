/*
 *  Copyright 2022 Collate.
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

import { Button, Col, Modal, Row, Typography } from 'antd';
import { t } from 'i18next';
import { isUndefined, uniqueId } from 'lodash';
import CheckboxUserCard from 'pages/teams/CheckboxUserCard';
import React, { useEffect, useState } from 'react';
import { searchData } from 'rest/miscAPI';
import { PAGE_SIZE } from '../../../constants/constants';
import { SearchIndex } from '../../../enums/search.enum';
import { GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';
import { formatSearchGlossaryTermResponse } from '../../../utils/APIUtils';
import Searchbar from '../../common/searchbar/Searchbar';
import Loader from '../../Loader/Loader';
import { RelatedTermsModalProp } from './RelatedTermsModal.interface';

const RelatedTermsModal = ({
  glossaryTermFQN = '',
  relatedTerms,
  onCancel,
  onSave,
  header,
  visible,
}: RelatedTermsModalProp) => {
  const [searchText, setSearchText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [options, setOptions] = useState<GlossaryTerm[]>([]);
  const [selectedOption, setSelectedOption] = useState<GlossaryTerm[]>(
    relatedTerms ?? []
  );

  const getSearchedTerms = (searchedData: GlossaryTerm[]) => {
    const currOptions = selectedOption.map(
      (item) => item.fullyQualifiedName || item.name
    );
    const data = searchedData.filter((item) => {
      return !currOptions.includes(item.fullyQualifiedName || item.name);
    });

    return [...selectedOption, ...data];
  };

  const suggestionSearch = (searchText = '') => {
    setIsLoading(true);
    searchData(searchText, 1, PAGE_SIZE, '', '', '', SearchIndex.GLOSSARY)
      .then((res) => {
        const termResult = formatSearchGlossaryTermResponse(
          res.data.hits.hits
        ).filter((item) => {
          const isTermExist = relatedTerms?.some(
            (term) => term.fullyQualifiedName === item.fullyQualifiedName
          );

          return !isTermExist && item.fullyQualifiedName !== glossaryTermFQN;
        });
        const data = !searchText ? getSearchedTerms(termResult) : termResult;
        setOptions(data);
      })
      .catch(() => {
        setOptions(selectedOption);
      })
      .finally(() => setIsLoading(false));
  };

  const handleSearchAction = (text: string) => {
    setSearchText(text);
    suggestionSearch(text);
  };

  const isIncludeInOptions = (id: string): boolean => {
    return selectedOption.some((d) => d.id === id);
  };

  const selectionHandler = (id: string, isChecked: boolean) => {
    if (!isChecked) {
      setSelectedOption((pre) => pre.filter((option) => option.id !== id));
    } else {
      const newOption: GlossaryTerm =
        options.find((d) => d.id === id) || ({} as GlossaryTerm);
      setSelectedOption([...selectedOption, newOption]);
    }
  };

  useEffect(() => {
    if (!isUndefined(relatedTerms) && relatedTerms.length) {
      setOptions(relatedTerms);
    }
    suggestionSearch();
  }, []);

  return (
    <Modal
      centered
      destroyOnClose
      closable={false}
      data-testid="confirmation-modal"
      footer={
        <div data-testid="cta-container">
          <Button
            data-testid="cancelButton"
            key="remove-edge-btn"
            type="text"
            onClick={onCancel}>
            {t('label.cancel')}
          </Button>
          <Button
            data-testid="saveButton"
            key="save-btn"
            type="primary"
            onClick={() => onSave(selectedOption)}>
            {t('label.save')}
          </Button>
        </div>
      }
      open={visible}
      title={
        <Typography.Text strong data-testid="header">
          {header}
        </Typography.Text>
      }
      width={800}>
      <div className="h-full">
        <Searchbar
          placeholder={`${t('label.search-for-type', {
            type: t('label.user-lowercase'),
          })}...`}
          searchValue={searchText}
          typingInterval={500}
          onSearch={handleSearchAction}
        />

        {isLoading ? (
          <Loader />
        ) : options.length > 0 ? (
          <Row gutter={[16, 16]}>
            {options.map((d) => (
              <Col key={uniqueId()} span={8}>
                <CheckboxUserCard
                  isActionVisible
                  isCheckBoxes
                  item={{
                    name: '',
                    displayName: d.displayName || d.name,
                    id: d.id,
                    type: 'tag',
                    isChecked: isIncludeInOptions(d.id),
                  }}
                  key={d.id}
                  onSelect={selectionHandler}
                />
              </Col>
            ))}
          </Row>
        ) : (
          <Typography.Text className="flex justify-center mt-10 text-grey-muted text-base">
            {searchText
              ? t('message.no-terms-found-for-search-text', {
                  searchText,
                })
              : t('message.no-terms-found')}
          </Typography.Text>
        )}
      </div>
    </Modal>
  );
};

export default RelatedTermsModal;
