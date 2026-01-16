<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h2 class="text-2xl font-bold">Device Management</h2>
        <p class="text-gray-400">Register and manage your IoT devices</p>
      </div>
      <button 
        @click="showRegisterModal = true"
        class="btn btn-primary flex items-center space-x-2"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
        </svg>
        <span>Register Device</span>
      </button>
    </div>

    <!-- Device Stats -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div class="card">
        <p class="stat-label">Total Devices</p>
        <p class="stat-value">{{ devicesStore.devices.length }}</p>
      </div>
      <div class="card">
        <p class="stat-label">Registered</p>
        <p class="stat-value text-green-400">{{ devicesStore.registeredDevices.length }}</p>
      </div>
      <div class="card">
        <p class="stat-label">Online (Last 5m)</p>
        <p class="stat-value text-blue-400">{{ devicesStore.onlineDevices.length }}</p>
      </div>
      <div class="card">
        <p class="stat-label">Pumps Active</p>
        <p class="stat-value text-yellow-400">{{ devicesStore.pumpActiveDevices.length }}</p>
      </div>
    </div>

    <!-- Device List -->
    <div class="card">
      <div class="card-header flex items-center justify-between">
        <span>Devices</span>
        <input 
          v-model="searchQuery" 
          type="text" 
          placeholder="Search devices..." 
          class="input w-64"
        />
      </div>
      
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-gray-700">
            <tr>
              <th class="table-header table-cell">Status</th>
              <th class="table-header table-cell">Device ID</th>
              <th class="table-header table-cell">Name</th>
              <th class="table-header table-cell">Temperature</th>
              <th class="table-header table-cell">Humidity</th>
              <th class="table-header table-cell">Pump</th>
              <th class="table-header table-cell">Last Update</th>
              <th class="table-header table-cell">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-700">
            <tr 
              v-for="device in filteredDevices" 
              :key="device.deviceId"
              class="hover:bg-gray-700 transition-colors"
            >
              <td class="table-cell">
                <div 
                  class="w-3 h-3 rounded-full"
                  :class="isDeviceOnline(device) ? 'bg-green-500 animate-pulse' : 'bg-red-500'"
                ></div>
              </td>
              <td class="table-cell">
                <span class="font-mono text-sm">{{ device.deviceId }}</span>
              </td>
              <td class="table-cell">
                <span>{{ device.deviceName || 'Unnamed' }}</span>
              </td>
              <td class="table-cell">
                <span :class="getTempClass(device.lastReading?.temperature)">
                  {{ device.lastReading?.temperature?.toFixed(1) || '--' }}°C
                </span>
              </td>
              <td class="table-cell">
                <span :class="getHumidityClass(device.lastReading?.humidity)">
                  {{ device.lastReading?.humidity?.toFixed(1) || '--' }}%
                </span>
              </td>
              <td class="table-cell">
                <button 
                  @click="togglePump(device)"
                  class="px-2 py-1 rounded text-xs font-medium transition-colors"
                  :class="device.lastReading?.pumpStatus === 'ON' 
                    ? 'bg-yellow-600 hover:bg-yellow-700 text-white' 
                    : 'bg-gray-600 hover:bg-gray-700 text-gray-300'"
                >
                  {{ device.lastReading?.pumpStatus || 'OFF' }}
                </button>
              </td>
              <td class="table-cell text-gray-400 text-sm">
                {{ formatTime(device.lastUpdate) }}
              </td>
              <td class="table-cell">
                <div class="flex items-center space-x-2">
                  <button 
                    @click="viewDevice(device)"
                    class="text-blue-400 hover:text-blue-300"
                    title="View Details"
                  >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                    </svg>
                  </button>
                  <button 
                    @click="sendTestData(device)"
                    class="text-green-400 hover:text-green-300"
                    title="Send Test Data"
                  >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        
        <div v-if="filteredDevices.length === 0 && !loading" class="text-center py-12 text-gray-500">
          <svg class="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"/>
          </svg>
          <p>No devices found</p>
          <p class="text-sm mt-2">Register a device to get started</p>
        </div>
      </div>
    </div>

    <!-- Register Device Modal -->
    <div 
      v-if="showRegisterModal" 
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      @click.self="showRegisterModal = false"
    >
      <div class="bg-gray-800 rounded-lg w-full max-w-md">
        <div class="p-6 border-b border-gray-700">
          <h3 class="text-xl font-bold">Register New Device</h3>
        </div>
        
        <form @submit.prevent="registerDevice" class="p-6 space-y-4">
          <div>
            <label class="block text-sm text-gray-400 mb-1">Device ID *</label>
            <input 
              v-model="newDevice.deviceId" 
              type="text" 
              class="input w-full" 
              placeholder="e.g., sensor_01"
              required
            />
          </div>
          <div>
            <label class="block text-sm text-gray-400 mb-1">Device Name</label>
            <input 
              v-model="newDevice.deviceName" 
              type="text" 
              class="input w-full" 
              placeholder="e.g., Garden Sensor 1"
            />
          </div>
          
          <div class="flex justify-end space-x-3 pt-4">
            <button 
              type="button" 
              @click="showRegisterModal = false"
              class="btn btn-secondary"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              class="btn btn-primary"
              :disabled="registering"
            >
              {{ registering ? 'Registering...' : 'Register Device' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Device Details Modal -->
    <div 
      v-if="showDetailsModal && selectedDevice" 
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      @click.self="showDetailsModal = false"
    >
      <div class="bg-gray-800 rounded-lg w-full max-w-2xl max-h-[80vh] overflow-hidden">
        <div class="p-6 border-b border-gray-700 flex items-center justify-between">
          <h3 class="text-xl font-bold">Device Details</h3>
          <button @click="showDetailsModal = false" class="text-gray-400 hover:text-white">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        
        <div class="p-6 overflow-y-auto max-h-[60vh]">
          <!-- Device Info -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label class="text-sm text-gray-400">Device ID</label>
              <p class="font-mono text-sm bg-gray-900 p-2 rounded">{{ selectedDevice.deviceId }}</p>
            </div>
            <div>
              <label class="text-sm text-gray-400">Device Name</label>
              <p class="text-lg font-medium">{{ selectedDevice.deviceName || 'Unnamed' }}</p>
            </div>
            <div>
              <label class="text-sm text-gray-400">Public Key</label>
              <p class="font-mono text-xs bg-gray-900 p-2 rounded break-all">{{ selectedDevice.publicKey }}</p>
            </div>
            <div>
              <label class="text-sm text-gray-400">Registered At</label>
              <p>{{ formatTime(selectedDevice.registeredAt) }}</p>
            </div>
          </div>

          <!-- Latest Reading -->
          <h4 class="text-lg font-semibold mb-3">Latest Reading</h4>
          <div class="grid grid-cols-3 gap-4 mb-6">
            <div class="bg-gray-700 rounded-lg p-4 text-center">
              <p class="text-2xl font-bold" :class="getTempClass(selectedDevice.lastReading?.temperature)">
                {{ selectedDevice.lastReading?.temperature?.toFixed(1) || '--' }}°C
              </p>
              <p class="text-sm text-gray-400">Temperature</p>
            </div>
            <div class="bg-gray-700 rounded-lg p-4 text-center">
              <p class="text-2xl font-bold" :class="getHumidityClass(selectedDevice.lastReading?.humidity)">
                {{ selectedDevice.lastReading?.humidity?.toFixed(1) || '--' }}%
              </p>
              <p class="text-sm text-gray-400">Humidity</p>
            </div>
            <div class="bg-gray-700 rounded-lg p-4 text-center">
              <p class="text-2xl font-bold" :class="selectedDevice.lastReading?.pumpStatus === 'ON' ? 'text-yellow-400' : 'text-gray-400'">
                {{ selectedDevice.lastReading?.pumpStatus || 'OFF' }}
              </p>
              <p class="text-sm text-gray-400">Pump Status</p>
            </div>
          </div>

          <!-- Quick Actions -->
          <h4 class="text-lg font-semibold mb-3">Quick Actions</h4>
          <div class="flex space-x-3">
            <button 
              @click="togglePump(selectedDevice)"
              class="btn flex-1"
              :class="selectedDevice.lastReading?.pumpStatus === 'ON' ? 'btn-secondary' : 'btn-primary'"
            >
              {{ selectedDevice.lastReading?.pumpStatus === 'ON' ? 'Turn Pump OFF' : 'Turn Pump ON' }}
            </button>
            <button 
              @click="sendTestData(selectedDevice)"
              class="btn btn-primary flex-1"
            >
              Send Test Data
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useDevicesStore } from '@/stores/devices'
import { useConnectionStore } from '@/stores/connection'

const devicesStore = useDevicesStore()
const connectionStore = useConnectionStore()

// State
const searchQuery = ref('')
const showRegisterModal = ref(false)
const showDetailsModal = ref(false)
const selectedDevice = ref(null)
const registering = ref(false)

const newDevice = ref({
  deviceId: '',
  deviceName: ''
})

// Computed
const loading = computed(() => devicesStore.loading)
const filteredDevices = computed(() => {
  if (!searchQuery.value) return devicesStore.devices
  const query = searchQuery.value.toLowerCase()
  return devicesStore.devices.filter(d => 
    d.deviceId.toLowerCase().includes(query) ||
    (d.deviceName && d.deviceName.toLowerCase().includes(query))
  )
})

// Methods
function isDeviceOnline(device) {
  if (!device.lastUpdate) return false
  const lastUpdate = new Date(device.lastUpdate)
  const now = new Date()
  const diff = (now - lastUpdate) / 1000 / 60
  return diff < 5
}

function formatTime(timestamp) {
  if (!timestamp) return 'Never'
  const date = new Date(timestamp)
  return date.toLocaleString()
}

function getTempClass(temp) {
  if (temp === undefined || temp === null) return 'text-gray-400'
  if (temp > 35) return 'text-red-400'
  if (temp > 25) return 'text-yellow-400'
  return 'text-green-400'
}

function getHumidityClass(humidity) {
  if (humidity === undefined || humidity === null) return 'text-gray-400'
  if (humidity < 30) return 'text-red-400'
  if (humidity < 50) return 'text-yellow-400'
  return 'text-green-400'
}

async function registerDevice() {
  if (!newDevice.value.deviceId) return
  
  registering.value = true
  try {
    await devicesStore.registerDevice(newDevice.value.deviceId, newDevice.value.deviceName)
    connectionStore.showNotification(`Device ${newDevice.value.deviceId} registered successfully`, 'success')
    showRegisterModal.value = false
    newDevice.value = { deviceId: '', deviceName: '' }
  } catch (error) {
    connectionStore.showNotification('Failed to register device', 'error')
  } finally {
    registering.value = false
  }
}

function viewDevice(device) {
  selectedDevice.value = device
  showDetailsModal.value = true
}

async function togglePump(device) {
  try {
    const action = device.lastReading?.pumpStatus === 'ON' ? 'OFF' : 'ON'
    await devicesStore.controlPump(device.deviceId, action)
    connectionStore.showNotification(`Pump ${action}`, 'success')
    
    // Refresh device data
    await devicesStore.fetchDevice(device.deviceId)
  } catch (error) {
    connectionStore.showNotification('Failed to control pump', 'error')
  }
}

async function sendTestData(device) {
  try {
    const temperature = (20 + Math.random() * 15).toFixed(1)
    const humidity = (30 + Math.random() * 40).toFixed(1)
    
    await devicesStore.sendTelemetry(device.deviceId, temperature, humidity)
    connectionStore.showNotification('Test data sent', 'success')
    
    // Refresh device data
    await devicesStore.fetchDevice(device.deviceId)
  } catch (error) {
    connectionStore.showNotification('Failed to send test data', 'error')
  }
}

onMounted(() => {
  devicesStore.fetchDevices()
})
</script>
