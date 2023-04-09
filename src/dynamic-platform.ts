import {
  API,
  APIEvent,
  DynamicPlatformPlugin,
  Logging,
  PlatformAccessory,
  PlatformConfig,
} from 'homebridge'
import {Characteristic} from 'hap-nodejs/dist/lib/Characteristic'
import {LevelSenseService} from './level-sense.service'
import {Device, LevelSenseServiceConfigOptions} from './level-sense.types'
import {PLATFORM_NAME, PLUGIN_NAME} from './settings'
import {Service} from 'hap-nodejs/dist/lib/Service'
import {LevelSensePlatformAccessory} from './platform-accessory'
import crypto from 'crypto'

export class LevelSensePlatform implements DynamicPlatformPlugin {
  public readonly VERSION = '1.3.0' // This should always match package.json version
  public readonly Service: typeof Service = this.api.hap.Service
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic

  private readonly SUPPORTED_DEVICES = ['LS_SENTRY']
  private readonly levelSenseService: LevelSenseService | undefined
  private cachedAccessories: PlatformAccessory[] = []
  private readonly currentAccessories: Map<string, LevelSensePlatformAccessory> = new Map()
  private isPolling = false

  constructor(readonly log: Logging,
    public config: PlatformConfig,
    private readonly api: API) {
    try {
      if (!config || !config.email || !config.password || config.email === '' || config.password === '') {
        log.error('Cannot start without email and password.')
        return
      }

      this.levelSenseService = new LevelSenseService(config as unknown as LevelSenseServiceConfigOptions, log)
      if (!config.pollMinutes || Number.isNaN(config.pollMinutes) || Number(config.pollMinutes) < 2) {
        this.config.pollMinutes = 15
      }
      log.info(PLATFORM_NAME + ' finished initializing!')

      /*
       * When this event is fired, homebridge restored all cached accessories from disk and did call their respective
       * `configureAccessory` method for all of them. Dynamic Platform plugins should only register new accessories
       * after this event was fired, in order to ensure they weren't added to homebridge already.
       * This event can also be used to start discovery of new accessories.
       */
      api.on(APIEvent.DID_FINISH_LAUNCHING, () => {
        log.info(PLATFORM_NAME + ' finished launching!')
        this.discover().then(() => this.log.info('Discovery action completed'))
      })
    } catch (e) {
      this.log.error(e)
    }
  }

  async discover(): Promise<void> {
    try {
      this.log.info('Discovering from LevelSense API')
      // Get sensors from API
      const sensors = await this.getSensors()

      // Register Sensors not found in the cache
      sensors.forEach(device => {
        // Check to see if it's a supported device
        if (this.SUPPORTED_DEVICES.includes(device.deviceType)) {
          // Check to see if controllers already registered in accessories
          let found = false
          for (const accessory of this.cachedAccessories) {
            if (device.deviceSerialNumber === accessory.context!.device.deviceSerialNumber) {
              if (this.VERSION === accessory.context!.version) {
                found = true
              } else {
                this.log.warn(`Old version of ${device.displayName} was found, removing so it can be reconfigured.`)
                this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory])
                this.cachedAccessories = this.cachedAccessories.filter(cached => cached.UUID !== accessory.UUID)
              }
            }
          }
          if (!found) {
            this.register(device).then(() => this.log.debug('device registered'))
          }
        }
      })

      // Configure cached sensors that are still registered, and Remove sensors that are no longer registered
      const sensorsToRemove: PlatformAccessory[] = []
      this.cachedAccessories.forEach(accessory => {
        if (sensors.find(device => device.deviceSerialNumber === accessory.context!.device.deviceSerialNumber)) {
          this.log.info('The cached sensor %s is still registered to this account. Configuring.',
            accessory.context!.device.displayName)
          this.currentAccessories.set(accessory.context!.device.deviceSerialNumber, new LevelSensePlatformAccessory(this, accessory))
        } else {
          this.log.info(accessory.context!.device.displayName +
            ' is no longer registered to this account. Removing from homebridge.')
          sensorsToRemove.push(accessory)
        }
      })

      if (sensorsToRemove.length > 0) {
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, sensorsToRemove)
      }

      this.updateDeviceReadings()

      // poll again after configured time, only if we aren't already polling.
      if (!this.isPolling) {
        this.isPolling = true
        setInterval(this.pollForNewData.bind(this), Number(this.config.pollMinutes) * 60000)
      }
    } catch (e) {
      this.log.error(e)
    }
  }

  async pollForNewData(): Promise<void> {
    try {
      this.log.info('Polling LevelSense API')
      // Get sensors from API
      const sensors = await this.getSensors()

      // Register and new sensors found
      sensors.forEach(device => {
        // Check to see if it's a supported device
        if (this.SUPPORTED_DEVICES.includes(device.deviceType)) {
          // Check to see if controllers already registered in accessories
          let found = false
          for (const accessoryRecord of this.currentAccessories) {
            if (device.deviceSerialNumber === accessoryRecord[1].context!.device.deviceSerialNumber) {
              if (this.VERSION === accessoryRecord[1].context!.version) {
                found = true
              } else {
                this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessoryRecord[1].accessory])
              }
            }
          }
          if (!found) {
            this.register(device).then(() => this.log.debug('device registered'))
          }
        }
      })

      // Remove sensors that are no longer registered
      const sensorsToRemove: PlatformAccessory[] = []
      for (const key in this.currentAccessories.keys()) {
        const accessory = this.currentAccessories.get(key)!
        if (!sensors.find(device => device.deviceSerialNumber === accessory.context!.device.deviceSerialNumber)) {
          this.log.info(accessory.context!.device.displayName +
            ' is no longer registered to this account. Removing from homebridge.')
          sensorsToRemove.push(accessory.accessory)
        }
      }

      if (sensorsToRemove.length > 0) {
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, sensorsToRemove)
      }

      this.updateDeviceReadings()
    } catch (e) {
      this.log.error(e)
    }
  }

  async getSensors(): Promise<Device[]> {
    try {
      // Get sensors from API
      const response = await this.levelSenseService!.getDeviceList()
      if (!response?.success) {
        this.log.error('ERROR: unable to fetch devices - ' + response?.message)
        return []
      }
      const sensors = response?.deviceList
      if (!sensors) {
        return []
      }
      return sensors
    } catch (e) {
      this.log.error(e)
      return []
    }
  }

  private async register(device: Device) {
    try {
      this.log.info(`Discovered Level Sense Device: ${device.displayName}.`)
      const uuid = this.generate(device.deviceSerialNumber)
      // create a new accessory
      const accessory = new this.api.platformAccessory(device.displayName, uuid)

      // Add context to accessory
      accessory.context!.version = this.VERSION
      accessory.context!.device = device

      // config new accessory and add to list
      const resp = await this.levelSenseService!.getDeviceAlarm(accessory.context!.device.id)
      if (resp?.success) {
        accessory.context!.readings = resp.device
        this.currentAccessories.set(device.deviceSerialNumber, new LevelSensePlatformAccessory(this, accessory))
      }

      // link the accessory to your platform
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory])
      this.log.info(`Level Sense Device ${device.displayName} has been registered!`)
    } catch (e) {
      this.log.error(e)
    }
  }

  /*
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to set up event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory): void {
    try {
      this.log.info('Loading accessory from cache:', accessory.displayName)
      // add the restored accessory to the accessories cache, so we can track if it has already been registered
      this.cachedAccessories.push(accessory)
    } catch (e) {
      this.log.error(e)
    }
  }

  private updateDeviceReadings() {
    try {
      this.log.info('Updating device readings.')
      // Update device attributes
      for (const key of this.currentAccessories.keys()) {
        const accessory = this.currentAccessories.get(key)!
        if (accessory.context!.device.online) {
          this.levelSenseService!.getDeviceAlarm(accessory.context!.device.id)
            .then(resp => resp?.success ? accessory.context!.readings = resp.device : Promise.reject(resp?.message))
            .then(reading => accessory.context!.device.online ? accessory.pushReading(reading) : Promise.resolve())
            .catch(error => this.log.error(error))
        }
      }
    } catch (e) {
      this.log.error(e)
    }
  }

  private generate(deviceSerialNumber: string) {
    const sha1sum = crypto.createHash('sha1')
    sha1sum.update(deviceSerialNumber)
    const s = sha1sum.digest('hex')
    let i = -1
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      i += 1
      switch (c) {
        case 'y':
          return ((parseInt('0x' + s[i], 16) & 0x3) | 0x8).toString(16)
        case 'x':
        default:
          return s[i]
      }
    })
  }
}
