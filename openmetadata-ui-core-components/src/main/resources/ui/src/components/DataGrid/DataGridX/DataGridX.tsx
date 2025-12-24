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
import {
  Autocomplete,
  Box,
  Button,
  Menu,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { DataGrid, GridColumnVisibilityModel } from "@mui/x-data-grid";
import classNames from "classnames";
import { isEmpty } from "lodash";
import {
  forwardRef,
  Ref,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import DraggableMUIColumnItem from "./DraggableMUIColumnItem/DraggableMUIColumnItem.component";
import { MUITableProps } from "./DataGridX.interface";
import { GridColumnIcon } from "@mui/x-data-grid";
import { ColumnItem } from "./DraggableMUIColumnItem/DraggableMUIColumnItem.interface";

const MUITable = (
  {
    loading,
    searchProps,
    customPaginationProps,
    entityType,
    defaultVisibleColumns,
    containerClassName,
    resizableColumns = false,
    extraTableFilters,
    extraTableFiltersClassName,
    staticVisibleColumns,
    columns,
    rows,
    ...rest
  }: MUITableProps,
  ref: Ref<HTMLDivElement> | null | undefined
) => {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [dropdownColumnList, setDropdownColumnList] = useState<ColumnItem[]>(
    []
  );
  const [columnVisibilityModel, setColumnVisibilityModel] =
    useState<GridColumnVisibilityModel>({});

  const isLoading = useMemo(
    () => (typeof loading === "boolean" ? loading : false),
    [loading]
  );

  const entityKey = useMemo(() => entityType, [entityType]);

  const isCustomizeColumnEnable = useMemo(
    () => !isEmpty(staticVisibleColumns) && !isEmpty(defaultVisibleColumns),
    [staticVisibleColumns, defaultVisibleColumns]
  );

  const isDropdownVisible = Boolean(anchorEl);

  const selectedColumns = useMemo(() => {
    return Object.keys(columnVisibilityModel).filter(
      (key) => columnVisibilityModel[key]
    );
  }, [columnVisibilityModel]);

  const handleMoveItem = useCallback((updatedList: ColumnItem[]) => {
    setDropdownColumnList(updatedList);
  }, []);

  const handleColumnItemSelect = useCallback(
    (key: string, selected: boolean) => {
      const updatedModel = {
        ...columnVisibilityModel,
        [key]: selected,
      };

      setColumnVisibilityModel(updatedModel);

      const visibleColumns = Object.keys(updatedModel).filter(
        (colKey) => updatedModel[colKey]
      );

      // TODO:Update this to use prop based approach to avoid usePreference hook in component
      // updateColumnPreferences(visibleColumns);

      // setPreference({
      //   selectedEntityTableColumns: {
      //     ...selectedEntityTableColumns,
      //     [entityKey]: visibleColumns,
      //   },
      // });
    },
    [
      columnVisibilityModel,
      // selectedEntityTableColumns,
      entityKey,
    ]
  );

  const handleBulkColumnAction = useCallback(() => {
    const allColumnsVisible =
      dropdownColumnList.length === selectedColumns.length;

    const newModel: GridColumnVisibilityModel = {};
    dropdownColumnList.forEach((col) => {
      newModel[col.value] = !allColumnsVisible;
    });

    (staticVisibleColumns ?? []).forEach((col) => {
      newModel[col] = true;
    });

    setColumnVisibilityModel(newModel);

    const visibleColumns = Object.keys(newModel).filter(
      (colKey) => newModel[colKey]
    );

    // TODO:Update this to use prop based approach to avoid usePreference hook in component
    // setPreference({
    //   selectedEntityTableColumns: {
    //     ...selectedEntityTableColumns,
    //     [entityKey]: visibleColumns,
    //   },
    // });
  }, [
    dropdownColumnList,
    selectedColumns,
    // selectedEntityTableColumns,
    entityKey,
    staticVisibleColumns,
  ]);

  const handleDropdownOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleDropdownClose = () => {
    setAnchorEl(null);
  };

  useEffect(() => {
    // if (isCustomizeColumnEnable) {
    //   setDropdownColumnList(
    //     getCustomizeColumnDetails(columns, staticVisibleColumns)
    //   );
    // }
  }, [isCustomizeColumnEnable, columns, staticVisibleColumns]);

  useEffect(() => {
    // if (isCustomizeColumnEnable) {
    //   const savedColumns =
    //     selectedEntityTableColumns?.[entityKey] ?? defaultVisibleColumns ?? [];
    //   const visibilityModel: GridColumnVisibilityModel = {};
    //   (columns ?? []).forEach((col) => {
    //     const isStatic = (staticVisibleColumns ?? []).includes(col.field);
    //     const isSelected = savedColumns.includes(col.field);
    //     visibilityModel[col.field] = isStatic || isSelected;
    //   });
    //   setColumnVisibilityModel(visibilityModel);
    // } else {
    //   const allVisible: GridColumnVisibilityModel = {};
    //   (columns ?? []).forEach((col) => {
    //     allVisible[col.field] = true;
    //   });
    //   setColumnVisibilityModel(allVisible);
    // }
  }, [
    isCustomizeColumnEnable,
    // selectedEntityTableColumns,
    entityKey,
    defaultVisibleColumns,
    columns,
    staticVisibleColumns,
  ]);

  const processedColumns = useMemo(
    () =>
      resizableColumns
        ? (columns ?? []).map((col) => ({
            ...col,
            resizable: true,
          }))
        : columns ?? [],
    [columns, resizableColumns]
  );

  return (
    <Box
      className={classNames("mui-table-container", containerClassName)}
      ref={ref}
    >
      <Stack
        sx={{
          py:
            searchProps ?? extraTableFilters ?? isCustomizeColumnEnable ? 2 : 0,
          //   position: 'sticky',
          //   top: 0,
          backgroundColor: "background.paper",
          //   zIndex: 1,
        }}
      >
        <Stack direction="row" justifyContent="space-between" sx={{ px: 2 }}>
          {searchProps ? (
            <Box sx={{ flex: 1, maxWidth: "50%" }}>
              <Autocomplete {...searchProps} />
            </Box>
          ) : null}
          {(extraTableFilters || isCustomizeColumnEnable) && (
            <Stack
              className={classNames(extraTableFiltersClassName)}
              direction="row"
              spacing={1}
              sx={{ alignItems: "center", ml: "auto" }}
            >
              {extraTableFilters}
              {isCustomizeColumnEnable && (
                <>
                  <Button
                    data-testid="column-dropdown"
                    size="small"
                    startIcon={<GridColumnIcon />}
                    sx={{
                      textTransform: "none",
                      backgroundColor: "transparent",
                      "&:hover": {
                        backgroundColor: "transparent",
                      },
                    }}
                    title={t("label.show-or-hide-column-plural")}
                    onClick={handleDropdownOpen}
                  >
                    {t("label.customize")}
                  </Button>
                  <Menu
                    anchorEl={anchorEl}
                    open={isDropdownVisible}
                    sx={{ "& .MuiPaper-root": { width: 224 } }}
                    onClose={handleDropdownClose}
                  >
                    <Box
                      sx={{
                        px: 2,
                        pb: 1,
                        borderBottom: 1,
                        borderColor: "divider",
                      }}
                    >
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        sx={{ alignItems: "center" }}
                      >
                        <Typography
                          data-testid="column-dropdown-title"
                          sx={{
                            fontSize: "0.875rem",
                            color: "text.secondary",
                            fontWeight: 500,
                          }}
                        >
                          {t("label.column")}
                        </Typography>
                        <Button
                          data-testid="column-dropdown-action-button"
                          size="small"
                          sx={{
                            textTransform: "none",
                            fontSize: "0.875rem",
                            p: 0,
                            minWidth: "auto",
                          }}
                          onClick={handleBulkColumnAction}
                        >
                          {dropdownColumnList.length === selectedColumns.length
                            ? t("label.hide-all")
                            : t("label.view-all")}
                        </Button>
                      </Stack>
                    </Box>
                    <Box>
                      {dropdownColumnList.map(
                        (item: ColumnItem, index: number) => (
                          <DraggableMUIColumnItem
                            currentItem={item}
                            index={index}
                            itemList={dropdownColumnList}
                            key={item.value}
                            selectedOptions={selectedColumns}
                            onMoveItem={handleMoveItem}
                            onSelect={handleColumnItemSelect}
                          />
                        )
                      )}
                    </Box>
                  </Menu>
                </>
              )}
            </Stack>
          )}
        </Stack>
      </Stack>

      <Box sx={{ width: "100%", flex: 1, height: 400 }}>
        <DataGrid
          {...rest}
          columnVisibilityModel={columnVisibilityModel}
          columns={processedColumns}
          loading={isLoading}
          rows={rows}
          slots={rest.slots}
          sx={{
            border: "none",
            "& .MuiDataGrid-cell:focus": {
              outline: "none",
            },
            "& .MuiDataGrid-cell:focus-within": {
              outline: "none",
            },
            ...rest.sx,
          }}
          onColumnVisibilityModelChange={(newModel) => {
            setColumnVisibilityModel(newModel);
          }}
        />
      </Box>
      {/* {customPaginationProps && customPaginationProps.showPagination ? (
        <Box
          sx={{
            width: "100%",
            position: "sticky",
            bottom: 0,
            backgroundColor: "background.paper",
            zIndex: 1,
            borderTop: 1,
            borderColor: "divider",
          }}
        >
          <NextPrevious {...customPaginationProps} />
        </Box>
      ) : null} */}
    </Box>
  );
};

export default forwardRef<HTMLDivElement, MUITableProps>(MUITable);
