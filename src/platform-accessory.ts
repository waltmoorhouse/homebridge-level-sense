import {Service, PlatformAccessory, CharacteristicValue, PlatformAccessoryEvent} from 'homebridge'

import {LevelSensePlatform} from './dynamic-platform'
import {AccessoryContext, AlarmConfig, DeviceAlarm} from './level-sense.types'

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
// @ts-ignore
export class LevelSensePlatformAccessory {
  public context: AccessoryContext
  private readonly tempService: Service
  private readonly humidityService: Service
  private readonly contactSensorOneService: Service
  private readonly contactSensorTwoService: Service

  constructor(
    private readonly platform: LevelSensePlatform,
    readonly accessory: PlatformAccessory,
  ) {
    this.context = accessory.context as AccessoryContext
    const device = this.context.device
    // set accessory information
    const informationService = accessory.getService(this.platform.Service.AccessoryInformation)!
    informationService
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'LevelSense')
      .setCharacteristic(this.platform.Characteristic.Model, device.deviceType)
      .setCharacteristic(this.platform.Characteristic.SerialNumber, device.deviceSerialNumber)
      .setCharacteristic(this.platform.Characteristic.FirmwareRevision, device.deviceFirmware)
      .setCharacteristic(this.platform.Characteristic.ConfiguredName, device.displayName)

    accessory.on(PlatformAccessoryEvent.IDENTIFY, () => {
      this.platform.log.info('%s identified!', accessory.displayName)
    })

    // Temperature Service Setup
    this.tempService = accessory.getService(this.platform.Service.TemperatureSensor) ||
      accessory.addService(this.platform.Service.TemperatureSensor)
    this.tempService.setCharacteristic(this.platform.Characteristic.Name, this.context.device.displayName + ' Temperature')
    this.tempService.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .onGet(this.getCurrentTemperature.bind(this))

    // Humidity Service Setup
    this.humidityService = accessory.getService(this.platform.Service.HumiditySensor) || accessory.addService(this.platform.Service.HumiditySensor)
    this.humidityService.setCharacteristic(this.platform.Characteristic.Name, this.context.device.displayName + ' Humidity')
    this.humidityService.getCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity)
      .onGet(this.getCurrentRelativeHumidity.bind(this))

    this.tempService.addLinkedService(this.humidityService)

    /**
     * Creating multiple services of the same type.
     *
     * To avoid "Cannot add a Service with the same UUID another Service without also defining a unique 'subtype' property." error,
     * when creating multiple services of the same type, you need to use the following syntax to specify a name and subtype id:
     * this.accessory.getService('NAME') || this.accessory.addService(this.platform.Service.Lightbulb, 'NAME', 'USER_DEFINED_SUBTYPE_ID');
     *
     * The USER_DEFINED_SUBTYPE must be unique to the platform accessory (if you platform exposes multiple accessories, each accessory
     * can use the same subtype id.)
     */
    // create new Contact Sensor services
    const cs1Name = this.context.device.displayName + ' Leak Sensor'
    this.contactSensorOneService = this.accessory.getService(cs1Name) ||
      this.accessory.addService(this.platform.Service.ContactSensor, cs1Name, 'LevelSense-Sentry-Leak-Sensor')
    this.contactSensorOneService.getCharacteristic(this.platform.Characteristic.ContactSensorState)
      .onGet(this.getContactSensor1State.bind(this))

    this.tempService.addLinkedService(this.contactSensorOneService)

    const cs2Name = this.context.device.displayName + ' Float Switch'
    this.contactSensorTwoService = this.accessory.getService(cs2Name) ||
      this.accessory.addService(this.platform.Service.ContactSensor, cs2Name, 'LevelSense-Sentry-Float-Switch')
    this.contactSensorTwoService.getCharacteristic(this.platform.Characteristic.ContactSensorState)
      .onGet(this.getContactSensor2State.bind(this))

    this.tempService.addLinkedService(this.contactSensorTwoService)
  }

  /**
   * Updating characteristics values asynchronously.
   *
   * Example showing how to update the state of a Characteristic asynchronously instead
   * of using the `on('get')` handlers.
   *
   */
  async pushReading(readings: DeviceAlarm) {
    const tempSensor = this.findTemp(readings)
    const temp = tempSensor?.sensorDisplayUnits === 'F' ? this.convertFtoC(tempSensor?.currentValue) : tempSensor?.currentValue
    const humiditySensor = this.findHumidity(readings)
    const contactSensor1 = this.findInput1(readings)
    const contactSensor2 = this.findInput2(readings)
    this.tempService.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, temp)
    this.humidityService.updateCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity, humiditySensor.currentValue)
    this.contactSensorOneService.updateCharacteristic(this.platform.Characteristic.ContactSensorState,
      this.toContactSensorCharacteristic(contactSensor1.currentValue))
    this.contactSensorTwoService.updateCharacteristic(this.platform.Characteristic.ContactSensorState,
      this.toContactSensorCharacteristic(contactSensor2.currentValue))
  }

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
  async getCurrentTemperature(): Promise<CharacteristicValue> {
    const sensor = this.findTemp(this.context.readings)
    const temp = sensor?.sensorDisplayUnits === 'F' ? this.convertFtoC(sensor?.currentValue) : sensor?.currentValue
    this.platform.log.debug('%s: %s getCurrentTemperature -> %s', this.context.device.displayName, sensor?.sensorDisplayName, temp)
    return temp
  }

  async getCurrentRelativeHumidity(): Promise<CharacteristicValue> {
    const sensor = this.findHumidity(this.context.readings)
    this.platform.log.debug('%s: %s getCurrentRelativeHumidity -> %s', this.context.device.displayName, sensor?.sensorDisplayName, sensor?.currentValue)
    return sensor?.currentValue
  }

  async getContactSensor1State(): Promise<CharacteristicValue> {
    const sensor = this.findInput1(this.context.readings)
    this.platform.log.debug('%s: %s getContactSensor1State -> %s', this.context.device.displayName, sensor?.sensorDisplayName, sensor?.currentValue)
    return this.toContactSensorCharacteristic(sensor?.currentValue)
  }

  async getContactSensor2State(): Promise<CharacteristicValue> {
    const sensor = this.findInput2(this.context.readings)
    this.platform.log.debug('%s: %s getContactSensor2State -> %s', this.context.device.displayName, sensor?.sensorDisplayName, sensor?.currentValue)
    return this.toContactSensorCharacteristic(sensor?.currentValue)
  }

  private findTemp(readings?: DeviceAlarm): AlarmConfig {
    return readings?.sensorLimit.find((limit: AlarmConfig) => limit.sensorSlug === 'tempc')!
  }

  private findHumidity(readings?: DeviceAlarm): AlarmConfig {
    return readings?.sensorLimit.find((limit: AlarmConfig) => limit.sensorSlug === 'rh')!
  }

  private findInput1(readings?: DeviceAlarm): AlarmConfig {
    return readings?.sensorLimit.find((limit: AlarmConfig) => limit.sensorSlug === 'input1')!
  }

  private findInput2(readings?: DeviceAlarm): AlarmConfig {
    return readings?.sensorLimit.find((limit: AlarmConfig) => limit.sensorSlug === 'input2')!
  }

  private toContactSensorCharacteristic(currentValue: string) {
    return currentValue == 'Open' ?
      this.platform.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED :
      this.platform.Characteristic.ContactSensorState.CONTACT_DETECTED
  }

  private convertFtoC(fahrenheit: string) {
    return String((Number(fahrenheit) - 32) * 5 / 9)
  }
}
