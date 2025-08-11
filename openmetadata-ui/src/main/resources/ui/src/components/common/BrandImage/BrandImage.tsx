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
import { FC, useMemo } from 'react';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import brandClassBase from '../../../utils/BrandData/BrandClassBase';

interface BrandImageProps {
  dataTestId?: string;
  className?: string;
  alt?: string;
  width: number | string;
  height: number | string;
  isMonoGram?: boolean;
  src?: string;
}

const BrandImage: FC<BrandImageProps> = ({
  dataTestId,
  alt,
  width,
  height,
  className,
  src,
  isMonoGram = false,
}) => {
  const { applicationConfig } = useApplicationStore();

  const { defaultLogo, logoSource } = useMemo(() => {
    const { customLogoUrlPath = '', customMonogramUrlPath = '' } =
      applicationConfig?.customLogoConfig ?? {};
    const monoGram = brandClassBase.getMonogram().src;
    const logo = brandClassBase.getLogo().src;

    const defaultLogo = isMonoGram ? monoGram : logo;
    const logoSource = isMonoGram
      ? customMonogramUrlPath || monoGram
      : customLogoUrlPath || logo;

    return { defaultLogo, logoSource };
  }, [isMonoGram, applicationConfig?.customLogoConfig]);

  return (
    <img
      alt={alt ?? 'OpenMetadata Logo'}
      className={className}
      data-testid={dataTestId ?? 'brand-logo-image'}
      height={height}
      id="brand-image"
      src={src ?? logoSource}
      width={width}
      onError={(e) => {
        e.currentTarget.src = defaultLogo;
      }}
    />
  );
};

export default BrandImage;
