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

import { Button, NavList } from '@openmetadata/ui-core-components';
import { Glossary as GlossaryIcon } from '@openmetadata/ui-core-components/icons';
import { Plus } from '@untitledui/icons';
import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import GlossaryV1Skeleton from '../../../components/common/Skeleton/GlossaryV1/GlossaryV1LeftPanelSkeleton.component';
import { ROUTES } from '../../../constants/constants';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { Operation } from '../../../generated/entity/policies/policy';
import { useFqn } from '../../../hooks/useFqn';
import { getEntityName } from '../../../utils/EntityNameUtils';
import Fqn from '../../../utils/Fqn';
import { checkPermission } from '../../../utils/PermissionsUtils';
import { getGlossaryPath } from '../../../utils/RouterUtils';
import { GlossaryLeftPanelProps } from './GlossaryLeftPanel.interface';

const GlossaryLeftPanel = ({ glossaries }: GlossaryLeftPanelProps) => {
  const { t } = useTranslation();
  const { permissions } = usePermissionProvider();
  const { fqn: glossaryFqn } = useFqn();
  const navigate = useNavigate();
  const navRef = useRef<HTMLElement>(null);

  const createGlossaryPermission = useMemo(
    () =>
      checkPermission(Operation.Create, ResourceEntity.GLOSSARY, permissions),
    [permissions]
  );
  const selectedKey = useMemo(() => {
    if (glossaryFqn) {
      return Fqn.split(glossaryFqn)[0];
    }

    return glossaries[0]?.fullyQualifiedName;
  }, [glossaryFqn, glossaries]);

  const navItems = useMemo(
    () =>
      glossaries.map((glossary) => ({
        label: getEntityName(glossary),
        href: getGlossaryPath(glossary.fullyQualifiedName),
        icon: GlossaryIcon,
      })),
    [glossaries]
  );

  const handleAddGlossaryClick = () => {
    navigate(ROUTES.ADD_GLOSSARY);
  };

  useEffect(() => {
    const activeItem = navRef.current?.querySelector<HTMLElement>(
      '[aria-current="page"]'
    );

    if (!glossaryFqn || !activeItem) {
      return;
    }

    const rect = activeItem.getBoundingClientRect();
    const isVisible =
      rect.top >= 0 &&
      rect.bottom <=
        (window.innerHeight || document.documentElement.clientHeight);

    if (!isVisible) {
      const index = glossaries.findIndex(
        (glossary) => glossary.fullyQualifiedName === selectedKey
      );
      // Near the end of the list "center" would scroll past the last item.
      activeItem.scrollIntoView({
        behavior: 'smooth',
        block: index > glossaries.length - 10 ? 'nearest' : 'center',
      });
    }
  }, [glossaryFqn]);

  return (
    <div className="tw:h-full" data-testid="glossary-left-panel">
      <GlossaryV1Skeleton loading={glossaries.length === 0}>
        <div className="tw:flex tw:flex-col tw:gap-4">
          {createGlossaryPermission && (
            <div className="tw:px-3">
              <Button
                className="tw:w-full"
                color="secondary"
                data-testid="add-glossary"
                iconLeading={Plus}
                size="sm"
                onPress={handleAddGlossaryClick}>
                {t('label.add')}
              </Button>
            </div>
          )}

          <nav aria-label={t('label.glossary-plural')} ref={navRef}>
            <NavList
              activeUrl={getGlossaryPath(selectedKey)}
              className="tw:mt-0 tw:px-2 tw:lg:px-2"
              items={navItems}
              size="sm"
            />
          </nav>
        </div>
      </GlossaryV1Skeleton>
    </div>
  );
};

export default GlossaryLeftPanel;
