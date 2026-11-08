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

import { Alert, Button } from '@openmetadata/ui-core-components';
import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { reviewNativeOntologyPack } from '../../../../rest/ontologyAPI';
import OntologyNativeImportItems from '../OntologyReleaseExportModal/OntologyNativeImportItems';
import {
  importItemsOf,
  initialSelection,
} from '../OntologyReleaseExportModal/OntologyNativeImportPanel.utils';

type PackReviewQuery = UseQueryResult<
  Awaited<ReturnType<typeof reviewNativeOntologyPack>>
>;

interface OntologyNativePackReviewProps {
  readonly review: PackReviewQuery;
}

export const useNativePackReview = (
  ontologyId: string | undefined,
  packId: string,
  moduleIds: readonly string[]
) =>
  useQuery({
    enabled: Boolean(ontologyId) && moduleIds.length > 0,
    gcTime: 0,
    queryKey: ['ontology-pack-review', ontologyId, packId, [...moduleIds]],
    retry: false,
    queryFn: () =>
      reviewNativeOntologyPack(ontologyId as string, packId, {
        moduleIds: [...moduleIds],
      }),
  });

/** What installing the chosen modules into an existing ontology would do, item by item, with any clash it adds. */
const OntologyNativePackReview = ({
  review,
}: OntologyNativePackReviewProps) => {
  const { t } = useTranslation();
  if (review.isError) {
    return (
      <Alert
        data-testid="ontology-library-pack-review-error"
        rightContent={
          <Button
            color="secondary"
            data-testid="ontology-library-pack-review-retry"
            size="sm"
            onPress={() => void review.refetch()}>
            {t('label.retry')}
          </Button>
        }
        variant="error">
        {t('message.ontology-pack-review-failed')}
      </Alert>
    );
  }
  const summary = review.data?.summary;
  if (
    !summary ||
    (importItemsOf(summary).length === 0 && !summary.omittedItems)
  ) {
    return null;
  }

  return (
    <div data-testid="ontology-library-pack-review">
      <OntologyNativeImportItems
        isDisabled
        items={importItemsOf(summary)}
        omittedItems={summary.omittedItems ?? 0}
        selection={initialSelection(summary)}
        onSelectionChange={() => undefined}
      />
    </div>
  );
};

export default OntologyNativePackReview;
