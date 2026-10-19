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
import { Ontology } from '../../../../generated/entity/data/ontology';
import { listOntologies } from '../../../../rest/ontologyAPI';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';

interface OntologyPickerProps {
  value?: Ontology;
  onChange: (ontology?: Ontology) => void;
}

const OntologyPicker = ({ value, onChange }: OntologyPickerProps) => {
  const { t } = useTranslation();
  const fetchData = useCallback<TreeSelectDataFetcher<Ontology>>(
    async ({ after, pageSize = 25, signal }) => {
      const page = await listOntologies(
        { limit: pageSize, after, fields: 'owners,reviewers' },
        signal
      );

      return {
        nodes: page.data.map((ontology) => ({
          id: ontology.id,
          value: ontology.id,
          label: getEntityName(ontology),
          data: ontology,
          isLeaf: true,
        })),
        total: page.paging.total,
        nextCursor: page.paging.after,
        hasMore: Boolean(page.paging.after),
      };
    },
    []
  );

  return (
    <TreeSelect
      commitMode="immediate"
      fetchData={fetchData}
      label={t('label.ontology')}
      multiple={false}
      pageSize={25}
      placeholder={t('label.select-entity', { entity: t('label.ontology') })}
      renderTrigger={({ toggle }) => (
        <Button color="secondary" size="sm" onPress={toggle}>
          {value
            ? getEntityName(value)
            : t('label.select-entity', { entity: t('label.ontology') })}
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
            : t('server.entity-fetch-error', { entity: t('label.ontology') })
        )
      }
    />
  );
};

export default OntologyPicker;
