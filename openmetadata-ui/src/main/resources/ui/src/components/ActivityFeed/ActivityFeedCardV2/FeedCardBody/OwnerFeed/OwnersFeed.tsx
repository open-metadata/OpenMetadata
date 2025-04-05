/*
 *  Copyright 2024 Collate.
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

import { Col, Row, Typography } from 'antd';
import { isEmpty } from 'lodash';
import React, { useMemo } from 'react';
import { ReactComponent as AddIcon } from '../../../../../assets/svg/added-icon.svg';
import { ReactComponent as DeletedIcon } from '../../../../../assets/svg/deleted-icon.svg';

import { useTranslation } from 'react-i18next';
import {
  MAX_VISIBLE_OWNERS_FOR_FEED_CARD,
  MAX_VISIBLE_OWNERS_FOR_FEED_TAB,
} from '../../../../../constants/constants';
import { Owner } from '../../../../../generated/entity/feed/owner';
import { Thread } from '../../../../../generated/entity/feed/thread';
import { EntityReference } from '../../../../../generated/entity/type';
import { OwnerLabel } from '../../../../common/OwnerLabel/OwnerLabel.component';
import UserPopOverCard from '../../../../common/PopOverCard/UserPopOverCard';
import ProfilePicture from '../../../../common/ProfilePicture/ProfilePicture';

interface OwnersFeedProps {
  feed: Thread;
  isForFeedTab?: boolean;
  showThread?: boolean;
}

function OwnersFeed({
  feed,
  isForFeedTab,
  showThread,
}: Readonly<OwnersFeedProps>) {
  const { t } = useTranslation();
  const { previousOwner, updatedOwner } = useMemo(() => {
    return {
      previousOwner:
        (feed.feedInfo?.entitySpecificInfo as Owner)?.previousOwner ?? [],
      updatedOwner:
        (feed.feedInfo?.entitySpecificInfo as Owner)?.updatedOwner ?? [],
    };
  }, [feed]);

  const maxVisibleOwners = isForFeedTab
    ? MAX_VISIBLE_OWNERS_FOR_FEED_TAB
    : MAX_VISIBLE_OWNERS_FOR_FEED_CARD;

  return (
    <Row gutter={[8, 8]}>
      {!isEmpty(updatedOwner) && (
        <Col span={24}>
          <Row wrap align="middle">
            <Row align="middle" gutter={[8, 8]}>
              <AddIcon className="text-success-hover" height={16} width={16} />
              <Typography.Text className="owners-label">
                {t('label.owner-plural-with-colon')}
              </Typography.Text>
            </Row>

            <Col>
              {updatedOwner.length <= maxVisibleOwners ? (
                <Row wrap align="middle">
                  {updatedOwner.map((owner: EntityReference) => (
                    <UserPopOverCard key={owner.id} userName={owner.name ?? ''}>
                      <div
                        className={`owner-chip d-flex items-center ${
                          showThread && 'bg-white'
                        }`}>
                        <ProfilePicture
                          displayName={owner.displayName}
                          name={owner.name ?? ''}
                          width="24"
                        />
                        <Typography.Text className="owner-chip-text">
                          {owner.displayName}
                        </Typography.Text>
                      </div>
                    </UserPopOverCard>
                  ))}
                </Row>
              ) : (
                <OwnerLabel
                  avatarSize={24}
                  isCompactView={false}
                  maxVisibleOwners={maxVisibleOwners}
                  owners={updatedOwner}
                  showLabel={false}
                />
              )}
            </Col>
          </Row>
        </Col>
      )}
      {!isEmpty(previousOwner) && (
        <Col span={24}>
          <Row wrap align="middle">
            <Col>
              <Row align="middle" gutter={[8, 8]}>
                <DeletedIcon className="text-error" height={14} width={14} />
                <Typography.Text className="owners-label">
                  {t('label.owner-plural-with-colon')}
                </Typography.Text>
              </Row>
            </Col>
            <Col>
              {previousOwner.length <= maxVisibleOwners ? (
                <Row align="middle">
                  {previousOwner.map((owner: EntityReference) => (
                    <UserPopOverCard key={owner.id} userName={owner.name ?? ''}>
                      <div
                        className={`owner-chip d-flex items-center ${
                          showThread && 'bg-white'
                        }`}>
                        <ProfilePicture
                          displayName={owner.displayName}
                          name={owner.name ?? ''}
                          width="24"
                        />
                        <Typography.Text className="owner-chip-text">
                          {owner.displayName}
                        </Typography.Text>
                      </div>
                    </UserPopOverCard>
                  ))}
                </Row>
              ) : (
                <OwnerLabel
                  avatarSize={24}
                  isCompactView={false}
                  maxVisibleOwners={maxVisibleOwners}
                  owners={previousOwner}
                  showLabel={false}
                />
              )}
            </Col>
          </Row>
        </Col>
      )}
    </Row>
  );
}

export default OwnersFeed;
