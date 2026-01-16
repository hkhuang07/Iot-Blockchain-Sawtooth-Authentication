<template>
  <div class="min-h-screen bg-gray-900">
    <!-- Header -->
    <header class="bg-gray-800 border-b border-gray-700 sticky top-0 z-50">
      <div class="container mx-auto px-4">
        <div class="flex items-center justify-between h-16">
          <!-- Logo and Title -->
          <div class="flex items-center space-x-4">
            <div class="flex items-center space-x-2">
              <svg class="w-8 h-8 text-green-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
              <h1 class="text-xl font-bold text-gradient">Smart Garden IoT</h1>
            </div>
            <span class="px-2 py-1 text-xs bg-green-900 text-green-300 rounded-full">
              Blockchain Powered
            </span>
          </div>

          <!-- Navigation -->
          <nav class="hidden md:flex items-center space-x-6">
            <router-link 
              to="/" 
              class="text-gray-300 hover:text-white transition-colors"
              active-class="text-green-400"
            >
              Dashboard
            </router-link>
            <router-link 
              to="/explorer" 
              class="text-gray-300 hover:text-white transition-colors"
              active-class="text-green-400"
            >
              Blockchain Explorer
            </router-link>
            <router-link 
              to="/devices" 
              class="text-gray-300 hover:text-white transition-colors"
              active-class="text-green-400"
            >
              Devices
            </router-link>
          </nav>

          <!-- Connection Status -->
          <div class="flex items-center space-x-4">
            <div class="flex items-center space-x-2">
              <div 
                class="w-2 h-2 rounded-full"
                :class="connectionStatus.connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'"
              ></div>
              <span class="text-sm" :class="connectionStatus.connected ? 'text-green-400' : 'text-red-400'">
                {{ connectionStatus.connected ? 'Connected' : 'Disconnected' }}
              </span>
            </div>
            
            <!-- Block Height -->
            <div class="hidden lg:block px-3 py-1 bg-gray-700 rounded-lg">
              <span class="text-xs text-gray-400">Block Height:</span>
              <span class="ml-2 font-mono text-green-400">{{ connectionStatus.blockHeight }}</span>
            </div>
          </div>
        </div>
      </div>
    </header>

    <!-- Mobile Navigation -->
    <nav class="md:hidden bg-gray-800 border-b border-gray-700">
      <div class="flex justify-around py-2">
        <router-link 
          to="/" 
          class="text-center text-sm text-gray-300 hover:text-white"
          active-class="text-green-400"
        >
          <div>Dashboard</div>
        </router-link>
        <router-link 
          to="/explorer" 
          class="text-center text-sm text-gray-300 hover:text-white"
          active-class="text-green-400"
        >
          <div>Explorer</div>
        </router-link>
        <router-link 
          to="/devices" 
          class="text-center text-sm text-gray-300 hover:text-white"
          active-class="text-green-400"
        >
          <div>Devices</div>
        </router-link>
      </div>
    </nav>

    <!-- Main Content -->
    <main class="container mx-auto px-4 py-6">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>

    <!-- Footer -->
    <footer class="bg-gray-800 border-t border-gray-700 mt-auto">
      <div class="container mx-auto px-4 py-4">
        <div class="flex flex-col md:flex-row justify-between items-center text-sm text-gray-400">
          <div>
            Smart Garden IoT Dashboard v1.0.0
          </div>
          <div class="mt-2 md:mt-0">
            Powered by Hyperledger Sawtooth PBFT
          </div>
        </div>
      </div>
    </footer>

    <!-- Global Notification -->
    <transition name="slide-up">
      <div 
        v-if="notification.show" 
        class="fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg"
        :class="notification.type === 'success' ? 'bg-green-600' : 'bg-red-600'"
      >
        {{ notification.message }}
      </div>
    </transition>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted } from 'vue'
import { useConnectionStore } from '@/stores/connection'

const connectionStore = useConnectionStore()

const connectionStatus = computed(() => ({
  connected: connectionStore.connected,
  blockHeight: connectionStore.blockHeight
}))

const notification = computed(() => connectionStore.notification)

// Setup WebSocket connection
let ws = null

function setupWebSocket() {
  try {
    // Connect to WebSocket server
    const wsUrl = `ws://${window.location.hostname}:3001/ws`
    ws = new WebSocket(wsUrl)
    
    ws.onopen = () => {
      console.log('WebSocket connected')
      connectionStore.setConnected(true)
    }
    
    ws.onclose = () => {
      console.log('WebSocket disconnected')
      connectionStore.setConnected(false)
      // Reconnect after 5 seconds
      setTimeout(setupWebSocket, 5000)
    }
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      connectionStore.setConnected(false)
    }
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        handleWebSocketMessage(data)
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error)
      }
    }
    
  } catch (error) {
    console.error('WebSocket setup failed:', error)
  }
}

function handleWebSocketMessage(data) {
  switch (data.type) {
    case 'NEW_BLOCK':
      connectionStore.updateBlockHeight(data.data.blockNumber)
      connectionStore.showNotification(
        `New block #${data.data.blockNumber} committed`,
        'success'
      )
      break
      
    case 'DEVICE_UPDATE':
      // Device state updated
      break
      
    case 'PUMP_ACTIVATED':
      connectionStore.showNotification(
        `Smart Contract: Pump activated (Humidity: ${data.data.humidity}%)`,
        'warning'
      )
      break
      
    default:
      console.log('Unknown event type:', data.type)
  }
}

onMounted(() => {
  setupWebSocket()
  connectionStore.fetchInitialData()
})

onUnmounted(() => {
  if (ws) {
    ws.close()
  }
})
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(20px);
}
</style>
