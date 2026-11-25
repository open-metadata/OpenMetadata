/*
 *  Copyright 2022 Collate.
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
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  Box,
  SkeletonParagraph,
  Typography,
} from '@openmetadata/ui-core-components';

import { isEmpty, isUndefined } from 'lodash';
import { useTranslation } from 'react-i18next';
import { SummaryEntityType } from '../../../../enums/EntitySummary.enum';
import './summary-list.less';
import { SummaryListProps } from './SummaryList.interface';
import SummaryListItems from './SummaryListItems/SummaryListItems.component';

export default function SummaryList({
  formattedEntityData,
  entityType,
  emptyPlaceholderText,
  loading = false,
}: Readonly<SummaryListProps>) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <Box
        align="center"
        className="layout-row"
        data-testid="summary-list-loader"
        wrap="wrap">
        <SkeletonParagraph rows={1} />
      </Box>
    );
  }

  return (
    <ul className="tw:m-0 tw:list-none tw:p-0" data-testid="summary-list">
      {formattedEntityData.length ? (
        formattedEntityData.map((item) => (
          <li key={item.name}>
            {isEmpty(item.children) || isUndefined(item.children) ? (
              <SummaryListItems
                entityDetails={item}
                isColumnsData={entityType === SummaryEntityType.COLUMN}
                key={`${item.name}-summary-list-item`}
              />
            ) : (
              <Accordion
                allowsMultipleExpanded
                className="summary-list-collapse w-full"
                key={`${item.name}-collapse`}>
                <AccordionItem
                  data-testid={`${item.name}-collapse`}
                  id={String(`${item.name}-collapse-panel`)}
                  key={`${item.name}-collapse-panel`}>
                  <Box align="center" gap={2}>
                    <AccordionHeader
                      aria-label={t('label.entity-detail-plural', {
                        entity: item.name,
                      })}
                      className="tw:w-auto">
                      {null}
                    </AccordionHeader>
                    <Box className="tw:min-w-0 tw:flex-1">
                      <SummaryListItems
                        entityDetails={item}
                        isColumnsData={entityType === SummaryEntityType.COLUMN}
                      />
                    </Box>
                  </Box>
                  <AccordionPanel>
                    <SummaryList
                      entityType={entityType}
                      formattedEntityData={item.children}
                    />
                  </AccordionPanel>
                </AccordionItem>
              </Accordion>
            )}
          </li>
        ))
      ) : (
        <li>
          <div>
            <Typography className="no-data-chip-placeholder">
              {emptyPlaceholderText ?? t('message.no-data-available')}
            </Typography>
          </div>
        </li>
      )}
    </ul>
  );
}
