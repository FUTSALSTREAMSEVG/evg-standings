// src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// ✅ reemplaza './index.css' por los tres CSS separados
import './styles/base.css'
import './styles/evg.css'
import './styles/copa.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
