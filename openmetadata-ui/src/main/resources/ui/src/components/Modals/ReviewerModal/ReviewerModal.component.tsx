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

import { Button, Col, Row, Typography } from 'antd';
import Modal from 'antd/lib/modal/Modal';
import { isUndefined, uniqueId } from 'lodash';
import CheckboxUserCard from 'pages/teams/CheckboxUserCard';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getSuggestedUsers, searchData } from 'rest/miscAPI';
import { WILD_CARD_CHAR } from '../../../constants/char.constants';
import { SearchIndex } from '../../../enums/search.enum';
import { User } from '../../../generated/entity/teams/user';
import { SearchResponse } from '../../../interface/search.interface';
import { formatUsersResponse } from '../../../utils/APIUtils';
import Searchbar from '../../common/searchbar/Searchbar';
import Loader from '../../Loader/Loader';
import {
  getEntityReferenceFromUser,
  getUserFromEntityReference,
} from '../../Users/Users.util';
import { ReviewerModalProp } from './ReviewerModal.interface';

const ReviewerModal = ({
  reviewer,
  onCancel,
  onSave,
  header,
  visible,
}: ReviewerModalProp) => {
  const [searchText, setSearchText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [options, setOptions] = useState<User[]>([]);
  const [selectedOption, setSelectedOption] = useState<User[]>([]);
  const { t } = useTranslation();

  const getSearchedReviewers = (searchedData: User[]) => {
    const currOptions = selectedOption.map((item) => item.name);
    const data = searchedData.filter((item) => {
      return !currOptions.includes(item.name);
    });

    return [...selectedOption, ...data];
  };

  const querySearch = () => {
    setIsLoading(true);
    searchData(WILD_CARD_CHAR, 1, 10, '', '', '', SearchIndex.USER)
      .then((res) => {
        const data = getSearchedReviewers(
          formatUsersResponse(
            (res.data as SearchResponse<SearchIndex.USER>).hits.hits
          )
        );
        setOptions(data);
      })
      .catch(() => {
        setOptions([]);
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  const suggestionSearch = (searchText = '') => {
    setIsLoading(true);
    getSuggestedUsers(searchText)
      .then((res) => {
        const data = formatUsersResponse(
          res.data.suggest['metadata-suggest'][0].options
        );
        setOptions(data);
      })
      .catch(() => {
        setOptions(selectedOption);
      })
      .finally(() => setIsLoading(false));
  };

  const handleSearchAction = (text: string) => {
    setSearchText(text);
    if (text) {
      suggestionSearch(text);
    } else {
      querySearch();
    }
  };

  const isIncludeInOptions = (id: string): boolean => {
    return selectedOption.some((d) => d.id === id);
  };

  const selectionHandler = (id: string, isChecked: boolean) => {
    if (!isChecked) {
      setSelectedOption((pre) => pre.filter((option) => option.id !== id));
    } else {
      const newOption = options.find((d) => d.id === id);
      newOption && setSelectedOption([...selectedOption, newOption]);
    }
  };

  useEffect(() => {
    if (!isUndefined(reviewer) && reviewer.length) {
      setOptions(reviewer.map(getUserFromEntityReference));
    }
    querySearch();
  }, []);

  useEffect(() => {
    if (reviewer) {
      setSelectedOption(reviewer.map(getUserFromEntityReference));
    }
  }, [reviewer]);

  return (
    <Modal
      centered
      destroyOnClose
      closable={false}
      data-testid="confirmation-modal"
      footer={
        <div data-testid="cta-container">
          <Button
            data-testid="cancel"
            key="remove-edge-btn"
            type="text"
            onClick={onCancel}>
            {t('label.cancel')}
          </Button>
          <Button
            data-testid="save-button"
            key="save-btn"
            type="primary"
            onClick={() =>
              onSave(selectedOption.map(getEntityReferenceFromUser))
            }>
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
      <>
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
                  isIconVisible
                  item={{
                    name: d.name,
                    displayName: d.displayName || d.name,
                    email: d.email,
                    id: d.id,
                    isChecked: isIncludeInOptions(d.id),
                    type: 'user',
                  }}
                  key={d.id}
                  onSelect={selectionHandler}
                />
              </Col>
            ))}
          </Row>
        ) : (
          <Typography.Text className="flex justify-center mt-10 text-grey-muted text-base">
            {t('message.no-user-available')}
          </Typography.Text>
        )}
      </>
    </Modal>
  );
};

export default ReviewerModal;
