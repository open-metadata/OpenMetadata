/*
 *  Copyright 2025 Collate.
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
import { CheckCircle, XCircle } from '@openmetadata/ui-core-components/icons';
import { useTranslation } from 'react-i18next';

interface StatusActionProps {
  onApprove: () => void;
  onReject: () => void;
  dataTestId?: string;
}

const StatusAction = ({
  onApprove,
  onReject,
  dataTestId,
}: StatusActionProps) => {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-2">
      <Button
        color="primary"
        data-testid={dataTestId + '-approve-btn'}
        iconLeading={CheckCircle}
        size="xs"
        onClick={onApprove}>
        {t('label.approve')}
      </Button>
      <Button
        color="secondary-destructive"
        data-testid={dataTestId + '-reject-btn'}
        iconLeading={XCircle}
        size="xs"
        onClick={onReject}>
        {t('label.reject')}
      </Button>
    </div>
  );
};

export default StatusAction;
