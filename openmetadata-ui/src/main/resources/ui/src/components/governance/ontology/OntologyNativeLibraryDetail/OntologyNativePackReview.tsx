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

import { useQuery } from '@tanstack/react-query';
import { reviewNativeOntologyPack } from '../../../../rest/ontologyAPI';
import OntologyNativeImportItems from '../OntologyReleaseExportModal/OntologyNativeImportItems';
import {
  importItemsOf,
  initialSelection,
} from '../OntologyReleaseExportModal/OntologyNativeImportPanel.utils';

interface OntologyNativePackReviewProps {
  readonly moduleIds: readonly string[];
  readonly ontologyId: string;
  readonly packId: string;
}

/** What installing the chosen modules into an existing ontology would do, item by item, with any clash it adds. */
const OntologyNativePackReview = ({
  moduleIds,
  ontologyId,
  packId,
}: OntologyNativePackReviewProps) => {
  const review = useQuery({
    enabled: moduleIds.length > 0,
    gcTime: 0,
    queryKey: ['ontology-pack-review', ontologyId, packId, [...moduleIds]],
    retry: false,
    queryFn: () =>
      reviewNativeOntologyPack(ontologyId, packId, {
        moduleIds: [...moduleIds],
      }),
  });
  const summary = review.data?.summary;
  if (!summary || importItemsOf(summary).length === 0) {
    return null;
  }

  return (
    <div data-testid="ontology-library-pack-review">
      <OntologyNativeImportItems
        isDisabled
        items={importItemsOf(summary)}
        selection={initialSelection(summary)}
        onSelectionChange={() => undefined}
      />
    </div>
  );
};

export default OntologyNativePackReview;
