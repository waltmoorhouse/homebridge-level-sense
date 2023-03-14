"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LevelSensePlatform = void 0;
const level_sense_service_1 = require("./level-sense.service");
const settings_1 = require("./settings");
const uuid_1 = require("hap-nodejs/dist/lib/util/uuid");
const platform_accessory_1 = require("./platform-accessory");
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
class LevelSensePlatform {
    constructor(log, config, api) {
        this.log = log;
        this.config = config;
        this.api = api;
        this.Service = this.api.hap.Service;
        this.Characteristic = this.api.hap.Characteristic;
        this.SUPPORTED_DEVICES = ['LS_SENTRY'];
        this.cachedAccessories = [];
        this.currentAccessories = new Map();
        this.levelSenseService = new level_sense_service_1.LevelSenseService(config, log);
        if (!config.pollMinutes || Number.isNaN(config.pollMinutes) || Number(config.pollMinutes) < 2) {
            this.config.pollMinutes = 15;
        }
        log.info(settings_1.PLATFORM_NAME + ' finished initializing!');
        /*
         * When this event is fired, homebridge restored all cached accessories from disk and did call their respective
         * `configureAccessory` method for all of them. Dynamic Platform plugins should only register new accessories
         * after this event was fired, in order to ensure they weren't added to homebridge already.
         * This event can also be used to start discovery of new accessories.
         */
        api.on("didFinishLaunching" /* APIEvent.DID_FINISH_LAUNCHING */, () => {
            log.info(settings_1.PLATFORM_NAME + ' finished launching!');
            this.discover().then(() => this.log.info('Discovery action completed'));
        });
    }
    async discover() {
        this.log.info('Discovering from LevelSense API');
        // Get sensors from API
        const sensors = await this.getSensors();
        // Register Sensors not found in the cache
        sensors.forEach(device => {
            // Check to see if it's a supported device
            if (this.SUPPORTED_DEVICES.includes(device.deviceType)) {
                // Check to see if controllers already registered in accessories
                let found = false;
                for (const accessory of this.cachedAccessories) {
                    if (device.deviceSerialNumber === accessory.context.device.deviceSerialNumber) {
                        found = true;
                    }
                }
                if (!found) {
                    this.register(device);
                }
            }
        });
        // Configure cached sensors that are still registered, and Remove sensors that are no longer registered
        const sensorsToRemove = [];
        this.cachedAccessories.forEach(accessory => {
            if (sensors.find(device => device.deviceSerialNumber === accessory.context.device.deviceSerialNumber)) {
                this.log.info('The cached sensor %s is still registered to this account. Configuring.', accessory.context.device.displayName);
                this.currentAccessories.set(accessory.context.device.deviceSerialNumber, new platform_accessory_1.LevelSensePlatformAccessory(this, accessory));
            }
            else {
                this.log.info(accessory.context.device.displayName +
                    ' is no longer registered to this account. Removing from homebridge.');
                sensorsToRemove.push(accessory);
            }
        });
        if (sensorsToRemove.length > 0) {
            this.api.unregisterPlatformAccessories(settings_1.PLUGIN_NAME, settings_1.PLATFORM_NAME, sensorsToRemove);
        }
        this.updateDeviceReadings();
        // poll again after configured time.
        setInterval(this.pollForNewData.bind(this), Number(this.config.pollMinutes) * 60000);
    }
    async pollForNewData() {
        this.log.info('Polling LevelSense API');
        // Get sensors from API
        const sensors = await this.getSensors();
        // Register and new sensors found
        sensors.forEach(device => {
            // Check to see if it's a supported device
            if (this.SUPPORTED_DEVICES.includes(device.deviceType)) {
                // Check to see if controllers already registered in accessories
                let found = false;
                for (const accessory of this.currentAccessories) {
                    if (device.deviceSerialNumber === accessory[1].context.device.deviceSerialNumber) {
                        found = true;
                    }
                }
                if (!found) {
                    this.register(device);
                }
            }
        });
        // Remove sensors that are no longer registered
        const sensorsToRemove = [];
        for (const key in this.currentAccessories.keys()) {
            const accessory = this.currentAccessories.get(key);
            if (!sensors.find(device => device.deviceSerialNumber === accessory.context.device.deviceSerialNumber)) {
                this.log.info(accessory.context.device.displayName +
                    ' is no longer registered to this account. Removing from homebridge.');
                sensorsToRemove.push(accessory.accessory);
            }
        }
        if (sensorsToRemove.length > 0) {
            this.api.unregisterPlatformAccessories(settings_1.PLUGIN_NAME, settings_1.PLATFORM_NAME, sensorsToRemove);
        }
        this.updateDeviceReadings();
    }
    async getSensors() {
        // Get sensors from API
        const response = await this.levelSenseService.getDeviceList();
        if (!response?.success) {
            this.log.error('ERROR: unable to fetch devices - ' + response?.message);
            return [];
        }
        const sensors = response?.deviceList;
        if (!sensors) {
            return [];
        }
        return sensors;
    }
    register(device) {
        this.log.info(`Discovered Level Sense Device: ${device.displayName}.`);
        const uuid = (0, uuid_1.generate)(device.deviceSerialNumber);
        // create a new accessory
        const accessory = new this.api.platformAccessory(device.displayName, uuid);
        accessory.context.device = device;
        // config new accessory and add to list
        this.currentAccessories.set(device.deviceSerialNumber, new platform_accessory_1.LevelSensePlatformAccessory(this, accessory));
        // link the accessory to your platform
        this.api.registerPlatformAccessories(settings_1.PLUGIN_NAME, settings_1.PLATFORM_NAME, [accessory]);
        this.log.info(`Level Sense Device ${device.displayName} has been registered!`);
    }
    /*
     * This function is invoked when homebridge restores cached accessories from disk at startup.
     * It should be used to set up event handlers for characteristics and update respective values.
     */
    configureAccessory(accessory) {
        this.log.info('Loading accessory from cache:', accessory.displayName);
        // add the restored accessory to the accessories cache, so we can track if it has already been registered
        this.cachedAccessories.push(accessory);
    }
    updateDeviceReadings() {
        this.log.info('Updating device readings.');
        // Update device attributes
        for (const key of this.currentAccessories.keys()) {
            const accessory = this.currentAccessories.get(key);
            if (accessory.context.device.online) {
                this.levelSenseService.getDeviceAlarm(accessory.context.device.id)
                    .then(resp => resp?.success ? accessory.context.readings = resp.device : Promise.reject(resp?.message))
                    .then(reading => accessory.context.device.online ? accessory.pushReading(reading) : Promise.resolve())
                    .catch(error => this.log.error(error));
            }
        }
    }
}
exports.LevelSensePlatform = LevelSensePlatform;
//# sourceMappingURL=dynamic-platform.js.map