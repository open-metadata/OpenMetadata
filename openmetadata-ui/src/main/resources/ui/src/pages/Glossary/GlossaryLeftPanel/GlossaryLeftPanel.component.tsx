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

import {
  Badge,
  Box,
  Button,
  NavList,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  Glossary as GlossaryIcon,
  Plus,
} from '@openmetadata/ui-core-components/icons';
import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { DomainFilterChip } from '../../../components/common/DomainFilterChip/DomainFilterChip.component';
import GlossaryV1Skeleton from '../../../components/common/Skeleton/GlossaryV1/GlossaryV1LeftPanelSkeleton.component';
import ProposalSourceMark from '../../../components/governance/glossary/GlossaryReview/ProposalSourceMark';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../enums/permissions.enum';
import { Operation } from '../../../generated/entity/policies/policy';
import { useGlossaryPendingCounts } from '../../../hooks/governance/glossary/useGlossaryProposals';
import { useFqn } from '../../../hooks/useFqn';
import { getEntityName } from '../../../utils/EntityNameUtils';
import Fqn from '../../../utils/Fqn';
import { checkPermission } from '../../../utils/PermissionsUtils';
import { getGlossaryPath } from '../../../utils/RouterUtils';
import { GlossaryLeftPanelProps } from './GlossaryLeftPanel.interface';

const GlossaryLeftPanel = ({
  glossaries,
  onAddGlossary,
}: GlossaryLeftPanelProps) => {
  const { t } = useTranslation();
  const { permissions } = usePermissionProvider();
  const { fqn: glossaryFqn } = useFqn();
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

  const pendingCounts = useGlossaryPendingCounts(glossaries.length > 0);
  const hasPendingTerms = Object.keys(pendingCounts?.all ?? {}).length > 0;

  const navItems = useMemo(
    () =>
      glossaries.map((glossary) => {
        const key = glossary.name.toLowerCase();
        const pending = pendingCounts?.all[key] ?? 0;
        const fromAi = pendingCounts?.ai[key] ?? 0;

        return {
          label: getEntityName(glossary),
          href: getGlossaryPath(glossary.fullyQualifiedName),
          icon: GlossaryIcon,
          badge:
            pending > 0 ? (
              <Badge
                color={fromAi > 0 ? 'purple' : 'warning'}
                data-testid={`pending-terms-${glossary.name}`}
                size="sm"
                type="pill-color">
                {pending}
              </Badge>
            ) : undefined,
        };
      }),
    [glossaries, pendingCounts]
  );

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
                iconLeading={<Plus className="tw:text-fg-brand-primary" />}
                size="sm"
                onPress={onAddGlossary}>
                <Typography className="tw:text-brand-tertiary" weight="regular">
                  {t('label.add-entity', { entity: t('label.glossary') })}
                </Typography>
              </Button>
            </div>
          )}

          <DomainFilterChip className="tw:px-3" />

          <nav aria-label={t('label.glossary-plural')} ref={navRef}>
            <NavList
              activeUrl={getGlossaryPath(selectedKey)}
              className="tw:mt-0 tw:px-2 tw:lg:px-2"
              items={navItems}
              size="sm"
            />
          </nav>

          {hasPendingTerms && (
            <div
              className="tw:mx-3 tw:rounded-lg tw:bg-secondary tw:p-3 tw:text-xs tw:text-tertiary"
              data-testid="proposal-legend">
              <Box direction="col" gap={2}>
                <Box align="center" gap={2}>
                  <ProposalSourceMark source="ai" />
                  {t('label.proposed-by-ai-agent')}
                </Box>
                <Box align="center" gap={2}>
                  <ProposalSourceMark source="person" />
                  {t('label.proposed-by-a-person')}
                </Box>
              </Box>
            </div>
          )}
        </div>
      </GlossaryV1Skeleton>
    </div>
  );
};

export default GlossaryLeftPanel;
