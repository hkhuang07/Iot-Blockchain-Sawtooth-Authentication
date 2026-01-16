import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export const useDevicesStore = defineStore('devices', () => {
  // State
  const devices = ref([])
  const selectedDevice = ref(null)
  const loading = ref(false)
  const error = ref(null)
  
  // Chart data for each device
  const chartData = ref({})

  // Getters
  const registeredDevices = computed(() => 
    devices.value.filter(d => d.registered)
  )

  const onlineDevices = computed(() => 
    devices.value.filter(d => {
      const lastUpdate = new Date(d.lastUpdate)
      const now = new Date()
      const diff = (now - lastUpdate) / 1000 / 60 // minutes
      return diff < 5 // Consider online if updated in last 5 minutes
    })
  )

  const pumpActiveDevices = computed(() => 
    devices.value.filter(d => 
      d.lastReading && 
      d.lastReading.pumpStatus === 'ON'
    )
  )

  // Actions
  async function fetchDevices() {
    loading.value = true
    error.value = null
    
    try {
      const response = await axios.get(`${API_BASE}/api/devices`)
      devices.value = response.data
      
      // Initialize chart data for each device
      response.data.forEach(device => {
        if (!chartData.value[device.deviceId]) {
          chartData.value[device.deviceId] = {
            temperature: [],
            humidity: []
          }
        }
      })
      
    } catch (err) {
      console.error('Failed to fetch devices:', err.message)
      error.value = err.message
    } finally {
      loading.value = false
    }
  }

  async function fetchDevice(deviceId) {
    loading.value = true
    error.value = null
    
    try {
      const response = await axios.get(`${API_BASE}/api/devices/${deviceId}`)
      selectedDevice.value = response.data
      
      // Update in devices list
      const index = devices.value.findIndex(d => d.deviceId === deviceId)
      if (index !== -1) {
        devices.value[index] = response.data
      }
      
      return response.data
    } catch (err) {
      console.error('Failed to fetch device:', err.message)
      error.value = err.message
      return null
    } finally {
      loading.value = false
    }
  }

  async function registerDevice(deviceId, deviceName) {
    loading.value = true
    error.value = null
    
    try {
      const response = await axios.post(`${API_BASE}/api/devices/register`, {
        device_id: deviceId,
        device_name: deviceName
      })
      
      // Refresh device list
      await fetchDevices()
      
      return response.data
    } catch (err) {
      console.error('Failed to register device:', err.message)
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  async function sendTelemetry(deviceId, temperature, humidity) {
    try {
      const response = await axios.post(`${API_BASE}/api/telemetry`, {
        device_id: deviceId,
        temperature,
        humidity
      })
      
      return response.data
    } catch (err) {
      console.error('Failed to send telemetry:', err.message)
      throw err
    }
  }

  async function controlPump(deviceId, action) {
    try {
      const response = await axios.post(`${API_BASE}/api/pump/control`, {
        device_id: deviceId,
        action
      })
      
      return response.data
    } catch (err) {
      console.error('Failed to control pump:', err.message)
      throw err
    }
  }

  function updateDeviceReading(deviceId, reading) {
    const index = devices.value.findIndex(d => d.deviceId === deviceId)
    if (index !== -1) {
      devices.value[index].lastReading = reading
      devices.value[index].lastUpdate = new Date().toISOString()
      
      // Update chart data
      if (!chartData.value[deviceId]) {
        chartData.value[deviceId] = { temperature: [], humidity: [] }
      }
      
      const now = new Date()
      chartData.value[deviceId].temperature.push({
        x: now,
        y: reading.temperature
      })
      chartData.value[deviceId].humidity.push({
        x: now,
        y: reading.humidity
      })
      
      // Keep only last 50 data points
      const maxPoints = 50
      if (chartData.value[deviceId].temperature.length > maxPoints) {
        chartData.value[deviceId].temperature = 
          chartData.value[deviceId].temperature.slice(-maxPoints)
        chartData.value[deviceId].humidity = 
          chartData.value[deviceId].humidity.slice(-maxPoints)
      }
    }
  }

  function setSelectedDevice(device) {
    selectedDevice.value = device
  }

  return {
    // State
    devices,
    selectedDevice,
    loading,
    error,
    chartData,
    // Getters
    registeredDevices,
    onlineDevices,
    pumpActiveDevices,
    // Actions
    fetchDevices,
    fetchDevice,
    registerDevice,
    sendTelemetry,
    controlPump,
    updateDeviceReading,
    setSelectedDevice
  }
})
