import { app, type BrowserWindow } from 'electron'
import { loadConfig } from '../../config/loadConfig'
import { registerAppLifecycle, registerSingleInstance } from './bootstrap/appLifecycle'
import './bootstrap/paths'
import { registerMainModuleRegistry } from './bootstrap/registerMainModuleRegistry'
import { createMainWindow } from './bootstrap/createMainWindow'
import { bootstrapAppProtection } from './security/appProtection'
import { applyAppSecurity } from './security/appSecurity'
import { registerMediaProtocolHandler, registerMediaProtocolScheme } from './modules/media/mediaProtocol'

const config = loadConfig()

registerMediaProtocolScheme()
applyAppSecurity()
bootstrapAppProtection(config)
registerSingleInstance()

let mainWindow: BrowserWindow | null = null

async function bootstrap() {
  mainWindow = await createMainWindow()

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

void registerMainModuleRegistry(config, () => mainWindow)
registerAppLifecycle(() => mainWindow, bootstrap)

app.whenReady().then(() => registerMediaProtocolHandler())
app.whenReady().then(bootstrap)
