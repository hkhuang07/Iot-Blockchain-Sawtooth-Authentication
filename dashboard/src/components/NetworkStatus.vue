<template>
  <div class="card">
    <div class="card-header flex items-center justify-between">
      <span>Network Status</span>
      <div 
        class="w-2 h-2 rounded-full"
        :class="connectionStore.connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'"
      ></div>
    </div>
    
    <div class="space-y-4">
      <!-- PBFT Consensus Info -->
      <div class="p-3 bg-gray-700 rounded-lg">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-medium">Consensus Algorithm</span>
          <span class="px-2 py-1 bg-purple-900 text-purple-300 rounded text-xs">PBFT</span>
        </div>
        <p class="text-xs text-gray-400">
          Practical Byzantine Fault Tolerance
        </p>
        <p class="text-xs text-gray-500 mt-1">
          tolerates up to f = (n-1)/3 faulty nodes
        </p>
      </div>

      <!-- Validators Grid -->
      <div class="grid grid-cols-2 gap-3">
        <div 
          v-for="validator in validators" 
          :key="validator.id"
          class="p-3 rounded-lg border transition-all"
          :class="getValidatorClass(validator)"
        >
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-medium">Validator {{ validator.id }}</span>
            <div 
              class="w-2 h-2 rounded-full"
              :class="validator.online ? 'bg-green-500' : 'bg-red-500'"
            ></div>
          </div>
          <p class="text-xs text-gray-400">{{ validator.name }}</p>
          <p class="text-xs text-gray-500 mt-1">Port: {{ validator.port }}</p>
        </div>
      </div>

      <!-- Network Health -->
      <div class="p-3 bg-gray-700 rounded-lg">
        <div class="flex items-center justify-between">
          <span class="text-sm">Network Health</span>
          <span 
            class="text-sm font-medium"
            :class="networkHealthClass"
          >
            {{ networkHealthText }}
          </span>
        </div>
        <div class="mt-2 h-2 bg-gray-600 rounded-full overflow-hidden">
          <div 
            class="h-full transition-all duration-500"
            :class="networkHealthColor"
            :style="{ width: networkHealthPercent + '%' }"
          ></div>
        </div>
        <p class="text-xs text-gray-500 mt-2">
          {{ onlineCount }}/{{ validators.length }} validators online
        </p>
      </div>

      <!-- Fault Tolerance Info -->
      <div class="p-3 bg-blue-900/30 border border-blue-800 rounded-lg">
        <div class="flex items-start space-x-2">
          <svg class="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <div>
            <p class="text-sm font-medium text-blue-400">Fault Tolerance</p>
            <p class="text-xs text-gray-400 mt-1">
              With 4 validators, the network can tolerate up to 1 faulty node while maintaining consensus.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted } from 'vue'
import { useConnectionStore } from '@/stores/connection'
import axios from 'axios'

const connectionStore = useConnectionStore()

const validators = ref([
  { id: 0, name: 'validator-0', port: 8008, online: true },
  { id: 1, name: 'validator-1', port: 8009, online: true },
  { id: 2, name: 'validator-2', port: 8010, online: true },
  { id: 3, name: 'validator-3', port: 8011, online: true }
])

const onlineCount = computed(() => validators.value.filter(v => v.online).length)

const networkHealthPercent = computed(() => {
  return (onlineCount.value / validators.value.length) * 100
})

const networkHealthText = computed(() => {
  const percent = networkHealthPercent.value
  if (percent === 100) return 'Excellent'
  if (percent >= 75) return 'Good'
  if (percent >= 50) return 'Degraded'
  return 'Critical'
})

const networkHealthClass = computed(() => {
  const percent = networkHealthPercent.value
  if (percent === 100) return 'text-green-400'
  if (percent >= 75) return 'text-green-300'
  if (percent >= 50) return 'text-yellow-400'
  return 'text-red-400'
})

const networkHealthColor = computed(() => {
  const percent = networkHealthPercent.value
  if (percent === 100) return 'bg-green-500'
  if (percent >= 75) return 'bg-green-400'
  if (percent >= 50) return 'bg-yellow-500'
  return 'bg-red-500'
})

function getValidatorClass(validator) {
  if (validator.online) {
    return 'bg-green-900/30 border-green-800'
  }
  return 'bg-red-900/30 border-red-800'
}

async function checkValidatorStatus() {
  for (const validator of validators.value) {
    try {
      await axios.get(`http://localhost:${validator.port}/blocks`, {
        timeout: 2000
      })
      validator.online = true
    } catch (error) {
      validator.online = false
    }
  }
}

let checkInterval = null

onMounted(() => {
  checkValidatorStatus()
  checkInterval = setInterval(checkValidatorStatus, 10000)
})

onUnmounted(() => {
  if (checkInterval) {
    clearInterval(checkInterval)
  }
})
</script>
