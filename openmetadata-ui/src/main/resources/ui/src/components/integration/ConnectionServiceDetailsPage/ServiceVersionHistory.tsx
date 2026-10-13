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
import { AxiosError } from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ServiceCategory } from '../../../enums/service.enum';
import { ChangeDescription } from '../../../generated/entity/type';
import { EntityHistory } from '../../../generated/type/entityHistory';
import { getServiceVersions } from '../../../rest/serviceAPI';
import { getSummary } from '../../../utils/EntityVersionUtils';
import { formatEntityVersion } from '../../../utils/EntityVersionUtilsPure';
import { showErrorToast } from '../../../utils/ToastUtils';
import { VersionBadgeButton } from '../../common/VersionHistorySlideout/VersionBadgeButton.component';
import { VersionHistorySlideout } from '../../common/VersionHistorySlideout/VersionHistorySlideout.component';
import { VersionHistoryItem } from '../../common/VersionHistorySlideout/VersionHistorySlideout.interface';

interface ServiceVersionHistoryProps {
  serviceCategory: ServiceCategory;
  serviceId: string;
  version?: number;
}

interface ServiceVersionSnapshot {
  version: number;
  updatedBy?: string;
  updatedAt?: number;
  changeDescription?: ChangeDescription;
}

/** Newest first, as each history entry is the service's JSON at that version. */
export const toServiceVersionHistory = (
  history: EntityHistory
): VersionHistoryItem[] =>
  (history.versions ?? [])
    .map((snapshot) => JSON.parse(String(snapshot)) as ServiceVersionSnapshot)
    .sort((a, b) => b.version - a.version)
    .map((snapshot, index) => ({
      version: formatEntityVersion(snapshot.version),
      isCurrent: index === 0,
      updatedBy: snapshot.updatedBy,
      updatedAt: snapshot.updatedAt,
      summary: snapshot.changeDescription
        ? getSummary({ changeDescription: snapshot.changeDescription })
        : undefined,
    }));

/**
 * The service's current version in the page header; pressing it opens the version history,
 * as on Context Center. The history loads each time it opens, so it includes the edits made
 * since the page loaded.
 */
export const ServiceVersionHistory = ({
  serviceCategory,
  serviceId,
  version,
}: ServiceVersionHistoryProps) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [entries, setEntries] = useState<VersionHistoryItem[]>([]);

  useEffect(() => {
    // A slower answer for a previous opening, or another service, must not land on this one.
    let isCurrent = true;
    if (isOpen) {
      setIsLoading(true);
      getServiceVersions(serviceCategory, serviceId)
        .then((history) => {
          if (isCurrent) {
            setEntries(toServiceVersionHistory(history));
          }
        })
        .catch((error: AxiosError) => {
          if (isCurrent) {
            showErrorToast(error);
          }
        })
        .finally(() => {
          if (isCurrent) {
            setIsLoading(false);
          }
        });
    }

    return () => {
      isCurrent = false;
    };
  }, [isOpen, serviceCategory, serviceId]);

  const handleOpen = useCallback(() => setIsOpen(true), []);
  const handleClose = useCallback(() => setIsOpen(false), []);
  const displayVersion = useMemo(() => formatEntityVersion(version), [version]);

  return (
    <>
      <VersionBadgeButton
        testId="service-version-history-button"
        version={displayVersion}
        onPress={handleOpen}
      />
      <VersionHistorySlideout
        emptyMessage={t('label.no-entity', {
          entity: t('label.version-history'),
        })}
        entries={entries}
        isLoading={isLoading}
        isOpen={isOpen}
        testId="service-version-history"
        onClose={handleClose}
      />
    </>
  );
};
