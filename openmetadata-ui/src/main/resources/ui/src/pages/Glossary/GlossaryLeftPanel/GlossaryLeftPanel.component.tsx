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

import { Button, Col, Menu, MenuProps, Row } from 'antd';
import { ItemType } from 'antd/lib/menu/hooks/useItems';
import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import GlossaryIcon from '../../../assets/svg/glossary.svg?react';
import PlusIcon from '../../../assets/svg/plus-primary.svg?react';
import LeftPanelCard from '../../../components/common/LeftPanelCard/LeftPanelCard';
import GlossaryV1Skeleton from '../../../components/common/Skeleton/GlossaryV1/GlossaryV1LeftPanelSkeleton.component';
import { ROUTES } from '../../../constants/constants';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { Operation } from '../../../generated/entity/policies/policy';
import { useFqn } from '../../../hooks/useFqn';
import { getEntityName } from '../../../utils/EntityUtils';
import Fqn from '../../../utils/Fqn';
import { checkPermission } from '../../../utils/PermissionsUtils';
import { getGlossaryPath } from '../../../utils/RouterUtils';
import { GlossaryLeftPanelProps } from './GlossaryLeftPanel.interface';

const GlossaryLeftPanel = ({ glossaries }: GlossaryLeftPanelProps) => {
  const { t } = useTranslation();
  const { permissions } = usePermissionProvider();
  const { fqn: glossaryFqn } = useFqn();
  const navigate = useNavigate();
  const menuRef = useRef<Menu>(null);

  const createGlossaryPermission = useMemo(
    () =>
      checkPermission(Operation.Create, ResourceEntity.GLOSSARY, permissions),
    [permissions]
  );
  const selectedKey = useMemo(() => {
    if (glossaryFqn) {
      return Fqn.split(glossaryFqn)[0];
    }

    return glossaries[0].fullyQualifiedName;
  }, [glossaryFqn]);

  const menuItems: ItemType[] = useMemo(() => {
    return glossaries.reduce((acc, glossary) => {
      return [
        ...acc,
        {
          key: glossary.fullyQualifiedName ?? '',
          label: getEntityName(glossary),
          icon: <GlossaryIcon height={16} width={16} />,
        },
      ];
    }, [] as ItemType[]);
  }, [glossaries]);

  const handleAddGlossaryClick = () => {
    navigate(ROUTES.ADD_GLOSSARY);
  };
  const handleMenuClick: MenuProps['onClick'] = (event) => {
    navigate(getGlossaryPath(event.key));
  };

  useEffect(() => {
    if (menuRef.current && glossaryFqn) {
      const items = document?.querySelectorAll(
        `[data-testid="glossary-left-panel"] > li > span`
      );
      const menuItem = glossaries.find(
        (item) => item.fullyQualifiedName === glossaryFqn
      );

      const itemToScroll = Array.from(items).find(
        (item) =>
          item.textContent === menuItem?.name ||
          item.textContent === menuItem?.displayName
      );

      if (itemToScroll) {
        const rect = itemToScroll.getBoundingClientRect();
        const isVisible =
          rect.top >= 0 &&
          rect.bottom <=
            (window.innerHeight || document.documentElement.clientHeight);

        if (!isVisible) {
          const itemIndex = Array.from(items).findIndex(
            (item) => item === itemToScroll
          );
          const blockPosition =
            itemIndex > Array.from(items).length - 10 ? 'nearest' : 'center';
          itemToScroll.scrollIntoView({
            behavior: 'smooth',
            block: blockPosition,
          });
        }
      }
    }
  }, [glossaryFqn]);

  return (
    <LeftPanelCard id="glossary">
      <GlossaryV1Skeleton loading={glossaries.length === 0}>
        <Row gutter={[0, 16]}>
          {createGlossaryPermission && (
            <Col className="p-x-sm" span={24}>
              <Button
                block
                className="text-primary"
                data-testid="add-glossary"
                onClick={handleAddGlossaryClick}>
                <div className="flex-center">
                  <PlusIcon className="anticon m-r-xss" />
                  {t('label.add')}
                </div>
              </Button>
            </Col>
          )}

          <Col span={24}>
            {menuItems.length ? (
              <Menu
                className="custom-menu"
                data-testid="glossary-left-panel"
                items={menuItems}
                mode="inline"
                ref={menuRef}
                selectedKeys={[selectedKey]}
                onClick={handleMenuClick}
              />
            ) : (
              <p className="text-grey-muted text-center">
                <span>{t('label.no-glossary-found')}</span>
              </p>
            )}
          </Col>
        </Row>
      </GlossaryV1Skeleton>
    </LeftPanelCard>
  );
};

export default GlossaryLeftPanel;
