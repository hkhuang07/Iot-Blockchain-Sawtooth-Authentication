<template>
  <div class="space-y-6">
    <!-- Welcome Section -->
    <div class="bg-gradient-to-r from-green-800 to-green-600 rounded-lg p-6">
      <h2 class="text-2xl font-bold mb-2">Smart Garden IoT Dashboard</h2>
      <p class="text-green-100">
        Monitor your garden sensors in real-time. Data is secured by Hyperledger Sawtooth PBFT blockchain.
      </p>
    </div>

    <!-- Stats Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <!-- Block Height -->
      <div class="card">
        <div class="flex items-center justify-between">
          <div>
            <p class="stat-label">Block Height</p>
            <p class="stat-value">{{ formatNumber(connectionStore.blockHeight) }}</p>
          </div>
          <div class="w-12 h-12 bg-blue-900 rounded-full flex items-center justify-center">
            <svg class="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
            </svg>
          </div>
        </div>
      </div>

      <!-- Devices -->
      <div class="card">
        <div class="flex items-center justify-between">
          <div>
            <p class="stat-label">Registered Devices</p>
            <p class="stat-value">{{ devicesStore.devices.length }}</p>
          </div>
          <div class="w-12 h-12 bg-green-900 rounded-full flex items-center justify-center">
            <svg class="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"/>
            </svg>
          </div>
        </div>
      </div>

      <!-- Active Pumps -->
      <div class="card">
        <div class="flex items-center justify-between">
          <div>
            <p class="stat-label">Active Pumps</p>
            <p class="stat-value text-yellow-400">{{ devicesStore.pumpActiveDevices.length }}</p>
          </div>
          <div class="w-12 h-12 bg-yellow-900 rounded-full flex items-center justify-center">
            <svg class="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
          </div>
        </div>
      </div>

      <!-- Validators -->
      <div class="card">
        <div class="flex items-center justify-between">
          <div>
            <p class="stat-label">Online Validators</p>
            <p class="stat-value text-blue-400">
              {{ connectionStore.onlineValidatorCount }}/{{ connectionStore.validatorCount }}
            </p>
          </div>
          <div class="w-12 h-12 bg-purple-900 rounded-full flex items-center justify-center">
            <svg class="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"/>
            </svg>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Network Status -->
      <div class="lg:col-span-1">
        <NetworkStatus />
      </div>

      <!-- Real-time Charts -->
      <div class="lg:col-span-2">
        <RealTimeChart />
      </div>
    </div>

    <!-- Recent Blocks and Active Devices -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Recent Blocks -->
      <div class="card">
        <div class="card-header flex items-center justify-between">
          <span>Recent Blocks</span>
          <router-link to="/explorer" class="text-sm text-green-400 hover:text-green-300">
            View All →
          </router-link>
        </div>
        <div class="space-y-2">
          <div 
            v-for="block in recentBlocks" 
            :key="block.blockId"
            class="flex items-center justify-between p-3 bg-gray-700 rounded-lg hover:bg-gray-600 cursor-pointer transition-colors"
            @click="viewBlock(block)"
          >
            <div class="flex items-center space-x-3">
              <div class="w-8 h-8 bg-blue-900 rounded-full flex items-center justify-center">
                <span class="text-xs font-bold text-blue-400">#{{ block.blockNumber }}</span>
              </div>
              <div>
                <p class="text-sm font-mono text-gray-300 truncate w-32">
                  {{ truncateHash(block.blockId) }}
                </p>
                <p class="text-xs text-gray-500">
                  {{ block.transactionCount }} transactions
                </p>
              </div>
            </div>
            <div class="text-right">
              <p class="text-xs text-gray-500">
                {{ formatTime(block.createdAt) }}
              </p>
            </div>
          </div>
          <div v-if="recentBlocks.length === 0" class="text-center py-8 text-gray-500">
            No blocks yet. Waiting for data...
          </div>
        </div>
      </div>

      <!-- Active Devices -->
      <div class="card">
        <div class="card-header flex items-center justify-between">
          <span>Device Readings</span>
          <router-link to="/devices" class="text-sm text-green-400 hover:text-green-300">
            Manage →
          </router-link>
        </div>
        <div class="space-y-2">
          <div 
            v-for="device in activeDevices" 
            :key="device.deviceId"
            class="p-3 bg-gray-700 rounded-lg"
          >
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center space-x-2">
                <div 
                  class="w-2 h-2 rounded-full"
                  :class="isDeviceOnline(device) ? 'bg-green-500 animate-pulse' : 'bg-red-500'"
                ></div>
                <span class="font-medium">{{ device.deviceId }}</span>
              </div>
              <div 
                class="px-2 py-1 rounded text-xs font-medium"
                :class="device.lastReading?.pumpStatus === 'ON' ? 'bg-yellow-900 text-yellow-300' : 'bg-gray-600 text-gray-300'"
              >
                Pump: {{ device.lastReading?.pumpStatus || 'N/A' }}
              </div>
            </div>
            <div class="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span class="text-gray-500">Temperature:</span>
                <span class="ml-2 font-medium">{{ device.lastReading?.temperature?.toFixed(1) || '--' }}°C</span>
              </div>
              <div>
                <span class="text-gray-500">Humidity:</span>
                <span class="ml-2 font-medium">{{ device.lastReading?.humidity?.toFixed(1) || '--' }}%</span>
              </div>
            </div>
          </div>
          <div v-if="activeDevices.length === 0" class="text-center py-8 text-gray-500">
            No active devices. Register a device to get started.
          </div>
        </div>
      </div>
    </div>

    <!-- Smart Contract Status -->
    <div class="card">
      <div class="card-header">
        Smart Contract Status
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="p-4 bg-gray-700 rounded-lg">
          <div class="flex items-center space-x-2 mb-2">
            <div class="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <span class="font-medium">Contract Active</span>
          </div>
          <p class="text-sm text-gray-400">
            GardenContract v1.0 is processing transactions
          </p>
        </div>
        <div class="p-4 bg-gray-700 rounded-lg">
          <div class="flex items-center space-x-2 mb-2">
            <svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
            </svg>
            <span class="font-medium">Pump Threshold</span>
          </div>
          <p class="text-sm text-gray-400">
            Auto-activates when humidity &lt; 30%
          </p>
        </div>
        <div class="p-4 bg-gray-700 rounded-lg">
          <div class="flex items-center space-x-2 mb-2">
            <svg class="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
            </svg>
            <span class="font-medium">Device Authentication</span>
          </div>
          <p class="text-sm text-gray-400">
            Only whitelisted devices can submit data
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useConnectionStore } from '@/stores/connection'
import { useDevicesStore } from '@/stores/devices'
import { useBlocksStore } from '@/stores/blocks'
import NetworkStatus from '@/components/NetworkStatus.vue'
import RealTimeChart from '@/components/RealTimeChart.vue'

const router = useRouter()
const connectionStore = useConnectionStore()
const devicesStore = useDevicesStore()
const blocksStore = useBlocksStore()

// Computed properties
const recentBlocks = computed(() => blocksStore.latestBlocks.slice(0, 5))
const activeDevices = computed(() => devicesStore.devices.slice(0, 5))

// Methods
function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toString()
}

function truncateHash(hash) {
  if (!hash) return ''
  return hash.substring(0, 8) + '...' + hash.substring(hash.length - 6)
}

function formatTime(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const now = new Date()
  const diff = (now - date) / 1000 // seconds
  
  if (diff < 60) return 'Just now'
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago'
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago'
  return date.toLocaleDateString()
}

function isDeviceOnline(device) {
  if (!device.lastUpdate) return false
  const lastUpdate = new Date(device.lastUpdate)
  const now = new Date()
  const diff = (now - lastUpdate) / 1000 / 60 // minutes
  return diff < 5
}

function viewBlock(block) {
  blocksStore.setSelectedBlock(block)
  router.push('/explorer')
}

// Refresh data periodically
let refreshInterval = null

onMounted(() => {
  devicesStore.fetchDevices()
  blocksStore.fetchBlocks(10)
  
  refreshInterval = setInterval(() => {
    blocksStore.fetchBlocks(10)
    devicesStore.fetchDevices()
  }, 10000)
})

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
})
</script>
