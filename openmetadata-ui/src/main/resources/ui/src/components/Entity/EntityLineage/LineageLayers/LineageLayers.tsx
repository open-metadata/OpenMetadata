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
import {
  Popover,
  styled,
  ToggleButton,
  ToggleButtonGroup,
  ToggleButtonProps,
} from '@mui/material';
import classNames from 'classnames';
import { isEmpty, xor } from 'lodash';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as DataQualityIcon } from '../../../../assets/svg/ic-data-contract.svg';
import { ReactComponent as DataProductIcon } from '../../../../assets/svg/ic-data-product.svg';
import { ReactComponent as DomainIcon } from '../../../../assets/svg/ic-domain.svg';
import { ReactComponent as Layers } from '../../../../assets/svg/ic-layers.svg';
import { ReactComponent as ServiceView } from '../../../../assets/svg/services.svg';
import { SERVICE_TYPES } from '../../../../constants/Services.constant';
import { useLineageProvider } from '../../../../context/LineageProvider/LineageProvider';
import { LineagePlatformView } from '../../../../context/LineageProvider/LineageProvider.interface';
import { EntityType } from '../../../../enums/entity.enum';
import { Table } from '../../../../generated/entity/data/table';
import { LineageLayer } from '../../../../generated/settings/settings';
import searchClassBase from '../../../../utils/SearchClassBase';
import { AssetsUnion } from '../../../DataAssets/AssetsSelectionModal/AssetSelectionModal.interface';
import './lineage-layers.less';
import { LineageLayersProps } from './LineageLayers.interface';

const StyledButton = styled((props: ToggleButtonProps) => (
  <ToggleButton {...props} />
))(({ theme }) => ({
  display: 'inline-flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '4px',
  backgroundColor: theme.palette.allShades.white,
  fontSize: theme.typography.pxToRem(10),
  color: theme.palette.text.primary,
  wordBreak: 'break-word',
  padding: '8px 16px',

  svg: {
    height: 20,
  },

  '&:hover': {
    border: '1px solid',
    borderColor: theme.palette.primary.main + ' !important',
    // To show all the border on hover
    zIndex: 1,
    margin: '0',
    backgroundColor: theme.palette.allShades.white,

    svg: {
      color: theme.palette.primary.main,
    },
  },

  '&.Mui-selected': {
    backgroundColor: theme.palette.allShades.brand[100],

    '&:hover': {
      border: '1px solid' + ' ' + theme.palette.primary.main,
      backgroundColor: theme.palette.allShades.brand[100],
    },
  },

  '&.highlight': {
    border: '1px solid',
    borderColor: theme.palette.primary.main + ' !important',
    // To show all the border on hover
    zIndex: 1,
    margin: '0',
    backgroundColor: theme.palette.allShades.white,

    svg: {
      color: theme.palette.primary.main,
    },
  },
}));

const LineageLayers = ({ entityType, entity }: LineageLayersProps) => {
  const {
    activeLayer,
    onUpdateLayerView,
    onPlatformViewChange,
    platformView,
    isPlatformLineage,
  } = useLineageProvider();
  const { t } = useTranslation();
  const [layersAnchorEl, setLayersAnchorEl] =
    React.useState<null | HTMLElement>(null);
  const selectedValues = [...activeLayer, platformView];

  const handleLayerClick = React.useCallback(
    (
      _event: React.MouseEvent<HTMLElement, MouseEvent>,
      layer: LineageLayer
    ) => {
      const value = layer;
      const index = activeLayer.indexOf(value);
      if (index === -1) {
        onUpdateLayerView([...activeLayer, value]);
      } else {
        onUpdateLayerView(activeLayer.filter((layer) => layer !== value));
      }
    },
    [activeLayer, onUpdateLayerView]
  );

  const handlePlatformViewChange = React.useCallback(
    (
      _event: React.MouseEvent<HTMLElement, MouseEvent>,
      view: string | null
    ) => {
      onPlatformViewChange(
        platformView === view
          ? LineagePlatformView.None
          : (view as LineagePlatformView)
      );
    },
    [platformView, onPlatformViewChange]
  );

  const handleSelection = (
    _event: React.MouseEvent<HTMLElement, MouseEvent>,
    newSelection: (LineageLayer | LineagePlatformView)[]
  ) => {
    const newlyAddedValue = xor(selectedValues, newSelection);

    if (
      Object.values(LineagePlatformView).includes(
        newlyAddedValue[0] as LineagePlatformView
      )
    ) {
      handlePlatformViewChange(_event, newlyAddedValue[0]);
    } else {
      handleLayerClick(_event, newlyAddedValue[0] as LineageLayer);
    }
  };

  const isServiceType = SERVICE_TYPES.includes(entityType as AssetsUnion);
  const showColumnAndObservability = entityType && !isServiceType;
  const showService = isPlatformLineage || !isServiceType;
  const showDomain =
    isPlatformLineage ||
    (entityType &&
      entityType !== EntityType.DOMAIN &&
      !isEmpty(entity?.domains));
  const showDataProduct =
    isPlatformLineage ||
    (entityType &&
      entityType !== EntityType.DOMAIN &&
      ((entity as Table)?.dataProducts ?? []).length > 0);

  const buttonContent = React.useMemo(() => {
    const buttons = [];

    if (showColumnAndObservability) {
      buttons.push([
        <StyledButton
          data-testid="lineage-layer-column-btn"
          key={LineageLayer.ColumnLevelLineage}
          value={LineageLayer.ColumnLevelLineage}>
          {searchClassBase.getEntityIcon(EntityType.TABLE)}
          {t('label.column')}
        </StyledButton>,
        <StyledButton
          data-testid="lineage-layer-observability-btn"
          key={LineageLayer.DataObservability}
          value={LineageLayer.DataObservability}>
          <DataQualityIcon />
          {t('label.observability')}
        </StyledButton>,
      ]);
    }

    if (showService) {
      buttons.push(
        <StyledButton
          data-testid="lineage-layer-service-btn"
          key={LineagePlatformView.Service}
          value={LineagePlatformView.Service}>
          <ServiceView />
          {t('label.service')}
        </StyledButton>
      );
    }

    if (showDomain) {
      buttons.push(
        <StyledButton
          data-testid="lineage-layer-domain-btn"
          key={LineagePlatformView.Domain}
          value={LineagePlatformView.Domain}>
          <DomainIcon />
          {t('label.domain')}
        </StyledButton>
      );
    }

    if (showDataProduct) {
      buttons.push(
        <StyledButton
          data-testid="lineage-layer-data-product-btn"
          key={LineagePlatformView.DataProduct}
          value={LineagePlatformView.DataProduct}>
          <DataProductIcon />
          {t('label.data-product')}
        </StyledButton>
      );
    }

    return (
      <ToggleButtonGroup value={selectedValues} onChange={handleSelection}>
        {buttons}
      </ToggleButtonGroup>
    );
  }, [
    selectedValues,
    activeLayer,
    platformView,
    handleSelection,
    showColumnAndObservability,
    showService,
    showDomain,
    showDataProduct,
  ]);

  return (
    <>
      <StyledButton
        className={classNames({
          highlight: Boolean(layersAnchorEl),
        })}
        data-testid="lineage-layer-btn"
        value=""
        onClick={(e) => setLayersAnchorEl(e.currentTarget)}>
        <Layers width={20} />

        {t('label.layer-plural')}
      </StyledButton>
      <Popover
        anchorEl={layersAnchorEl}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        className="lineage-layers-popover"
        id="lineage-layers-popover"
        open={Boolean(layersAnchorEl)}
        sx={{ marginLeft: '16px' }} // Moves popover right by 80px
        onClose={() => setLayersAnchorEl(null)}>
        {buttonContent}
      </Popover>
    </>
  );
};

export default React.memo(LineageLayers);
