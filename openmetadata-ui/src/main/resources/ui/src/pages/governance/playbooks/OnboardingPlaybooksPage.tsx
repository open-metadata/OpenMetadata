/*
 *  Copyright 2026 Collate.
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

import { Badge, Button, Typography } from '@openmetadata/ui-core-components';
import {
  ChevronRight,
  Lock,
  PlusCircle,
} from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import Loader from '../../../components/common/Loader/Loader';
import { OnboardingBackfillStatus } from '../../../components/governance/onboarding/OnboardingBackfillStatus';
import PageLayoutV1 from '../../../components/PageLayoutV1/PageLayoutV1';
import { OnboardingPlaybook } from '../../../generated/entity/governance/onboardingPlaybook';
import {
  getAssetCounts,
  getOnboardingPlaybooks,
} from '../../../rest/governance/onboarding/OnboardingPlaybook.api';
import { showErrorToast } from '../../../utils/ToastUtils';
import {
  PLAYBOOK_AUTHOR_ROLES,
  PLAYBOOK_ENTITY_TYPES,
} from './OnboardingPlaybooks.constants';
import { buildPlaybookRows, PlaybookRow } from './OnboardingPlaybooks.utils';

const COLUMNS = 'tw:grid tw:grid-cols-[2fr_1.7fr_1fr_1.3fr_1fr] tw:gap-4';
const ROW_CLASSES =
  `${COLUMNS} tw:w-full tw:items-center tw:border-b tw:border-secondary tw:px-5 ` +
  'tw:py-4 tw:text-left tw:last:border-b-0 tw:hover:bg-secondary';

/**
 * One playbook per asset type. Asset types without one are listed too, so configuring the first
 * playbook for a type is a visible next step rather than a hidden feature.
 */
const OnboardingPlaybooksPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [playbooks, setPlaybooks] = useState<OnboardingPlaybook[]>([]);
  const [assetCounts, setAssetCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);

  const fetchPlaybooks = useCallback(async () => {
    try {
      setIsLoading(true);
      // Independent reads - counts do not depend on which playbooks exist.
      const [response, counts] = await Promise.all([
        getOnboardingPlaybooks(),
        getAssetCounts(PLAYBOOK_ENTITY_TYPES),
      ]);
      setPlaybooks(response.data ?? []);
      setAssetCounts(counts);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlaybooks();
  }, [fetchPlaybooks]);

  const rows = useMemo(
    () => buildPlaybookRows(playbooks, t, assetCounts),
    [playbooks, t, assetCounts]
  );

  const openPlaybook = useCallback(
    (row: PlaybookRow) => {
      navigate(
        row.playbook
          ? `/settings/governance/onboarding-playbooks/${row.playbook.id}`
          : `/settings/governance/onboarding-playbooks/new/${row.entityType}`
      );
    },
    [navigate]
  );

  if (isLoading) {
    return <Loader />;
  }

  return (
    <PageLayoutV1 pageTitle={t('label.onboarding-playbook-plural')}>
      <div className="tw:flex tw:flex-col tw:gap-6 tw:p-6">
        <div className="tw:flex tw:flex-col tw:gap-2">
          <div className="tw:flex tw:items-center tw:gap-2">
            <Button
              color="link-color"
              size="sm"
              onPress={() => navigate('/settings/governance')}>
              {t('label.governance')}
            </Button>
            <Typography className="tw:text-tertiary">/</Typography>
            <Typography className="tw:text-2xl tw:font-semibold tw:text-primary">
              {t('label.onboarding-playbook-plural')}
            </Typography>
          </div>
          <Typography className="tw:max-w-3xl tw:text-sm tw:text-tertiary">
            {t('message.onboarding-playbooks-description')}
          </Typography>
        </div>

        <div
          className="tw:overflow-hidden tw:rounded-xl tw:border tw:border-secondary tw:bg-primary"
          data-testid="playbook-table">
          <div
            className={`${COLUMNS} tw:border-b tw:border-secondary tw:bg-secondary tw:px-5 tw:py-3`}>
            {[
              'label.asset-type',
              'label.enforced-at-creation',
              'label.structure',
              'label.maintained-by',
              'label.asset-plural',
            ].map((key) => (
              <Typography
                className="tw:text-xs tw:font-semibold tw:uppercase tw:tracking-wide tw:text-tertiary"
                key={key}>
                {t(key)}
              </Typography>
            ))}
          </div>

          {rows.map((row) => (
            <div key={row.entityType}>
              <button
                className={ROW_CLASSES}
                data-testid={`playbook-row-${row.entityType}`}
                key={row.entityType}
                type="button"
                onClick={() => openPlaybook(row)}>
                <div className="tw:flex tw:flex-col tw:gap-1">
                  <div className="tw:flex tw:items-center tw:gap-2">
                    <Typography className="tw:text-sm tw:font-semibold tw:text-primary">
                      {row.title}
                    </Typography>
                    <Badge
                      color={row.isConfigured ? 'success' : 'gray'}
                      size="sm"
                      type="pill-color">
                      {row.statusLabel}
                    </Badge>
                  </div>
                  <Typography className="tw:text-xs tw:text-tertiary">
                    {row.versionLabel}
                  </Typography>
                </div>
                <Typography className="tw:text-sm tw:text-secondary">
                  {row.enforcedAtCreation}
                </Typography>
                <Typography className="tw:text-sm tw:text-secondary">
                  {row.structure}
                </Typography>
                <Typography className="tw:text-sm tw:text-secondary">
                  {row.maintainedBy}
                </Typography>
                <div className="tw:flex tw:items-center tw:justify-between tw:gap-2">
                  <Typography className="tw:text-sm tw:text-secondary">
                    {row.assets}
                  </Typography>
                  {row.isConfigured ? (
                    <ChevronRight
                      aria-label={t('label.edit')}
                      className="tw:h-4 tw:w-4 tw:text-tertiary"
                    />
                  ) : (
                    <PlusCircle
                      aria-label={t('label.add')}
                      className="tw:h-4 tw:w-4 tw:text-brand-secondary"
                    />
                  )}
                </div>
              </button>
              {row.isConfigured && (
                <div className="tw:px-5 tw:pb-3">
                  <OnboardingBackfillStatus entityType={row.entityType} />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="tw:overflow-hidden tw:rounded-xl tw:border tw:border-secondary tw:bg-primary">
          <div className="tw:flex tw:items-start tw:justify-between tw:gap-4 tw:border-b tw:border-secondary tw:px-5 tw:py-4">
            <div className="tw:flex tw:items-start tw:gap-3">
              <Lock
                aria-hidden
                className="tw:mt-0.5 tw:h-4 tw:w-4 tw:text-brand-secondary"
              />
              <div className="tw:flex tw:flex-col tw:gap-1">
                <Typography className="tw:text-sm tw:font-semibold tw:text-primary">
                  {t('label.who-can-author-playbooks')}
                </Typography>
                <Typography className="tw:text-xs tw:text-tertiary">
                  {t('message.playbook-roles-description')}
                </Typography>
              </div>
            </div>
            <Button
              color="link-color"
              size="sm"
              onPress={() => navigate('/settings/access/roles')}>
              {t('label.manage-roles')}
            </Button>
          </div>
          {PLAYBOOK_AUTHOR_ROLES.map((role) => (
            <div
              className="tw:grid tw:grid-cols-3 tw:gap-4 tw:border-b tw:border-secondary tw:px-5 tw:py-3 tw:last:border-b-0"
              key={role.roleKey}>
              <Typography className="tw:text-sm tw:font-medium tw:text-primary">
                {t(role.roleKey)}
              </Typography>
              <Typography className="tw:text-sm tw:text-secondary">
                {t(role.scopeKey)}
              </Typography>
              <Typography className="tw:text-sm tw:text-secondary">
                {t(role.capabilityKey)}
              </Typography>
            </div>
          ))}
        </div>
      </div>
    </PageLayoutV1>
  );
};

export default OnboardingPlaybooksPage;
