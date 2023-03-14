import {Logging} from 'homebridge'
import {DeviceAlarmResponse, GetDevices, LevelSenseServiceConfigOptions, LoginResult} from './level-sense.types'
import axios from 'axios'


export class LevelSenseService {
  private readonly HOST = 'https://dash.level-sense.com/Level-Sense-API/web/api'
  private borked = false

  constructor(private readonly config: LevelSenseServiceConfigOptions,
              private readonly log: Logging) {}

  private sessionId: string | undefined

  public async login() {
    if (this.config.sessionKey) {
      this.sessionId = this.config.sessionKey
      this.log('A sessionKey was found in the config, skipping login attempt.')
      return
    }
    const myHeaders = {'Content-Type': 'application/json'}

    const raw = JSON.stringify({
      'email': this.config.email,
      'password': this.config.password
    })

    const requestOptions = {
      headers: myHeaders,
      data: raw,
    }

    this.log('Attempting to login and acquire sessionKey.')
    return axios.get(`${this.HOST}/v1/login`, requestOptions)
      .then(response => response.data as Promise<LoginResult>)
      .then((result: LoginResult) => this.sessionId = result.sessionKey)
      .catch(error => {
        this.borked = true
        this.log.error(error)
      })
  }

  public async getDeviceList(): Promise<GetDevices | void> {
    if (this.borked) {
      this.log.error("Something is not working, check your login credentials.")
      return Promise.resolve()
    }
    if (!this.sessionId) {
      await this.login()
    }
    const myHeaders = {
      'SESSIONKEY': this.sessionId!,
      'Accept': 'application/json'
    }

    const requestOptions = {
      headers: myHeaders,
    }

    this.log('Attempting to get Device List.')
    return axios.get(`${this.HOST}/v1/getDeviceList`, requestOptions)
      .then(response => response.data as Promise<GetDevices>)
      .catch(error => {
        this.sessionId = undefined
        this.log.error(error)
      })
  }

  public async getDeviceAlarm(deviceId: string): Promise<DeviceAlarmResponse | void> {
    if (this.borked) {
      this.log.error("Something is not working, check your login credentials.")
      return Promise.resolve()
    }
    if (!this.sessionId) {
      await this.login()
    }
    const myHeaders = {
      'SESSIONKEY': this.sessionId!,
      'Content-Type': 'application/json'
    }

    const raw = {
      'id': deviceId
    }

    const requestOptions = {
      headers: myHeaders,
      data: raw
    }

    return axios.get(`${this.HOST}/v2/getAlarmConfig`, requestOptions)
      .then(response => response.data as Promise<DeviceAlarmResponse>)
      .catch(error => {
        this.sessionId = undefined
        this.log.error(error)
      })
  }
}
