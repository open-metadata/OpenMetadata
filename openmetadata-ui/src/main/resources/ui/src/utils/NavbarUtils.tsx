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

import Icon from '@ant-design/icons/lib/components/Icon';
import { Col, Row, Typography } from 'antd';
import { Link } from 'react-router-dom';
import { ReactComponent as IconExternalLink } from '../assets/svg/external-links.svg';
import { HELP_ITEMS_ENUM, SupportItem } from '../constants/Navbar.constants';
import navbarUtilClassBase from './NavbarUtilClassBase';

const getHelpDropdownLabelContentRenderer = (
  item: SupportItem,
  version?: string
) => {
  return (
    <Row className="cursor-pointer" onClick={item.handleSupportItemClick}>
      <Col span={4}>
        <Icon
          className="align-middle"
          component={item.icon}
          style={{ fontSize: '18px' }}
        />
      </Col>
      <Col className="flex items-center" span={20}>
        <Typography.Text className="text-base-color">
          {item.label}{' '}
          {item.key === HELP_ITEMS_ENUM.VERSION && (version ?? '?')}
        </Typography.Text>

        {item.isExternal && (
          <Icon
            className="m-l-xss text-base-color"
            component={IconExternalLink}
            style={{ fontSize: '16px' }}
          />
        )}
      </Col>
    </Row>
  );
};

const getHelpDropdownLabel = (item: SupportItem, version?: string) => {
  if (item.isExternal) {
    return (
      <a
        className="no-underline"
        href={item.link?.replace('{{currentVersion}}', version ?? '')}
        rel="noreferrer"
        target="_blank">
        {getHelpDropdownLabelContentRenderer(item, version)}
      </a>
    );
  } else if (item.link) {
    return (
      <Link className="no-underline" to={item.link}>
        {getHelpDropdownLabelContentRenderer(item)}
      </Link>
    );
  } else {
    return getHelpDropdownLabelContentRenderer(item);
  }
};

export const getHelpDropdownItems = (version?: string) =>
  navbarUtilClassBase.getHelpItems().map((item) => ({
    label: getHelpDropdownLabel(item, version),
    key: item.key,
  }));
