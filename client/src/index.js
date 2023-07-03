import React from 'react';
import ReactDOM from 'react-dom/client';
import {
  createBrowserRouter,
  RouterProvider, 
} from 'react-router-dom'; 
import './index.css';
import Root, { loader as rootLoader } from './routes/root'; 
import reportWebVitals from './reportWebVitals';

const router = createBrowserRouter([
  {
    path: '/',
    loader: rootLoader,
    element: <Root />
  },
  {
    path: '/gen/:gen',
    loader: rootLoader,
    element: <Root />
  },
  {
    path: '/species/:species',
    loader: rootLoader,
    element: <Root />
  },
]); 

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <RouterProvider router={router}/>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
