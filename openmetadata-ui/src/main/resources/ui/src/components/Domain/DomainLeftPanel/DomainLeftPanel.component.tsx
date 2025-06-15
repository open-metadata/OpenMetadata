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
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as DomainIcon } from '../../../assets/svg/ic-domain.svg';
import { ReactComponent as PlusIcon } from '../../../assets/svg/plus-primary.svg';
import LeftPanelCard from '../../../components/common/LeftPanelCard/LeftPanelCard';
import { ROUTES } from '../../../constants/constants';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { Operation } from '../../../generated/entity/policies/policy';
import { useFqn } from '../../../hooks/useFqn';
import { getEntityName } from '../../../utils/EntityUtils';
import Fqn from '../../../utils/Fqn';
import { checkPermission } from '../../../utils/PermissionsUtils';
import { getDomainPath } from '../../../utils/RouterUtils';
import GlossaryV1Skeleton from '../../common/Skeleton/GlossaryV1/GlossaryV1LeftPanelSkeleton.component';
import { DomainLeftPanelProps } from './DomainLeftPanel.interface';
const DomainsLeftPanel = ({ domains }: DomainLeftPanelProps) => {
  const { t } = useTranslation();
  const { permissions } = usePermissionProvider();
  const { fqn: domainFqn } = useFqn();
  const navigate = useNavigate();

  const createDomainsPermission = useMemo(
    () => checkPermission(Operation.Create, ResourceEntity.DOMAIN, permissions),
    [permissions]
  );
  const selectedKey = useMemo(() => {
    if (domainFqn) {
      return Fqn.split(domainFqn)[0];
    }

    return domains[0].fullyQualifiedName;
  }, [domainFqn]);

  const menuItems: ItemType[] = useMemo(() => {
    return domains.reduce((acc, domain) => {
      return [
        ...acc,
        {
          key: domain.fullyQualifiedName ?? '',
          label: getEntityName(domain),
          icon: <DomainIcon height={16} width={16} />,
        },
      ];
    }, [] as ItemType[]);
  }, [domains]);

  const handleAddDomain = () => {
    navigate(ROUTES.ADD_DOMAIN);
  };
  const handleMenuClick: MenuProps['onClick'] = (event) => {
    navigate(getDomainPath(event.key));
  };

  return (
    <LeftPanelCard id="domain">
      <GlossaryV1Skeleton loading={domains.length === 0}>
        <Row gutter={[0, 16]}>
          {createDomainsPermission && (
            <Col className="p-x-sm" span={24}>
              <Button
                block
                className="text-primary"
                data-testid="add-domain"
                onClick={handleAddDomain}>
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
                data-testid="domain-left-panel"
                items={menuItems}
                mode="inline"
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

export default DomainsLeftPanel;
