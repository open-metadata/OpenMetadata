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

import { Button, useTheme } from '@mui/material';
import classNames from 'classnames';
import {
  FC,
  memo,
  MouseEventHandler,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as FilterLinesIcon } from '../../../assets/svg/ic-filter-lines.svg';
import { LINEAGE_DROPDOWN_ITEMS } from '../../../constants/AdvancedSearch.constants';
import { useLineageProvider } from '../../../context/LineageProvider/LineageProvider';
import { SearchIndex } from '../../../enums/search.enum';
import { ExploreQuickFilterField } from '../../Explore/ExplorePage.interface';
import ExploreQuickFilters from '../../Explore/ExploreQuickFilters';
import { StyledIconButton } from '../../LineageTable/LineageTable.styled';
import LineageSearchSelect from './LineageSearchSelect/LineageSearchSelect';

const CustomControls: FC = () => {
  const { t } = useTranslation();
  const { setSelectedQuickFilters, nodes, selectedQuickFilters } =
    useLineageProvider();
  const [filterSelectionActive, setFilterSelectionActive] = useState(false);

  //   const [filters, setFilters] = useState<ExploreQuickFilterField[]>([]);
  const navigate = useNavigate();
  const theme = useTheme();

  const queryFilter = useMemo(() => {
    const nodeIds = (nodes ?? [])
      .map((node) => node.data?.node?.id)
      .filter(Boolean);

    return {
      query: {
        bool: {
          must: {
            terms: {
              'id.keyword': nodeIds,
            },
          },
        },
      },
    };
  }, [nodes]);

  const handleQuickFiltersValueSelect = useCallback(
    (field: ExploreQuickFilterField) => {
      setSelectedQuickFilters((pre) => {
        const data = pre.map((preField) => {
          if (preField.key === field.key) {
            return field;
          } else {
            return preField;
          }
        });

        return data;
      });
    },
    [setSelectedQuickFilters]
  );

  // Initialize quick filters on component mount
  useEffect(() => {
    const updatedQuickFilters = LINEAGE_DROPDOWN_ITEMS.map(
      (selectedFilterItem) => {
        const originalFilterItem = selectedQuickFilters?.find(
          (filter) => filter.key === selectedFilterItem.key
        );

        return {
          ...(originalFilterItem || selectedFilterItem),
          value: originalFilterItem?.value || [],
        };
      }
    );

    if (updatedQuickFilters.length > 0) {
      setSelectedQuickFilters(updatedQuickFilters);
    }
  }, []);

  const handleImpactAnalysisClick = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    params.set('mode', 'impact_analysis');
    navigate({ search: params.toString() });
  }, [navigate]);

  const toggleFilterSelection: MouseEventHandler<HTMLButtonElement> = () => {
    setFilterSelectionActive((prev) => !prev);
  };

  const handleClearAllFilters = useCallback(() => {
    setSelectedQuickFilters((prev) =>
      (prev ?? []).map((filter) => ({ ...filter, value: [] }))
    );
  }, [setSelectedQuickFilters]);

  return (
    <div>
      <div className={classNames('d-flex w-full justify-between')}>
        <div className="d-flex items-center gap-4">
          <StyledIconButton
            color={filterSelectionActive ? 'primary' : 'default'}
            size="large"
            title={t('label.filter-plural')}
            onClick={toggleFilterSelection}>
            <FilterLinesIcon />
          </StyledIconButton>
          <LineageSearchSelect />
        </div>
        <div className="d-flex gap-4 items-center">
          <Button
            className="font-semibold"
            sx={{
              outlineColor: theme.palette.allShades.blue[700],
              backgroundColor: theme.palette.allShades.blue[50],
              color: theme.palette.allShades.blue[700],
              outline: '1px solid',
              boxShadow: 'none',

              '&:hover': {
                outlineColor: theme.palette.allShades.blue[100],
                backgroundColor: theme.palette.allShades.blue[100],
                color: theme.palette.allShades.blue[700],
                boxShadow: 'none',
              },
            }}
            variant="outlined">
            {t('label.lineage')}
          </Button>
          <Button
            className="font-semibold"
            variant="outlined"
            onClick={handleImpactAnalysisClick}>
            {t('label.impact-analysis')}
          </Button>
        </div>
      </div>
      {filterSelectionActive && (
        <div className="m-t-sm d-flex justify-between items-center">
          <ExploreQuickFilters
            independent
            aggregations={{}}
            defaultQueryFilter={queryFilter}
            fields={selectedQuickFilters ?? []}
            index={SearchIndex.ALL}
            showDeleted={false}
            onFieldValueSelect={handleQuickFiltersValueSelect}
          />
          <Button
            size="small"
            sx={{
              fontWeight: 500,
              color: theme.palette.primary.main,
            }}
            variant="text"
            onClick={handleClearAllFilters}>
            {t('label.clear-entity', { entity: t('label.all') })}
          </Button>
        </div>
      )}
    </div>
  );
};

export default memo(CustomControls);
