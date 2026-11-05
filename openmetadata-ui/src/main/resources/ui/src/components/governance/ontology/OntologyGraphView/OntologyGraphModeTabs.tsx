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
import { Tabs } from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';
import { GRAPH_MODES, OntologyGraphMode } from './OntologyGraphView.constants';

interface OntologyGraphModeTabsProps {
  readonly mode: OntologyGraphMode;
  readonly onChange: (mode: OntologyGraphMode) => void;
}

const OntologyGraphModeTabs = ({
  mode,
  onChange,
}: OntologyGraphModeTabsProps) => {
  const { t } = useTranslation();

  return (
    <Tabs
      className="tw:absolute tw:top-3.5 tw:right-4 tw:z-10 tw:w-auto"
      selectedKey={mode}
      onSelectionChange={(key) => {
        const next = GRAPH_MODES.find((item) => item === key);
        if (next) {
          onChange(next);
        }
      }}>
      <Tabs.List aria-label={t('label.mode')} size="sm" type="button-border">
        {GRAPH_MODES.map((item) => (
          <Tabs.Item
            data-testid={`ontology-graph-mode-${item}`}
            id={item}
            key={item}>
            {t(`label.${item}`)}
          </Tabs.Item>
        ))}
      </Tabs.List>
    </Tabs>
  );
};

export default OntologyGraphModeTabs;
