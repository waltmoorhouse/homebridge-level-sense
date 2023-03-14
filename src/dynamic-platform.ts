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

/*
 * IMPORTANT NOTICE
 *
 * One thing you need to take care of is, that you never ever, ever import anything directly from the 'homebridge' module
 * (or the 'hap-nodejs' module).
 * The above import block may seem like, that we do exactly that, but actually those imports are only used for types and interfaces
 * and will disappear once the code is compiled to Javascript.
 * In fact you can check that by running `npm run build` and opening the compiled Javascript file in the `dist` folder.
 * You will notice that the file does not contain a `... = require('homebridge');` statement anywhere in the code.
 *
 * The contents of the above import statement MUST ONLY be used for type annotation or accessing things like CONST ENUMS,
 * which is a special case as they get replaced by the actual value and do not remain as a reference in the compiled code.
 * Meaning normal enums are bad, const enums can be used.
 *
 * You MUST NOT import anything else which remains as a reference in the code, as this will result in
 * a `... = require('homebridge');` to be compiled into the final Javascript code.
 * This typically leads to unexpected behavior at runtime, as in many cases it won't be able to find the module
 * or will import another instance of homebridge causing collisions.
 *
 * To mitigate this the {@link API | Homebridge API} exposes the whole suite of HAP-NodeJS inside the `hap` property
 * of the api object, which can be acquired for example in the initializer function. This reference can be stored
 * like this for example and used to access all exported variables and classes from HAP-NodeJS.
 */

export class LevelSensePlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic

  private readonly SUPPORTED_DEVICES = ['LS_SENTRY']
  private readonly levelSenseService: LevelSenseService
  private readonly cachedAccessories: PlatformAccessory[] = []
  private readonly currentAccessories: Map<string, LevelSensePlatformAccessory> = new Map()

  constructor(readonly log: Logging,
    private readonly config: PlatformConfig,
    private readonly api: API) {

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
  }

  async discover(): Promise<void> {
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
          if (device.deviceSerialNumber === accessory.context.device.deviceSerialNumber) {
            found = true
          }
        }
        if (!found) {
          this.register(device)
        }
      }
    })

    // Configure cached sensors that are still registered, and Remove sensors that are no longer registered
    const sensorsToRemove: PlatformAccessory[] = []
    this.cachedAccessories.forEach(accessory => {
      if (sensors.find(device => device.deviceSerialNumber === accessory.context.device.deviceSerialNumber)) {
        this.log.info('The cached sensor %s is still registered to this account. Configuring.',
          accessory.context.device.displayName)
        this.currentAccessories.set(accessory.context.device.deviceSerialNumber, new LevelSensePlatformAccessory(this, accessory))
      } else {
        this.log.info(accessory.context.device.displayName +
          ' is no longer registered to this account. Removing from homebridge.')
        sensorsToRemove.push(accessory)
      }
    })

    if (sensorsToRemove.length > 0) {
      this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, sensorsToRemove)
    }

    this.updateDeviceReadings()

    // poll again after configured time.
    setInterval(this.pollForNewData.bind(this), Number(this.config.pollMinutes) * 60000)
  }

  async pollForNewData(): Promise<void> {
    this.log.info('Polling LevelSense API')
    // Get sensors from API
    const sensors = await this.getSensors()

    // Register and new sensors found
    sensors.forEach(device => {
      // Check to see if it's a supported device
      if (this.SUPPORTED_DEVICES.includes(device.deviceType)) {
        // Check to see if controllers already registered in accessories
        let found = false
        for (const accessory of this.currentAccessories) {
          if (device.deviceSerialNumber === accessory[1].context.device.deviceSerialNumber) {
            found = true
          }
        }
        if (!found) {
          this.register(device)
        }
      }
    })

    // Remove sensors that are no longer registered
    const sensorsToRemove: PlatformAccessory[] = []
    for (const key in this.currentAccessories.keys()) {
      const accessory = this.currentAccessories.get(key)!
      if (!sensors.find(device => device.deviceSerialNumber === accessory.context.device.deviceSerialNumber)) {
        this.log.info(accessory.context.device.displayName +
          ' is no longer registered to this account. Removing from homebridge.')
        sensorsToRemove.push(accessory.accessory)
      }
    }

    if (sensorsToRemove.length > 0) {
      this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, sensorsToRemove)
    }

    this.updateDeviceReadings()
  }

  async getSensors(): Promise<Device[]> {
    // Get sensors from API
    const response = await this.levelSenseService.getDeviceList()
    if (!response?.success) {
      this.log.error('ERROR: unable to fetch devices - ' + response?.message)
      return []
    }
    const sensors = response?.deviceList
    if (!sensors) {
      return []
    }
    return sensors
  }

  private register(device: Device) {
    this.log.info(`Discovered Level Sense Device: ${device.displayName}.`)
    const uuid = this.generate(device.deviceSerialNumber)
    // create a new accessory
    const accessory = new this.api.platformAccessory(device.displayName, uuid)
    accessory.context.device = device

    // config new accessory and add to list
    this.currentAccessories.set(device.deviceSerialNumber, new LevelSensePlatformAccessory(this, accessory))

    // link the accessory to your platform
    this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory])
    this.log.info(`Level Sense Device ${device.displayName} has been registered!`)
  }

  /*
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to set up event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory): void {
    this.log.info('Loading accessory from cache:', accessory.displayName)
    // add the restored accessory to the accessories cache, so we can track if it has already been registered
    this.cachedAccessories.push(accessory)
  }

  private updateDeviceReadings() {
    this.log.info('Updating device readings.')
    // Update device attributes
    for (const key of this.currentAccessories.keys()) {
      const accessory = this.currentAccessories.get(key)!
      if (accessory.context.device.online) {
        this.levelSenseService.getDeviceAlarm(accessory.context.device.id)
          .then(resp => resp?.success ? accessory.context.readings = resp.device : Promise.reject(resp?.message))
          .then(reading => accessory.context.device.online ? accessory.pushReading(reading) : Promise.resolve())
          .catch(error => this.log.error(error))
      }
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
