import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export const useBlocksStore = defineStore('blocks', () => {
  // State
  const blocks = ref([])
  const selectedBlock = ref(null)
  const loading = ref(false)
  const error = ref(null)
  const hasMore = ref(true)

  // Getters
  const latestBlocks = computed(() => 
    blocks.value.slice(0, 20)
  )

  const totalTransactions = computed(() => 
    blocks.value.reduce((sum, block) => sum + (block.transactionCount || 0), 0)
  )

  // Actions
  async function fetchBlocks(limit = 50, offset = 0) {
    loading.value = true
    error.value = null
    
    try {
      const response = await axios.get(`${API_BASE}/api/blocks`, {
        params: { limit, offset },
        timeout: 5000
      })
      
      if (offset === 0) {
        blocks.value = response.data
      } else {
        blocks.value = [...blocks.value, ...response.data]
      }
      
      // Check if there are more blocks
      hasMore.value = response.data.length === limit
      
    } catch (err) {
      console.error('Failed to fetch blocks:', err.message)
      error.value = err.message
    } finally {
      loading.value = false
    }
  }

  async function fetchBlock(blockId) {
    loading.value = true
    error.value = null
    
    try {
      const response = await axios.get(`${API_BASE}/api/blocks/${blockId}`)
      selectedBlock.value = response.data
      return response.data
    } catch (err) {
      console.error('Failed to fetch block:', err.message)
      error.value = err.message
      return null
    } finally {
      loading.value = false
    }
  }

  async function fetchBlockTransactions(blockId) {
    try {
      const block = blocks.value.find(b => b.blockId === blockId)
      if (block && block.transactions) {
        return block.transactions
      }
      
      const response = await axios.get(`${API_BASE}/api/blocks/${blockId}/transactions`)
      return response.data
    } catch (err) {
      console.error('Failed to fetch block transactions:', err.message)
      return []
    }
  }

  function addBlock(block) {
    // Check if block already exists
    const exists = blocks.value.find(b => b.blockId === block.blockId)
    if (!exists) {
      // Add to beginning of array
      blocks.value = [block, ...blocks.value]
      
      // Keep only first 100 blocks in memory
      if (blocks.value.length > 100) {
        blocks.value = blocks.value.slice(0, 100)
      }
    }
  }

  function setSelectedBlock(block) {
    selectedBlock.value = block
  }

  function clearBlocks() {
    blocks.value = []
    selectedBlock.value = null
    hasMore.value = true
  }

  return {
    // State
    blocks,
    selectedBlock,
    loading,
    error,
    hasMore,
    // Getters
    latestBlocks,
    totalTransactions,
    // Actions
    fetchBlocks,
    fetchBlock,
    fetchBlockTransactions,
    addBlock,
    setSelectedBlock,
    clearBlocks
  }
})
