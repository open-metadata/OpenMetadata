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
import { ReactComponent as DropdownIcon } from '../../../../assets/svg/drop-down.svg';
import { ReactComponent as CheckIcon } from '../../../../assets/svg/ic-check.svg';
import { ReactComponent as DataQualityIcon } from '../../../../assets/svg/ic-data-contract.svg';
import { ReactComponent as DataProductIcon } from '../../../../assets/svg/ic-data-product.svg';
import { ReactComponent as DomainIcon } from '../../../../assets/svg/ic-domain.svg';
import { ReactComponent as Layers } from '../../../../assets/svg/ic-layers.svg';
import { ReactComponent as TableIcon } from '../../../../assets/svg/ic-table.svg';
import { ReactComponent as ServiceView } from '../../../../assets/svg/services.svg';
import { SERVICE_TYPES } from '../../../../constants/Services.constant';
import { LineagePlatformView } from '../../../../context/LineageProvider/LineageProvider.interface';
import { EntityType } from '../../../../enums/entity.enum';
import {
  LineageBand,
  LineageLens,
} from '../../../../generated/api/lineage/lineageScene';
import { Table } from '../../../../generated/entity/data/table';
import { LineageLayer } from '../../../../generated/settings/settings';
import { useLineageStore } from '../../../../hooks/useLineageStore';
import { AssetsUnion } from '../../../DataAssets/AssetsSelectionModal/AssetSelectionModal.interface';
import './lineage-layers.less';
import { LineageLayersProps } from './LineageLayers.interface';

const getSceneLensLabelKey = (lens: LineageLens) => {
  switch (lens) {
    case LineageLens.Domain:
      return 'label.domain';
    case LineageLens.DataProduct:
      return 'label.data-product';
    default:
      return 'label.service-level-view';
  }
};

const getSceneLensDescriptionKey = (lens: LineageLens) => {
  switch (lens) {
    case LineageLens.Domain:
      return 'message.lineage-map-domain-lens-description';
    case LineageLens.DataProduct:
      return 'message.lineage-map-data-product-lens-description';
    default:
      return 'message.lineage-map-service-lens-description';
  }
};

const getSceneBandLabelKey = (band: LineageBand) => {
  switch (band) {
    case LineageBand.Layer:
      return 'label.lineage-map-layer-view';
    case LineageBand.Field:
      return 'label.field-level-lineage';
    default:
      return 'label.data-asset-plural';
  }
};

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

const LineageLayers = ({
  entityType,
  entity,
  sceneBand,
  sceneLens,
  sceneLevelLabelKey,
  onSceneBandChange,
  onSceneLensChange,
}: LineageLayersProps) => {
  const {
    activeLayer,
    platformView,
    setPlatformView,
    isPlatformLineage,
    setActiveLayer,
  } = useLineageStore();
  const { t } = useTranslation();
  const [layersAnchorEl, setLayersAnchorEl] =
    React.useState<null | HTMLElement>(null);
  const hasSceneControls = Boolean(
    sceneBand && sceneLens && onSceneBandChange && onSceneLensChange
  );
  const legacySelectedValues = React.useMemo(
    () => [...activeLayer, platformView],
    [activeLayer, platformView]
  );

  const handleLayerClick = React.useCallback(
    (
      _event: React.MouseEvent<HTMLElement, MouseEvent>,
      layer: LineageLayer
    ) => {
      const value = layer;
      const index = activeLayer.indexOf(value);
      if (index === -1) {
        setActiveLayer([...activeLayer, value]);
      } else {
        setActiveLayer(activeLayer.filter((layer) => layer !== value));
      }
    },
    [activeLayer, setActiveLayer]
  );

  const handlePlatformViewChange = React.useCallback(
    (
      _event: React.MouseEvent<HTMLElement, MouseEvent>,
      view: string | null
    ) => {
      setPlatformView(
        platformView === view
          ? LineagePlatformView.None
          : (view as LineagePlatformView)
      );
    },
    [platformView, setPlatformView]
  );

  const handleSelection = (
    _event: React.MouseEvent<HTMLElement, MouseEvent>,
    newSelection: (LineageLayer | LineagePlatformView)[]
  ) => {
    const newlyAddedValue = xor(legacySelectedValues, newSelection);

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

  const handleSceneLensChange = React.useCallback(
    (
      _event: React.MouseEvent<HTMLElement, MouseEvent>,
      lens: LineageLens | null
    ) => {
      if (!lens || !onSceneLensChange) {
        return;
      }
      onSceneLensChange(lens);
      setLayersAnchorEl(null);
    },
    [onSceneLensChange]
  );

  const handleSceneBandChange = React.useCallback(
    (
      _event: React.MouseEvent<HTMLElement, MouseEvent>,
      band: LineageBand | null
    ) => {
      if (!band || !onSceneBandChange) {
        return;
      }
      onSceneBandChange(band);
      setLayersAnchorEl(null);
    },
    [onSceneBandChange]
  );

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
    if (hasSceneControls && sceneLens && onSceneLensChange) {
      const sceneLensOptions = [
        LineageLens.Service,
        LineageLens.Domain,
        LineageLens.DataProduct,
      ];
      const sceneBandOptions = [
        LineageBand.Layer,
        LineageBand.Asset,
        LineageBand.Field,
      ];

      return (
        <div className="lineage-scene-layer-menu">
          <div className="lineage-scene-layer-menu-section">
            <span className="lineage-scene-layer-menu-title">
              {t('label.lineage-layer')}
            </span>
            <ToggleButtonGroup
              exclusive
              className="lineage-scene-layer-menu-options"
              value={sceneLens}
              onChange={handleSceneLensChange}>
              {sceneLensOptions.map((lens) => (
                <StyledButton
                  className="lineage-scene-layer-menu-option"
                  data-testid={`lineage-layer-lens-${lens}`}
                  key={lens}
                  value={lens}>
                  {lens === LineageLens.Domain ? (
                    <DomainIcon />
                  ) : lens === LineageLens.DataProduct ? (
                    <DataProductIcon />
                  ) : (
                    <ServiceView />
                  )}
                  <span className="lineage-scene-layer-menu-copy">
                    <span className="lineage-scene-layer-menu-option-title">
                      {t(getSceneLensLabelKey(lens))}
                    </span>
                    <span className="lineage-scene-layer-menu-option-description">
                      {t(getSceneLensDescriptionKey(lens))}
                    </span>
                  </span>
                  {sceneLens === lens && (
                    <CheckIcon className="lineage-scene-layer-menu-check" />
                  )}
                </StyledButton>
              ))}
            </ToggleButtonGroup>
          </div>

          {sceneBand && onSceneBandChange && (
            <div className="lineage-scene-layer-menu-section">
              <span className="lineage-scene-layer-menu-title">
                {t('label.level')}
              </span>
              <ToggleButtonGroup
                exclusive
                className="lineage-scene-layer-menu-options"
                value={sceneBand}
                onChange={handleSceneBandChange}>
                {sceneBandOptions.map((band) => (
                  <StyledButton
                    className="lineage-scene-layer-menu-option"
                    data-testid={`lineage-layer-band-${band}`}
                    key={band}
                    value={band}>
                    {band === LineageBand.Layer ? <Layers /> : <TableIcon />}
                    <span className="lineage-scene-layer-menu-copy">
                      <span className="lineage-scene-layer-menu-option-title">
                        {t(getSceneBandLabelKey(band))}
                      </span>
                    </span>
                    {sceneBand === band && (
                      <CheckIcon className="lineage-scene-layer-menu-check" />
                    )}
                  </StyledButton>
                ))}
              </ToggleButtonGroup>
            </div>
          )}
        </div>
      );
    }

    const buttons = [];

    if (showColumnAndObservability) {
      buttons.push([
        <StyledButton
          data-testid="lineage-layer-column-btn"
          key={LineageLayer.ColumnLevelLineage}
          value={LineageLayer.ColumnLevelLineage}>
          <TableIcon />
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
      <ToggleButtonGroup
        value={legacySelectedValues}
        onChange={handleSelection}>
        {buttons}
      </ToggleButtonGroup>
    );
  }, [
    legacySelectedValues,
    activeLayer,
    platformView,
    handleSelection,
    showColumnAndObservability,
    showService,
    showDomain,
    showDataProduct,
    hasSceneControls,
    sceneBand,
    sceneLens,
    handleSceneBandChange,
    handleSceneLensChange,
    onSceneBandChange,
    onSceneLensChange,
  ]);

  const triggerContent = React.useMemo(() => {
    if (hasSceneControls && sceneLens) {
      return (
        <>
          <Layers width={20} />
          <span className="lineage-scene-layer-trigger-label">
            <span className="lineage-scene-layer-trigger-eyebrow">
              {t('label.layer-plural')}
            </span>
            <span className="lineage-scene-layer-trigger-value">
              {t(sceneLevelLabelKey ?? getSceneLensLabelKey(sceneLens))}
            </span>
          </span>
          <DropdownIcon className="lineage-scene-layer-trigger-caret" />
        </>
      );
    }

    return (
      <>
        <Layers width={20} />

        {t('label.layer-plural')}
      </>
    );
  }, [hasSceneControls, sceneLens, sceneLevelLabelKey, t]);

  return (
    <>
      <StyledButton
        className={classNames({
          highlight: Boolean(layersAnchorEl),
          'lineage-scene-layer-trigger': hasSceneControls,
        })}
        data-testid="lineage-layer-btn"
        value=""
        onClick={(e) => setLayersAnchorEl(e.currentTarget)}>
        {triggerContent}
      </StyledButton>
      <Popover
        anchorEl={layersAnchorEl}
        anchorOrigin={{
          vertical: 'top',
          horizontal: hasSceneControls ? 'left' : 'right',
        }}
        className="lineage-layers-popover"
        id="lineage-layers-popover"
        open={Boolean(layersAnchorEl)}
        sx={hasSceneControls ? undefined : { marginLeft: '16px' }}
        transformOrigin={
          hasSceneControls
            ? {
                vertical: 'bottom',
                horizontal: 'left',
              }
            : undefined
        }
        onClose={() => setLayersAnchorEl(null)}>
        {buttonContent}
      </Popover>
    </>
  );
};

export default React.memo(LineageLayers);
