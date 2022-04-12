// import { isEqual } from 'lodash';
import { ServicesData } from 'Models';
import React, { useState } from 'react';
import {
  // DashboardServiceType,
  // MessagingServiceType,
  ServiceCategory,
} from '../../enums/service.enum';
import { DashboardService } from '../../generated/entity/services/dashboardService';
import { DatabaseService } from '../../generated/entity/services/databaseService';
import { MessagingService } from '../../generated/entity/services/messagingService';
import { PipelineService } from '../../generated/entity/services/pipelineService';
// import useToastContext from '../../hooks/useToastContext';
// import {
//   getHostPortDetails,
//   getKeyValueObject,
//   getKeyValuePair,
// } from '../../utils/ServiceUtils';
import ConnectionConfigForm from './ConnectionConfigForm';
// import DashboardConfigs from './DashboardConfigs';
// import DatabaseConfigs from './DatabaseConfigs';
// import MessagingConfigs from './MessagingConfigs';
// import PipelineConfigs from './PipelineConfigs';

interface ServiceConfigProps {
  serviceCategory: ServiceCategory;
  data?: ServicesData;
  handleUpdate: (
    data: ServicesData,
    serviceCategory: ServiceCategory
  ) => Promise<void>;
}

// type ErrorMsg = {
//   selectService: boolean;
//   name: boolean;
//   host?: boolean;
//   port?: boolean;
//   driverClass?: boolean;
//   broker?: boolean;
//   dashboardUrl?: boolean;
//   username?: boolean;
//   password?: boolean;
//   apiKey?: boolean;
//   siteName?: boolean;
//   apiVersion?: boolean;
//   server?: boolean;
//   pipelineUrl?: boolean;
// };

// type DynamicFormFieldType = {
//   key: string;
//   value: string;
// };

export const Field = ({ children }: { children: React.ReactNode }) => {
  return <div className="tw-mt-4">{children}</div>;
};

const ServiceConfig = ({
  serviceCategory,
  data,
  handleUpdate,
}: ServiceConfigProps) => {
  // const showToast = useToastContext();
  // const [, setLoading] = useState<boolean>(false);
  const [status] = useState<'initial' | 'waiting' | 'success'>('initial');
  // const [showErrorMsg, setShowErrorMsg] = useState<ErrorMsg>({
  //   selectService: false,
  //   name: false,
  //   host: false,
  //   port: false,
  //   driverClass: false,
  //   broker: false,
  //   dashboardUrl: false,
  //   username: false,
  //   password: false,
  //   apiKey: false,
  //   siteName: false,
  //   apiVersion: false,
  //   server: false,
  //   pipelineUrl: false,
  // });

  // const [hostport] = useState(
  //   getHostPortDetails(data?.databaseConnection?.hostPort || '')
  // );
  // const [host, setHost] = useState(hostport.host);
  // const [port, setPort] = useState(hostport.port);
  // const [username, setUsername] = useState(
  //   serviceCategory === ServiceCategory.DATABASE_SERVICES
  //     ? data?.databaseConnection?.username || ''
  //     : data?.username || ''
  // );
  // const [password, setPassword] = useState(
  //   serviceCategory === ServiceCategory.DATABASE_SERVICES
  //     ? data?.databaseConnection?.password || ''
  //     : data?.password || ''
  // );
  // const [database, setDatabase] = useState(
  //   data?.databaseConnection?.database || ''
  // );
  // const [connectionOptions, setConnectionOptions] = useState<
  //   DynamicFormFieldType[]
  // >(getKeyValuePair(data?.databaseConnection?.connectionOptions || {}) || []);

  // const [connectionArguments, setConnectionArguments] = useState<
  //   DynamicFormFieldType[]
  // >(getKeyValuePair(data?.databaseConnection?.connectionArguments || {}) || []);

  // const [brokers, setBrokers] = useState(
  //   data?.brokers?.length ? data.brokers.join(', ') : ''
  // );
  // const [schemaRegistry, setSchemaRegistry] = useState(
  //   data?.schemaRegistry || ''
  // );

  // const [dashboardUrl, setDashboardUrl] = useState(data?.dashboardUrl || '');
  // const [apiKey, setApiKey] = useState(data?.api_key || '');
  // const [siteName, setSiteName] = useState(data?.site_name || '');
  // const [apiVersion, setApiVersion] = useState(data?.api_version || '');
  // const [server, setServer] = useState(data?.server || '');
  // const [env, setEnv] = useState(data?.env || '');

  // const getBrokerUrlPlaceholder = (): string => {
  //   return data?.serviceType === MessagingServiceType.Pulsar
  //     ? 'hostname:port'
  //     : 'hostname1:port1, hostname2:port2';
  // };

  // const [pipelineUrl, setPipelineUrl] = useState(data?.pipelineUrl || '');

  // const handleCancel = () => {
  //   switch (serviceCategory) {
  //     case ServiceCategory.DATABASE_SERVICES:
  //       setHost(hostport.host);
  //       setPort(hostport.port);
  //       setUsername(data?.databaseConnection?.username || '');
  //       setPassword(data?.databaseConnection?.password || '');
  //       setDatabase(data?.databaseConnection?.database || '');
  //       setConnectionOptions(
  //         getKeyValuePair(data?.databaseConnection?.connectionOptions || {}) ||
  //           []
  //       );
  //       setConnectionArguments(
  //         getKeyValuePair(
  //           data?.databaseConnection?.connectionArguments || {}
  //         ) || []
  //       );

  //       setShowErrorMsg({
  //         ...showErrorMsg,
  //         host: false,
  //         port: false,
  //       });

  //       break;
  //     case ServiceCategory.MESSAGING_SERVICES:
  //       setShowErrorMsg({
  //         ...showErrorMsg,
  //         broker: false,
  //       });

  //       break;
  //     case ServiceCategory.DASHBOARD_SERVICES:
  //       setShowErrorMsg({
  //         ...showErrorMsg,
  //         dashboardUrl: false,
  //         siteName: false,
  //         username: false,
  //         password: false,
  //         server: false,
  //         apiVersion: false,
  //         apiKey: false,
  //       });

  //       break;
  //     case ServiceCategory.PIPELINE_SERVICES:
  //       setPipelineUrl(data?.pipelineUrl || '');

  //       setShowErrorMsg({
  //         ...showErrorMsg,
  //         pipelineUrl: false,
  //       });

  //       break;
  //     default:
  //       break;
  //   }
  // };

  // const handleRequiredFiedError = () => {
  //   switch (serviceCategory) {
  //     case ServiceCategory.DATABASE_SERVICES:
  //       setShowErrorMsg({
  //         ...showErrorMsg,
  //         host: !host,
  //         port: !port,
  //       });

  //       return Boolean(host && port);
  //     case ServiceCategory.MESSAGING_SERVICES:
  //       return false;

  //     case ServiceCategory.DASHBOARD_SERVICES: {
  //       return false;
  //     }

  //     case ServiceCategory.PIPELINE_SERVICES:
  //       setShowErrorMsg({
  //         ...showErrorMsg,
  //         pipelineUrl: !pipelineUrl,
  //       });

  //       return Boolean(pipelineUrl);
  //     default:
  //       return true;
  //   }
  // };

  // const getUpdatedData = (): ServicesData => {
  //   switch (serviceCategory) {
  //     case ServiceCategory.DATABASE_SERVICES:
  //       return {
  //         ...data,
  //         databaseConnection: {
  //           hostPort: `${host}:${port}`,
  //           connectionArguments: getKeyValueObject(connectionArguments),
  //           connectionOptions: getKeyValueObject(connectionOptions),
  //           database: database,
  //           password: password,
  //           username: username,
  //         },
  //       };
  //     case ServiceCategory.MESSAGING_SERVICES:
  //       return {
  //         ...data,
  //       };
  //     case ServiceCategory.DASHBOARD_SERVICES: {
  //       switch (data?.serviceType) {
  //         case DashboardServiceType.Redash:
  //           return {
  //             ...data,
  //           };

  //         case DashboardServiceType.Tableau:
  //           return {
  //             ...data,
  //           };

  //         default:
  //           return {
  //             ...data,
  //           };
  //       }
  //     }
  //     case ServiceCategory.PIPELINE_SERVICES:
  //       return {
  //         ...data,
  //         pipelineUrl: pipelineUrl,
  //       };
  //     default:
  //       return {};
  //   }
  // };

  // const handleSave = () => {
  //   const isValid = handleRequiredFiedError();

  //   if (isValid) {
  //     const updatedData: ServicesData = getUpdatedData();

  //     if (!isEqual(data, updatedData)) {
  //       setLoading(true);
  //       setStatus('waiting');

  //       handleUpdate(updatedData, serviceCategory)
  //         .then(() => {
  //           setStatus('initial');
  //           setLoading(false);
  //         })
  //         .catch(() => {
  //           showErrorToast(
  //             jsonData['api-error-messages']['update-service-error']
  //           );
  //         });
  //     }
  //   }
  // };

  // const getDatabaseFields = (): JSX.Element => {
  //   return <DatabaseConfigs data={data as DatabaseService} status={status} />;
  // };

  // const getMessagingFields = (): JSX.Element => {
  //   return <MessagingConfigs data={data as MessagingService} status={status} />;
  // };

  // const getDashboardFields = (): JSX.Element => {
  //   return <DashboardConfigs data={data as DashboardService} status={status} />;
  // };

  // const getPipelineFields = (): JSX.Element => {
  //   return <PipelineConfigs data={data as PipelineService} status={status} />;
  // };

  const getDynamicFields = () => {
    // switch (serviceCategory) {
    //   case ServiceCategory.DATABASE_SERVICES:
    //     return getDatabaseFields();
    //   case ServiceCategory.MESSAGING_SERVICES:
    //     return getMessagingFields();
    //   case ServiceCategory.DASHBOARD_SERVICES:
    //     return getDashboardFields();
    //   case ServiceCategory.PIPELINE_SERVICES:
    //     return getPipelineFields();
    //   default:
    //     return <></>;
    // }
    return (
      <ConnectionConfigForm
        data={
          data as
            | DatabaseService
            | MessagingService
            | DashboardService
            | PipelineService
        }
        serviceCategory={serviceCategory}
        status={status}
        onSave={(e) => {
          handleUpdate(e.formData as ServicesData, serviceCategory);
        }}
      />
    );
  };

  return (
    <div className="tw-bg-white tw-h-full">
      <div
        className="tw-max-w-xl tw-mx-auto tw-pb-6"
        data-testid="service-config"
        id="serviceConfig">
        {/* <form className="tw-w-screen-sm" data-testid="form"> */}
        <div className="tw-px-4 tw-pt-3 tw-mx-auto">{getDynamicFields()}</div>
        {/* </form> */}
        {/* <div className="tw-mt-6 tw-text-right" data-testid="buttons">
          <Button
            size="regular"
            theme="primary"
            variant="text"
            onClick={handleCancel}>
            Discard
          </Button>
          {loading ? (
            <Button
              disabled
              className="tw-w-16 tw-h-10 disabled:tw-opacity-100"
              size="regular"
              theme="primary"
              variant="contained">
              <Loader size="small" type="white" />
            </Button>
          ) : status === 'success' ? (
            <Button
              disabled
              className="tw-w-16 tw-h-10 disabled:tw-opacity-100"
              size="regular"
              theme="primary"
              variant="contained">
              <FontAwesomeIcon icon="check" />
            </Button>
          ) : (
            <Button
              className="tw-w-16 tw-h-10"
              data-testid="saveManageTab"
              size="regular"
              theme="primary"
              variant="contained"
              onClick={handleSave}>
              Save
            </Button>
          )}
        </div> */}
      </div>
    </div>
  );
};

export default ServiceConfig;
