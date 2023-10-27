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

import { Image } from 'antd';
import React, { useEffect, useMemo, useState } from 'react';
import ProfilePicture from '../../../../components/common/ProfilePicture/ProfilePicture';
import {
  getImageWithResolutionAndFallback,
  ImageQuality,
} from '../../../../utils/ProfilerUtils';
import { UserProfileImageProps } from './UserProfileImage.interface';

const UserProfileImage = ({ userData }: UserProfileImageProps) => {
  const [isImgUrlValid, SetIsImgUrlValid] = useState<boolean>(true);

  const image = useMemo(
    () =>
      getImageWithResolutionAndFallback(ImageQuality['6x'], userData?.images),
    [userData?.images]
  );

  useEffect(() => {
    if (image) {
      SetIsImgUrlValid(true);
    }
  }, [image]);

  return (
    <div className="profile-image-container">
      {isImgUrlValid ? (
        <Image
          alt="profile"
          preview={false}
          referrerPolicy="no-referrer"
          src={image ?? ''}
          onError={() => {
            SetIsImgUrlValid(false);
          }}
        />
      ) : (
        <ProfilePicture
          displayName={userData?.displayName ?? userData.name}
          height="54"
          id={userData?.id ?? ''}
          name={userData?.name ?? ''}
          textClass="text-xl"
          width="54"
        />
      )}
    </div>
  );
};

export default UserProfileImage;
