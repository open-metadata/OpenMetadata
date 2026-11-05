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
import {
  Button,
  TreeSelect,
  TreeSelectDataFetcher,
} from '@openmetadata/ui-core-components';
import { isAxiosError } from 'axios';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { OntologyRelease } from '../../../../generated/entity/data/ontologyRelease';
import { listOntologyReleases } from '../../../../rest/ontologyAPI';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';

interface OntologyReleasePickerProps {
  ontologyId: string;
  label: string;
  value?: OntologyRelease;
  onChange: (release?: OntologyRelease) => void;
}

const OntologyReleasePicker = ({
  ontologyId,
  label,
  value,
  onChange,
}: OntologyReleasePickerProps) => {
  const { t } = useTranslation();
  const fetchData = useCallback<TreeSelectDataFetcher<OntologyRelease>>(
    async ({ after, pageSize = 25, signal }) => {
      const page = await listOntologyReleases(
        ontologyId,
        { limit: pageSize, after },
        signal
      );

      return {
        nodes: page.data.map((release) => ({
          id: release.id,
          value: release.id,
          data: release,
          label: `${getEntityName(release)} (${t(
            `label.${release.entityStatus.toLowerCase().replaceAll(' ', '-')}`
          )})`,
          isLeaf: true,
        })),
        total: page.paging.total,
        nextCursor: page.paging.after,
        hasMore: Boolean(page.paging.after),
      };
    },
    [ontologyId, t]
  );

  return (
    <TreeSelect
      commitMode="immediate"
      fetchData={fetchData}
      label={label}
      multiple={false}
      pageSize={25}
      renderTrigger={({ toggle }) => (
        <Button aria-label={label} color="secondary" size="sm" onPress={toggle}>
          {value ? getEntityName(value) : label}
        </Button>
      )}
      value={
        value
          ? {
              id: value.id,
              value: value.id,
              label: getEntityName(value),
              data: value,
            }
          : null
      }
      onChange={(node) =>
        onChange((Array.isArray(node) ? node[0] : node)?.data)
      }
      onFetchError={(error) =>
        showErrorToast(
          isAxiosError(error)
            ? error
            : t('server.entity-fetch-error', {
                entity: t('label.ontology-release'),
              })
        )
      }
    />
  );
};

export default OntologyReleasePicker;
