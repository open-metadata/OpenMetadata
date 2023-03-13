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

import { Col, Modal, Row, Typography } from 'antd';
import { t } from 'i18next';
import UserCard from 'pages/teams/UserCard';
import React, { useState } from 'react';
import { getEntityName } from 'utils/EntityUtils';
import Searchbar from '../searchbar/Searchbar';
import { FollowersModalProps } from './FollowersModal.interface';

const FollowersModal = ({
  header,
  list,
  onCancel,
  visible,
}: FollowersModalProps) => {
  const [searchText, setSearchText] = useState('');

  const getUserCards = () => {
    return list
      .filter((user) => {
        return (
          user.displayName?.includes(searchText) ||
          user.name?.includes(searchText)
        );
      })
      .map((user, index) => {
        const User = {
          displayName: getEntityName(user),
          fqn: user.fullyQualifiedName || '',
          id: user.id,
          type: user.type,
          name: user.name,
        };

        return (
          <Col key={index} span={8}>
            <UserCard isIconVisible item={User} />
          </Col>
        );
      });
  };

  const handleSearchAction = (searchValue: string) => {
    setSearchText(searchValue);
  };

  return (
    <Modal
      centered
      destroyOnClose
      data-testid="modal-container"
      open={visible}
      title={
        <Typography.Text strong data-testid="header">
          {header}
        </Typography.Text>
      }
      width={800}
      onCancel={onCancel}>
      <div>
        <Searchbar
          placeholder={`${t('label.search-for-type', {
            type: t('label.follower-plural'),
          })}...`}
          searchValue={searchText}
          typingInterval={1500}
          onSearch={handleSearchAction}
        />
        <Row gutter={[16, 16]}>{getUserCards()}</Row>
      </div>
    </Modal>
  );
};

export default FollowersModal;
