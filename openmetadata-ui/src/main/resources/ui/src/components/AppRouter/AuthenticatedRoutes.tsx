import { isEmpty } from 'lodash';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { APP_ROUTER_ROUTES } from '../../constants/router.constants';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import AccessNotAllowedPage from '../../pages/AccessNotAllowedPage/AccessNotAllowedPage';
import { LogoutPage } from '../../pages/LogoutPage/LogoutPage';
import PageNotFound from '../../pages/PageNotFound/PageNotFound';
import SamlCallback from '../../pages/SamlCallback';
import SignUpPage from '../../pages/SignUp/SignUpPage';
import AppContainer from '../AppContainer/AppContainer';
import { useApplicationsProvider } from '../Settings/Applications/ApplicationsProvider/ApplicationsProvider';
import { RoutePosition } from '../Settings/Applications/plugins/AppPlugin';

export const AuthenticatedRoutes = () => {
  const { currentUser } = useApplicationStore(
    useShallow((state) => ({
      currentUser: state.currentUser,
    }))
  );

  const { plugins = [] } = useApplicationsProvider() ?? {};

  return (
    <Routes>
      <Route element={<PageNotFound />} path={APP_ROUTER_ROUTES.NOT_FOUND} />
      <Route element={<LogoutPage />} path={APP_ROUTER_ROUTES.LOGOUT} />
      <Route
        element={<AccessNotAllowedPage />}
        path={APP_ROUTER_ROUTES.UNAUTHORISED}
      />
      <Route
        element={
          isEmpty(currentUser) ? (
            <SignUpPage />
          ) : (
            <Navigate replace to={APP_ROUTER_ROUTES.HOME} />
          )
        }
        path={APP_ROUTER_ROUTES.SIGNUP}
      />
      <Route
        element={<SamlCallback />}
        path={APP_ROUTER_ROUTES.AUTH_CALLBACK}
      />

      {/* Render APP position plugin routes (they handle their own layouts) */}
      {plugins?.flatMap((plugin) => {
        const routes = plugin.getRoutes?.() || [];
        // Filter routes with APP position
        const appRoutes = routes.filter(
          (route) => route.position === RoutePosition.APP
        );

        return appRoutes.map((route, idx) => (
          <Route key={`${plugin.name}-app-${idx}`} {...route} />
        ));
      })}

      <Route element={<AppContainer />} path="*" />
    </Routes>
  );
};
