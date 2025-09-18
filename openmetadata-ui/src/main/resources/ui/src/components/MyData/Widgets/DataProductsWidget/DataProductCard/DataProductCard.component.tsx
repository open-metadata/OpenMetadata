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
import { Card, Typography } from 'antd';
import { toString } from 'lodash';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { EntityType } from '../../../../../enums/entity.enum';
import { DataProduct } from '../../../../../generated/entity/domains/dataProduct';
import { getDataProductIcon } from '../../../../../utils/DataProductUtils';
import { getEntityName } from '../../../../../utils/EntityUtils';
import { getEntityDetailsPath } from '../../../../../utils/RouterUtils';
import AppBadge from '../../../../common/Badge/Badge.component';
import '../data-products-widget.less';

interface DataProductCardProps {
  dataProduct: DataProduct;
}

const DataProductCard = ({ dataProduct }: DataProductCardProps) => {
  const redirectLink = useMemo(
    () =>
      getEntityDetailsPath(
        EntityType.DATA_PRODUCT,
        dataProduct.fullyQualifiedName as string
      ),
    [dataProduct?.fullyQualifiedName]
  );

  const displayName = useMemo(() => getEntityName(dataProduct), [dataProduct]);

  const dataProductIcon = useMemo(
    () => getDataProductIcon(dataProduct, 32),
    [dataProduct]
  );

  return (
    <Link
      className="no-underline"
      data-testid={`data-product-${dataProduct.name}`}
      to={redirectLink}>
      <Card className="service-card" data-testid="service-card" size="small">
        <div
          className="d-flex justify-center items-center"
          data-testid="data-product-icon">
          {dataProductIcon}
        </div>

        <Typography.Text
          className="m-t-sm text-sm text-grey-body font-medium truncate w-full d-inline-block"
          data-testid={`data-product-name-${dataProduct.name}`}
          title={displayName}>
          {displayName}
        </Typography.Text>

        <AppBadge
          className="data-product-badge m-t-sm"
          label={toString(dataProduct.assets?.length || 0)}
        />
      </Card>
    </Link>
  );
};

export default DataProductCard;
