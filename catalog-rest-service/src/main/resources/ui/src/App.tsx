import React, { FunctionComponent } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import AppRouter from './router/AppRouter';
import Appbar from './components/app-bar/Appbar';
import { ToastContextProvider } from './contexts/ToastContext';

const App: FunctionComponent = () => {
  return (
    <div className="main-container">
      <ToastContextProvider>
        <Router>
          <div className="content-wrapper" data-testid="content-wrapper">
            <Appbar />
            <AppRouter />
          </div>
        </Router>
      </ToastContextProvider>
    </div>
  );
};

export default App;
