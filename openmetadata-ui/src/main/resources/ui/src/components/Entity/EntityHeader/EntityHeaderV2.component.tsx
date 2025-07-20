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
import { Col, Row } from 'antd';
import { EntityHeader } from './EntityHeader.component';
import { EntityHeaderV2Props } from './EntityHeaderV2.interface';
import './EntityHeaderV2.less';

/**
 * EntityHeaderV2 displays an entity header with an optional cover photo.
 * If no coverPhotoUrl is provided, a default gradient background is shown.
 * The icon is always rendered with the 'domains-details-icon' style.
 * @param props - EntityHeaderV2Props
 */
export function EntityHeaderV2(props: EntityHeaderV2Props) {
  const { coverPhotoUrl, icon, ActionButtons, ...entityHeaderProps } = props;

  return (
    <Row className="entity-header-v2">
      <Col className="entity-header-v2-cover">
        {coverPhotoUrl ? (
          <img
            alt="cover"
            className="entity-header-v2-cover-img"
            src={coverPhotoUrl}
          />
        ) : (
          <div className="entity-header-v2-cover-default" />
        )}
      </Col>
      <Row className="entity-v2-header-container">
        <div className="entity-v2-title-row">
          <EntityHeader
            {...entityHeaderProps}
            breadcrumb={[]}
            icon={<div className="entity-details-icon">{icon}</div>}
          />
          {ActionButtons && (
            <div className="entity-header-v2-actions-inline">
              {ActionButtons}
            </div>
          )}
        </div>
      </Row>
    </Row>
  );
}
