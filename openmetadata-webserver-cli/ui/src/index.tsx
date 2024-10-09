import React from 'react';
import ReactDOM from 'react-dom'; // Use 'react-dom' in React 17
import './index.css';
import App from './App';
// import reportWebVitals from './reportWebVitals';

// Use ReactDOM.render instead of createRoot
ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root') as HTMLElement
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
// reportWebVitals();