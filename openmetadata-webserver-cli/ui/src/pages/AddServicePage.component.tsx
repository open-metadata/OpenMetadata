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

import { startCase } from "lodash";
import { ServiceTypes } from "Models";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { TitleBreadcrumbProps } from "../components/common/TitleBreadcrumb/TitleBreadcrumb.interface";
import AddService from "../components/Settings/Services/AddService/AddService.component";
import { GlobalSettingsMenuCategory } from "../constants/GlobalSettings.constants";
import { ServiceCategory } from "../enums/service.enum";
import { DataObj } from "../interface/service.interface";
import { getSettingPath } from "../utils/RouterUtils";
import { getServiceRouteFromServiceType } from "../utils/ServiceUtils";

const AddServicePage = () => {
  const { t } = useTranslation();
  const { serviceCategory } = useParams<{ serviceCategory: string }>();

  const [slashedBreadcrumb, setSlashedBreadcrumb] = useState<
    TitleBreadcrumbProps["titleLinks"]
  >([]);
  const [addIngestion, setAddIngestion] = useState(false);

  const handleAddIngestion = (value: boolean) => {
    setAddIngestion(value);
  };

  useEffect(() => {
    setSlashedBreadcrumb([
      {
        name: startCase(serviceCategory),
        url: getSettingPath(
          GlobalSettingsMenuCategory.SERVICES,
          getServiceRouteFromServiceType(serviceCategory as ServiceTypes)
        ),
      },
      {
        name: t("label.add-new-entity", {
          entity: t(addIngestion ? "label.ingestion" : "label.service"),
        }),
        url: "",
        activeTitle: true,
      },
    ]);
  }, [serviceCategory, addIngestion, t]);

  const newServiceData: DataObj = {
    name: "service something",
    description: "yada",
    serviceType: "database",
  };

  return (
    <AddService
      addIngestion={addIngestion}
      handleAddIngestion={handleAddIngestion}
      ingestionAction={""}
      ingestionProgress={0}
      isIngestionCreated={false}
      isIngestionDeployed={false}
      newServiceData={newServiceData}
      serviceCategory={serviceCategory as ServiceCategory}
      showDeployButton={false}
      slashedBreadcrumb={slashedBreadcrumb}
      onAddIngestionSave={() => Promise.resolve()}
      onAddServiceSave={() => Promise.resolve()}
      onIngestionDeploy={() => Promise.resolve()}
    />
  );
};

export default AddServicePage;
