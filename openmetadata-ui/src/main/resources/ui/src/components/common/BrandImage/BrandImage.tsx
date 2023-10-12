/*
 *  Copyright 2023 Collate.
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
import React, { FC } from 'react';
import MonoGram from '../../../assets/svg/logo-monogram.svg';
import Logo from '../../../assets/svg/logo.svg';
import { useApplicationConfigContext } from '../../../components/ApplicationConfigProvider/ApplicationConfigProvider';

interface BrandImageProps {
  dataTestId?: string;
  className?: string;
  alt?: string;
  width: number | string;
  height: number | string;
  isMonoGram?: boolean;
}

const BrandImage: FC<BrandImageProps> = ({
  dataTestId,
  alt,
  width,
  height,
  className,
  isMonoGram = false,
}) => {
  const { customLogoUrlPath = '', customMonogramUrlPath = '' } =
    useApplicationConfigContext();

  const logoSource = isMonoGram
    ? customMonogramUrlPath || MonoGram
    : customLogoUrlPath || Logo;

  return (
    <img
      alt={alt ?? 'OpenMetadata Logo'}
      className={className}
      data-testid={dataTestId ?? 'brand-logo-image'}
      height={height}
      id="brand-image"
      src={logoSource}
      width={width}
    />
  );
};

export default BrandImage;
