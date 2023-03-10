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

import { Button, Col, Menu, MenuProps, Row, Tooltip, Typography } from 'antd';
import { ItemType } from 'antd/lib/menu/hooks/useItems';
import { ReactComponent as IconFolder } from 'assets/svg/folder.svg';
import { ReactComponent as PlusIcon } from 'assets/svg/plus-primary.svg';
import LeftPanelCard from 'components/common/LeftPanelCard/LeftPanelCard';
import Searchbar from 'components/common/searchbar/Searchbar';
import { usePermissionProvider } from 'components/PermissionProvider/PermissionProvider';
import { ResourceEntity } from 'components/PermissionProvider/PermissionProvider.interface';
import GlossaryV1Skeleton from 'components/Skeleton/GlossaryV1/GlossaryV1LeftPanelSkeleton.component';
import { ROUTES } from 'constants/constants';
import { Operation } from 'generated/entity/policies/policy';
import { isEmpty } from 'lodash';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { checkPermission } from 'utils/PermissionsUtils';
import { getGlossaryPath } from 'utils/RouterUtils';
import Fqn from '../../../utils/Fqn';
import { GlossaryLeftPanelProps } from './GlossaryLeftPanel.interface';

const GlossaryLeftPanel = ({ glossaries }: GlossaryLeftPanelProps) => {
  const { t } = useTranslation();
  const { permissions } = usePermissionProvider();
  const { glossaryName } = useParams<{ glossaryName: string }>();
  const history = useHistory();

  const [searchTerm, setSearchTerm] = useState('');

  const createGlossaryPermission = useMemo(
    () =>
      checkPermission(Operation.Create, ResourceEntity.GLOSSARY, permissions),
    [permissions]
  );

  const getEncodedGlossaryName = (glossary: string) =>
    glossary.includes('.') ? Fqn.quoteName(glossary) : glossary;

  const selectedKey = useMemo(() => {
    if (glossaryName) {
      return Fqn.split(glossaryName)[0];
    }

    return getEncodedGlossaryName(glossaries[0].name);
  }, [glossaryName]);

  const menuItems: ItemType[] = useMemo(() => {
    return glossaries.reduce((acc, glossary) => {
      if (
        !isEmpty(searchTerm) &&
        !glossary.name
          .toLocaleLowerCase()
          .includes(searchTerm.toLocaleLowerCase())
      ) {
        return acc;
      }

      return [
        ...acc,
        {
          key: getEncodedGlossaryName(glossary.name),
          label: glossary.name,
          icon: <IconFolder />,
        },
      ];
    }, [] as ItemType[]);
  }, [glossaries, searchTerm]);

  const handleAddGlossaryClick = () => {
    history.push(ROUTES.ADD_GLOSSARY);
  };
  const handleMenuClick: MenuProps['onClick'] = (event) => {
    history.push(getGlossaryPath(event.key));
  };
  const handleSearch = (term: string) => {
    setSearchTerm(term);
  };

  return (
    <LeftPanelCard id="glossary">
      <GlossaryV1Skeleton loading={glossaries.length === 0}>
        <Row className="p-y-xs" gutter={[0, 16]}>
          <Col className="p-x-sm" span={24}>
            <Typography.Text strong className="m-b-0">
              {t('label.glossary')}
            </Typography.Text>
          </Col>
          <Col className="p-x-sm" span={24}>
            <Searchbar
              removeMargin
              showLoadingStatus
              placeholder={`${t('label.search-for-type', {
                type: t('label.glossary'),
              })}...`}
              searchValue={searchTerm}
              typingInterval={500}
              onSearch={handleSearch}
            />
          </Col>
          <Col className="p-x-sm" span={24}>
            <Tooltip
              title={
                createGlossaryPermission
                  ? t('label.add-entity', { entity: t('label.glossary') })
                  : t('message.no-permission-for-action')
              }>
              <Button
                block
                className="text-primary"
                data-testid="add-glossary"
                disabled={!createGlossaryPermission}
                icon={<PlusIcon className="anticon" />}
                onClick={handleAddGlossaryClick}>
                {t('label.add-entity', { entity: t('label.glossary') })}
              </Button>
            </Tooltip>
          </Col>
          <Col span={24}>
            {menuItems.length ? (
              <Menu
                className="custom-menu"
                data-testid="glossary-left-panel"
                items={menuItems}
                mode="inline"
                selectedKeys={[selectedKey]}
                onClick={handleMenuClick}
              />
            ) : (
              <p className="text-grey-muted text-center">
                {searchTerm ? (
                  <span>
                    {t('message.no-entity-found-for-name', {
                      entity: t('label.glossary'),
                      name: searchTerm,
                    })}
                  </span>
                ) : (
                  <span>{t('label.no-glossary-found')}</span>
                )}
              </p>
            )}
          </Col>
        </Row>
      </GlossaryV1Skeleton>
    </LeftPanelCard>
  );
};

export default GlossaryLeftPanel;
