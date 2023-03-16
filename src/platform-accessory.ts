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
    this.tempService.getCharacteristic(this.platform.Characteristic.StatusTampered) // No ALARM, so using this instead
      .onGet(this.getTemperatureAlarm.bind(this))
    this.tempService.getCharacteristic(this.platform.Characteristic.StatusFault)
      .onGet(this.getOnline.bind(this))

    // Humidity Service Setup
    this.humidityService = accessory.getService(this.platform.Service.HumiditySensor) || accessory.addService(this.platform.Service.HumiditySensor)
    this.humidityService.setCharacteristic(this.platform.Characteristic.Name, this.context.device.displayName + ' Humidity')
    this.humidityService.getCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity)
      .onGet(this.getCurrentRelativeHumidity.bind(this))
    this.humidityService.getCharacteristic(this.platform.Characteristic.StatusTampered) // No ALARM, so using this instead
      .onGet(this.getHumidityAlarm.bind(this))
    this.humidityService.getCharacteristic(this.platform.Characteristic.StatusFault)
      .onGet(this.getOnline.bind(this))

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
    const cs1Name = this.context.readings.sensorLimit.find(sl => sl.sensorSlug === 'input1')?.sensorDisplayName || this.context.device.displayName + ' Leak Sensor'
    this.contactSensorOneService = this.accessory.getService(cs1Name) ||
      this.accessory.addService(this.platform.Service.ContactSensor, cs1Name, 'LevelSense-Sentry-Leak-Sensor')
    this.contactSensorOneService.setCharacteristic(this.platform.Characteristic.Name, cs1Name)
    this.contactSensorOneService.getCharacteristic(this.platform.Characteristic.ContactSensorState)
      .onGet(this.getContactSensor1State.bind(this))
    this.contactSensorOneService.getCharacteristic(this.platform.Characteristic.StatusTampered) // No ALARM, so using this instead
      .onGet(this.getContactSensor1Alarm.bind(this))
    this.contactSensorOneService.getCharacteristic(this.platform.Characteristic.StatusFault)
      .onGet(this.getOnline.bind(this))

    this.tempService.addLinkedService(this.contactSensorOneService)

    const cs2Name = this.context.readings.sensorLimit.find(sl => sl.sensorSlug === 'input2')?.sensorDisplayName || this.context.device.displayName + ' Float Switch'
    this.contactSensorTwoService = this.accessory.getService(cs2Name) ||
      this.accessory.addService(this.platform.Service.ContactSensor, cs2Name, 'LevelSense-Sentry-Float-Switch')
    this.contactSensorTwoService.setCharacteristic(this.platform.Characteristic.Name, cs2Name)
    this.contactSensorTwoService.getCharacteristic(this.platform.Characteristic.ContactSensorState)
      .onGet(this.getContactSensor2State.bind(this))
    this.contactSensorTwoService.getCharacteristic(this.platform.Characteristic.StatusTampered) // No ALARM, so using this instead
      .onGet(this.getContactSensor2Alarm.bind(this))
    this.contactSensorTwoService.getCharacteristic(this.platform.Characteristic.StatusFault)
      .onGet(this.getOnline.bind(this))

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
    const faultStatus = await this.getOnline()
    this.tempService.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, temp)
    this.tempService.updateCharacteristic(this.platform.Characteristic.StatusTampered, tempSensor.isAlarm)
    this.tempService.updateCharacteristic(this.platform.Characteristic.StatusFault, faultStatus)
    this.humidityService.updateCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity, humiditySensor.currentValue)
    this.humidityService.updateCharacteristic(this.platform.Characteristic.StatusTampered, humiditySensor.isAlarm)
    this.humidityService.updateCharacteristic(this.platform.Characteristic.StatusFault, faultStatus)
    this.contactSensorOneService.updateCharacteristic(this.platform.Characteristic.ContactSensorState,
      this.toContactSensorCharacteristic(contactSensor1.currentValue))
    this.contactSensorOneService.updateCharacteristic(this.platform.Characteristic.StatusTampered, contactSensor1.isAlarm)
    this.contactSensorOneService.updateCharacteristic(this.platform.Characteristic.StatusFault, faultStatus)
    this.contactSensorTwoService.updateCharacteristic(this.platform.Characteristic.ContactSensorState,
      this.toContactSensorCharacteristic(contactSensor2.currentValue))
    this.contactSensorTwoService.updateCharacteristic(this.platform.Characteristic.StatusTampered, contactSensor2.isAlarm)
    this.contactSensorTwoService.updateCharacteristic(this.platform.Characteristic.StatusFault, faultStatus)
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

  async getTemperatureAlarm(): Promise<CharacteristicValue> {
    const sensor = this.findTemp(this.context.readings)
    let fault = sensor?.isAlarm || false
    this.platform.log.debug('%s: %s getTemperatureAlarm -> %s', this.context.device.displayName, sensor?.sensorDisplayName, fault)
    return fault ? this.platform.Characteristic.StatusFault.GENERAL_FAULT : this.platform.Characteristic.StatusFault.NO_FAULT
  }

  async getHumidityAlarm(): Promise<CharacteristicValue> {
    const sensor = this.findHumidity(this.context.readings)
    let fault = sensor?.isAlarm || false
    this.platform.log.debug('%s: %s getHumidityAlarm -> %s', this.context.device.displayName, sensor?.sensorDisplayName, fault)
    return fault ? this.platform.Characteristic.StatusFault.GENERAL_FAULT : this.platform.Characteristic.StatusFault.NO_FAULT
  }

  async getContactSensor1Alarm(): Promise<CharacteristicValue> {
    const sensor = this.findInput1(this.context.readings)
    let fault = sensor?.isAlarm || false
    this.platform.log.debug('%s: %s getContactSensor1Alarm -> %s', this.context.device.displayName, sensor?.sensorDisplayName, fault)
    return fault ? this.platform.Characteristic.StatusFault.GENERAL_FAULT : this.platform.Characteristic.StatusFault.NO_FAULT
  }

  async getContactSensor2Alarm(): Promise<CharacteristicValue> {
    const sensor = this.findInput2(this.context.readings)
    let fault = sensor?.isAlarm || false
    this.platform.log.debug('%s: %s getContactSensor2Alarm -> %s', this.context.device.displayName, sensor?.sensorDisplayName, fault)
    return fault ? this.platform.Characteristic.StatusFault.GENERAL_FAULT : this.platform.Characteristic.StatusFault.NO_FAULT
  }

  async getOnline(): Promise<CharacteristicValue> {
    const online = this.context.device.online === "1"
    this.platform.log.debug('%s: getOnline -> %s', this.context.device.displayName, online)
    return online ? this.platform.Characteristic.StatusFault.NO_FAULT : this.platform.Characteristic.StatusFault.GENERAL_FAULT
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
