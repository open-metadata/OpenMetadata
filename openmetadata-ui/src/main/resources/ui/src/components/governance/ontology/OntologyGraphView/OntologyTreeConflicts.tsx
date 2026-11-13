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

import { Box, Button, Typography } from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';

/**
 * Tree conflicts sit on the concept rows themselves (red dot + message), as in the
 * design. This strip only covers a validation run that failed, so the user can retry.
 */
const OntologyTreeConflicts = ({
  onRetry,
}: {
  readonly onRetry: () => void;
}) => {
  const { t } = useTranslation();

  return (
    <Box
      align="center"
      className="tw:min-h-14 tw:px-4"
      data-testid="ontology-tree-conflicts"
      gap={3}>
      <Typography className="tw:flex-1" color="danger" size="text-sm">
        {t('message.ontology-conflicts-check-failed')}
      </Typography>
      <Button color="link-color" size="sm" onPress={onRetry}>
        {t('label.retry')}
      </Button>
    </Box>
  );
};

export default OntologyTreeConflicts;
