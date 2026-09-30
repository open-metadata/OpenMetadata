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

import { Box } from '@openmetadata/ui-core-components';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../../constants/constants';
import { getContextMemoryById } from '../../../rest/contextMemoryAPI';

interface GlossaryTermSourceMemoriesProps {
  memoryIds: string[];
}

const GlossaryTermSourceMemories = ({
  memoryIds,
}: GlossaryTermSourceMemoriesProps) => {
  const { t } = useTranslation();
  const { data: memories = [] } = useQuery({
    queryKey: ['glossary-term-source-memories', memoryIds],
    queryFn: async () => {
      const results = await Promise.allSettled(
        memoryIds.map((id) => getContextMemoryById(id))
      );

      return results.flatMap((result) =>
        result.status === 'fulfilled' ? [result.value] : []
      );
    },
    enabled: memoryIds.length > 0,
  });

  if (memories.length === 0) {
    return null;
  }

  return (
    <Box
      className="tw:flex-wrap tw:px-6 tw:pb-3 tw:text-sm"
      data-testid="glossary-term-source-memories"
      direction="row"
      gap={2}>
      <span className="tw:text-tertiary">{t('label.derived-from')}:</span>
      {memories.map((memory) => (
        <Link
          className="tw:text-link tw:hover:underline"
          key={memory.id}
          to={`${ROUTES.CONTEXT_CENTER_MEMORIES}?memory=${encodeURIComponent(
            memory.name
          )}`}>
          {memory.title || memory.displayName || memory.name}
        </Link>
      ))}
    </Box>
  );
};

export default GlossaryTermSourceMemories;
