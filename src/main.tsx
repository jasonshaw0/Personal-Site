import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource-variable/instrument-sans'
import '@fontsource-variable/syne'
import '@fontsource/ibm-plex-mono/latin-400.css'
import { App } from './App'
import './styles.css'
import './tokens.css'
import './layout.css'
import './navigation.css'
import './projects.css'
import './project-scenes.css'
import './sculpture.css'
import './transitions.css'
import './mobile-navigation.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>,
)
