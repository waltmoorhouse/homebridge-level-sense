import { PlatformAccessory, CharacteristicValue } from 'homebridge';
import { LevelSensePlatform } from './dynamic-platform';
import { AccessoryContext, DeviceAlarm } from './level-sense.types';
/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export declare class LevelSensePlatformAccessory {
    private readonly platform;
    readonly accessory: PlatformAccessory;
    context: AccessoryContext;
    private readonly tempService;
    private readonly humidityService;
    private readonly contactSensorOneService;
    private readonly contactSensorTwoService;
    constructor(platform: LevelSensePlatform, accessory: PlatformAccessory);
    /**
     * Updating characteristics values asynchronously.
     *
     * Example showing how to update the state of a Characteristic asynchronously instead
     * of using the `on('get')` handlers.
     *
     */
    pushReading(readings: DeviceAlarm): Promise<void>;
    /**
     * Handle the "GET" requests from HomeKit
     * These are sent when HomeKit wants to know the current state of the accessory, for example, checking if a Light bulb is on.
     *
     * GET requests should return as fast as possible. A long delay here will result in
     * HomeKit being unresponsive and a bad user experience in general.
     *
     * If your device takes time to respond you should update the status of your device
     * asynchronously instead using the `updateCharacteristic` method instead.
  
     * @example
     * this.service.updateCharacteristic(this.platform.Characteristic.On, true)
     */
    getCurrentTemperature(): Promise<CharacteristicValue>;
    getCurrentRelativeHumidity(): Promise<CharacteristicValue>;
    getContactSensor1State(): Promise<CharacteristicValue>;
    getContactSensor2State(): Promise<CharacteristicValue>;
    private findTemp;
    private findHumidity;
    private findInput1;
    private findInput2;
    private toContactSensorCharacteristic;
    private convertFtoC;
}
//# sourceMappingURL=platform-accessory.d.ts.map