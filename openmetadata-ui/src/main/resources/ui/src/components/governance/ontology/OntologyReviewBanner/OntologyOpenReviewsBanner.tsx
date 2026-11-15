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
import { Button } from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';
import { OntologyReleaseReview } from '../../../../generated/api/data/ontologyReleaseReview';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import OntologyReviewPill from './OntologyReviewPill';

type Props = {
  /** The open reviews waiting on the viewer's vote. */
  reviews: OntologyReleaseReview[];
  onOpenTask: (taskId: string) => void;
  onOpenList: () => void;
  onDismiss?: () => void;
};

/**
 * One pill for the reviews waiting on the viewer: who asked when there is one,
 * otherwise how many, with Review opening the Tasks list.
 */
const OntologyOpenReviewsBanner = ({
  reviews,
  onOpenTask,
  onOpenList,
  onDismiss,
}: Props) => {
  const { t } = useTranslation();
  const [only] = reviews;
  if (!only) {
    return null;
  }
  const isSingle = reviews.length === 1;

  return (
    <OntologyReviewPill
      action={
        <Button
          pill
          color="secondary-warning-outline"
          size="sm"
          onPress={() => (isSingle ? onOpenTask(only.task.id) : onOpenList())}>
          {t('label.review')}
        </Button>
      }
      testId="ontology-open-reviews-banner"
      title={
        isSingle
          ? t('message.ontology-review-asked-you', {
              requester: getEntityName(only.requester),
              version: getEntityName(only.ontology),
            })
          : t('message.ontology-review-waiting-count', {
              count: reviews.length,
            })
      }
      tone="warning"
      onDismiss={onDismiss}
    />
  );
};

export default OntologyOpenReviewsBanner;
