<template>
  <div class="card">
    <div class="card-header flex items-center justify-between">
      <span>Real-time Sensor Data</span>
      <div class="flex items-center space-x-2">
        <select v-model="selectedDevice" class="input text-sm py-1">
          <option value="">All Devices</option>
          <option 
            v-for="device in devices" 
            :key="device.deviceId" 
            :value="device.deviceId"
          >
            {{ device.deviceId }}
          </option>
        </select>
      </div>
    </div>
    
    <!-- Temperature Chart -->
    <div class="mb-6">
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center space-x-2">
          <div class="w-3 h-3 rounded-full bg-red-500"></div>
          <span class="text-sm text-gray-400">Temperature (°C)</span>
        </div>
        <span class="text-lg font-bold text-red-400">
          {{ currentTemp?.toFixed(1) || '--' }}°C
        </span>
      </div>
      <div class="h-32">
        <Line :data="tempChartData" :options="chartOptions" />
      </div>
    </div>
    
    <!-- Humidity Chart -->
    <div>
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center space-x-2">
          <div class="w-3 h-3 rounded-full bg-blue-500"></div>
          <span class="text-sm text-gray-400">Humidity (%)</span>
        </div>
        <span class="text-lg font-bold text-blue-400">
          {{ currentHumidity?.toFixed(1) || '--' }}%
        </span>
      </div>
      <div class="h-32">
        <Line :data="humidityChartData" :options="chartOptions" />
      </div>
    </div>

    <!-- Pump Status Alert -->
    <div 
      v-if="pumpActive" 
      class="mt-4 p-3 bg-yellow-900/50 border border-yellow-700 rounded-lg"
    >
      <div class="flex items-center space-x-2">
        <div class="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></div>
        <span class="text-sm font-medium text-yellow-300">
          Smart Contract Active: Pump is ON (Humidity &lt; 30%)
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { Line } from 'vue-chartjs'
import { useDevicesStore } from '@/stores/devices'

const devicesStore = useDevicesStore()

const selectedDevice = ref('')
const maxDataPoints = 30

// Chart options
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: {
    duration: 0
  },
  scales: {
    x: {
      display: true,
      grid: {
        color: 'rgba(75, 85, 99, 0.3)'
      },
      ticks: {
        color: '#9ca3af',
        maxTicksLimit: 5
      }
    },
    y: {
      display: true,
      grid: {
        color: 'rgba(75, 85, 99, 0.3)'
      },
      ticks: {
        color: '#9ca3af'
      }
    }
  },
  plugins: {
    legend: {
      display: false
    }
  },
  elements: {
    point: {
      radius: 0,
      hoverRadius: 4
    },
    line: {
      tension: 0.4
    }
  }
}

// Computed
const devices = computed(() => devicesStore.devices)

const currentReading = computed(() => {
  if (selectedDevice.value && devicesStore.devices.length > 0) {
    const device = devicesStore.devices.find(d => d.deviceId === selectedDevice.value)
    return device?.lastReading
  }
  // Return average of all devices
  const devicesWithReading = devicesStore.devices.filter(d => d.lastReading)
  if (devicesWithReading.length === 0) return null
  
  const avgTemp = devicesWithReading.reduce((sum, d) => sum + (d.lastReading.temperature || 0), 0) / devicesWithReading.length
  const avgHumidity = devicesWithReading.reduce((sum, d) => sum + (d.lastReading.humidity || 0), 0) / devicesWithReading.length
  
  return {
    temperature: avgTemp,
    humidity: avgHumidity
  }
})

const currentTemp = computed(() => currentReading.value?.temperature)
const currentHumidity = computed(() => currentReading.value?.humidity)

const pumpActive = computed(() => {
  if (currentReading.value?.humidity < 30) return true
  return devicesStore.pumpActiveDevices.length > 0
})

// Chart data
const tempChartData = computed(() => {
  const datasets = []
  
  if (selectedDevice.value) {
    const device = devicesStore.devices.find(d => d.deviceId === selectedDevice.value)
    if (device && devicesStore.chartData[device.deviceId]) {
      datasets.push({
        label: 'Temperature',
        data: devicesStore.chartData[device.deviceId].temperature.slice(-maxDataPoints),
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        fill: true
      })
    }
  } else {
    // Show all devices
    devicesStore.devices.slice(0, 5).forEach((device, index) => {
      if (devicesStore.chartData[device.deviceId]) {
        const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6']
        datasets.push({
          label: device.deviceId,
          data: devicesStore.chartData[device.deviceId].temperature.slice(-maxDataPoints),
          borderColor: colors[index % colors.length],
          backgroundColor: 'transparent',
          borderWidth: 2
        })
      }
    })
  }
  
  return {
    labels: generateLabels(datasets[0]?.data?.length || maxDataPoints),
    datasets
  }
})

const humidityChartData = computed(() => {
  const datasets = []
  
  if (selectedDevice.value) {
    const device = devicesStore.devices.find(d => d.deviceId === selectedDevice.value)
    if (device && devicesStore.chartData[device.deviceId]) {
      datasets.push({
        label: 'Humidity',
        data: devicesStore.chartData[device.deviceId].humidity.slice(-maxDataPoints),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true
      })
    }
  } else {
    // Show all devices
    devicesStore.devices.slice(0, 5).forEach((device, index) => {
      if (devicesStore.chartData[device.deviceId]) {
        const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#14b8a6']
        datasets.push({
          label: device.deviceId,
          data: devicesStore.chartData[device.deviceId].humidity.slice(-maxDataPoints),
          borderColor: colors[index % colors.length],
          backgroundColor: 'transparent',
          borderWidth: 2
        })
      }
    })
  }
  
  return {
    labels: generateLabels(datasets[0]?.data?.length || maxDataPoints),
    datasets
  }
})

function generateLabels(count) {
  const labels = []
  const now = new Date()
  for (let i = count - 1; i >= 0; i--) {
    const time = new Date(now - i * 2000)
    labels.push(time.toLocaleTimeString())
  }
  return labels
}

// Watch for device selection change
watch(selectedDevice, (newDevice) => {
  if (newDevice) {
    devicesStore.fetchDevice(newDevice)
  }
})

onMounted(() => {
  // Initialize with first device if available
  if (devices.value.length > 0) {
    selectedDevice.value = devices.value[0].deviceId
  }
})
</script>
