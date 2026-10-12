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

import { Card, Grid, Typography } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { FormCardSectionProps } from './FormCardSection.interface';

function FormCardSection({
  heading,
  subHeading,
  children,
  childrenContainerClassName = '',
  className = '',
}: Readonly<FormCardSectionProps>) {
  return (
    <Card
      className={className}
      data-testid={
        typeof heading === 'string' || typeof heading === 'number'
          ? `${heading}-container`
          : undefined
      }>
      <Card.Content>
        <Grid
          className="layout-row layout-grid tw:[--layout-gutter:var(--om-space-8)] tw:-mx-1"
          rowGap="2">
          <Grid.Item className="layout-column" span={24}>
            <Typography className="font-medium">{heading}</Typography>
          </Grid.Item>
          <Grid.Item className="layout-column" span={24}>
            <Typography className="text-xs" color="secondary">
              {subHeading}
            </Typography>
          </Grid.Item>
          <Grid.Item
            className={`layout-column ${classNames(
              'p-t-sm',
              childrenContainerClassName
            )}`}
            span={24}>
            {children}
          </Grid.Item>
        </Grid>
      </Card.Content>
    </Card>
  );
}

export default FormCardSection;
