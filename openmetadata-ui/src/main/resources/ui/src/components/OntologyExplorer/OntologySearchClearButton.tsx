/*
 *  Copyright 2024 Collate.
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
import { ButtonUtility } from '@openmetadata/ui-core-components';
import { XClose } from '@openmetadata/ui-core-components/icons';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';

interface OntologySearchClearButtonProps {
  readonly value: string;
  readonly onClear: () => void;
}

/**
 * Trailing slot for the ontology search inputs. Core Input drops `ref`, so the
 * input is found next to this slot to hand focus back once the button unmounts.
 */
const OntologySearchClearButton = ({
  value,
  onClear,
}: OntologySearchClearButtonProps) => {
  const { t } = useTranslation();
  const slotRef = useRef<HTMLSpanElement>(null);

  if (!value) {
    return null;
  }

  const handleClear = () => {
    slotRef.current?.parentElement?.querySelector('input')?.focus();
    onClear();
  };

  return (
    <span className="tw:mr-2 tw:flex" ref={slotRef}>
      <ButtonUtility
        data-testid="ontology-graph-search-clear"
        icon={XClose}
        size="xs"
        tooltip={t('label.clear')}
        onClick={handleClear}
      />
    </span>
  );
};

export default OntologySearchClearButton;
