import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export const useConnectionStore = defineStore('connection', () => {
  // State
  const connected = ref(false)
  const blockHeight = ref(0)
  const validators = ref([])
  const notification = ref({
    show: false,
    message: '',
    type: 'success'
  })
  const loading = ref(false)
  const error = ref(null)

  // Getters
  const validatorCount = computed(() => validators.value.length)
  const onlineValidatorCount = computed(() => 
    validators.value.filter(v => v.status === 'online').length
  )

  // Actions
  function setConnected(status) {
    connected.value = status
  }

  function updateBlockHeight(height) {
    if (height > blockHeight.value) {
      blockHeight.value = height
    }
  }

  function updateValidatorStatus(validatorsData) {
    validators.value = validatorsData
  }

  function showNotification(message, type = 'success') {
    notification.value = {
      show: true,
      message,
      type
    }
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      notification.value.show = false
    }, 5000)
  }

  async function fetchValidatorStatus() {
    try {
      const response = await axios.get(`${API_BASE}/api/validators/status`, {
        timeout: 3000
      })
      updateValidatorStatus(response.data)
    } catch (err) {
      console.error('Failed to fetch validator status:', err.message)
      // Set default offline status for all validators
      updateValidatorStatus([
        { id: 0, name: 'validator-0', status: 'offline', port: 8008 },
        { id: 1, name: 'validator-1', status: 'offline', port: 8009 },
        { id: 2, name: 'validator-2', status: 'offline', port: 8010 },
        { id: 3, name: 'validator-3', status: 'offline', port: 8011 }
      ])
    }
  }

  async function fetchInitialData() {
    loading.value = true
    error.value = null
    
    try {
      // Fetch block height
      const blocksResponse = await axios.get(`${API_BASE}/api/blocks?limit=1`, {
        timeout: 5000
      })
      
      if (blocksResponse.data && blocksResponse.data.length > 0) {
        const latestBlock = blocksResponse.data[0]
        blockHeight.value = latestBlock.blockNumber || 0
      }
      
      // Fetch validator status
      await fetchValidatorStatus()
      
      connected.value = true
      
    } catch (err) {
      console.error('Failed to fetch initial data:', err.message)
      error.value = err.message
      connected.value = false
    } finally {
      loading.value = false
    }
  }

  return {
    // State
    connected,
    blockHeight,
    validators,
    notification,
    loading,
    error,
    // Getters
    validatorCount,
    onlineValidatorCount,
    // Actions
    setConnected,
    updateBlockHeight,
    updateValidatorStatus,
    showNotification,
    fetchValidatorStatus,
    fetchInitialData
  }
})
