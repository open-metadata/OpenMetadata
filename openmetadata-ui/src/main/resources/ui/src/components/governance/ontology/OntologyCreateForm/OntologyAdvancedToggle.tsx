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
import { Typography } from '@openmetadata/ui-core-components';
import {
  ChevronDown,
  ChevronRight,
} from '@openmetadata/ui-core-components/icons';
import { useTranslation } from 'react-i18next';

interface OntologyAdvancedToggleProps {
  readonly controls: string;
  readonly isOpen: boolean;
  readonly testId: string;
  readonly onToggle: () => void;
}

/** The "› Advanced  ID, IRI, namespace, layer" disclosure shared by the create and settings dialogs. */
const OntologyAdvancedToggle = ({
  controls,
  isOpen,
  testId,
  onToggle,
}: OntologyAdvancedToggleProps) => {
  const { t } = useTranslation();
  const Icon = isOpen ? ChevronDown : ChevronRight;

  return (
    <button
      aria-controls={controls}
      aria-expanded={isOpen}
      className="tw:flex tw:w-full tw:cursor-pointer tw:items-center tw:gap-2 tw:border-t tw:border-secondary tw:bg-transparent tw:pt-4 tw:text-left tw:outline-focus-ring tw:focus-visible:outline-2"
      data-testid={testId}
      type="button"
      onClick={onToggle}>
      <Icon aria-hidden className="tw:size-4 tw:shrink-0 tw:text-secondary" />
      <Typography size="text-sm" weight="medium">
        {t('label.advanced')}
      </Typography>
      <Typography color="quaternary" size="text-sm">
        {t('message.ontology-advanced-fields')}
      </Typography>
    </button>
  );
};

export default OntologyAdvancedToggle;
