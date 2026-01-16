<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-bold">Blockchain Explorer</h2>
        <p class="text-gray-400">View and explore the distributed ledger</p>
      </div>
      <div class="flex items-center space-x-4">
        <button 
          @click="refreshBlocks" 
          class="btn btn-primary flex items-center space-x-2"
          :disabled="loading"
        >
          <svg class="w-4 h-4" :class="{ 'animate-spin': loading }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
          <span>Refresh</span>
        </button>
      </div>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div class="card">
        <p class="stat-label">Total Blocks</p>
        <p class="stat-value">{{ blocksStore.blocks.length }}</p>
      </div>
      <div class="card">
        <p class="stat-label">Total Transactions</p>
        <p class="stat-value">{{ blocksStore.totalTransactions }}</p>
      </div>
      <div class="card">
        <p class="stat-label">Latest Block</p>
        <p class="stat-value text-green-400">#{{ latestBlockNumber }}</p>
      </div>
      <div class="card">
        <p class="stat-label">Network Status</p>
        <p class="stat-value" :class="connectionStore.connected ? 'text-green-400' : 'text-red-400'">
          {{ connectionStore.connected ? 'Connected' : 'Disconnected' }}
        </p>
      </div>
    </div>

    <!-- Block List -->
    <div class="card">
      <div class="card-header">
        Blocks
      </div>
      
      <!-- Table -->
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-gray-700">
            <tr>
              <th class="table-header table-cell">Block #</th>
              <th class="table-header table-cell">Block ID</th>
              <th class="table-header table-cell">Previous Hash</th>
              <th class="table-header table-cell">Transactions</th>
              <th class="table-header table-cell">Created</th>
              <th class="table-header table-cell">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-700">
            <tr 
              v-for="block in blocksStore.blocks" 
              :key="block.blockId"
              class="hover:bg-gray-700 cursor-pointer transition-colors"
              :class="{ 'bg-blue-900/30': selectedBlock?.blockId === block.blockId }"
              @click="selectBlock(block)"
            >
              <td class="table-cell">
                <span class="font-mono text-blue-400">#{{ block.blockNumber }}</span>
              </td>
              <td class="table-cell">
                <span class="font-mono text-xs">{{ truncateHash(block.blockId) }}</span>
              </td>
              <td class="table-cell">
                <span class="font-mono text-xs text-gray-500">{{ truncateHash(block.previousBlockId) }}</span>
              </td>
              <td class="table-cell">
                <span class="px-2 py-1 bg-gray-600 rounded text-sm">
                  {{ block.transactionCount }}
                </span>
              </td>
              <td class="table-cell text-gray-400">
                {{ formatTime(block.createdAt) }}
              </td>
              <td class="table-cell">
                <button 
                  @click.stop="viewBlockDetails(block)"
                  class="text-green-400 hover:text-green-300"
                >
                  View
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        
        <div v-if="blocksStore.blocks.length === 0 && !loading" class="text-center py-12 text-gray-500">
          <svg class="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
          </svg>
          <p>No blocks found</p>
          <p class="text-sm mt-2">Wait for the blockchain to produce blocks</p>
        </div>
        
        <div v-if="loading" class="text-center py-12">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto"></div>
          <p class="mt-4 text-gray-400">Loading blocks...</p>
        </div>
      </div>
    </div>

    <!-- Block Details Modal -->
    <div 
      v-if="showBlockModal" 
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      @click.self="closeBlockModal"
    >
      <div class="bg-gray-800 rounded-lg w-full max-w-4xl max-h-[80vh] overflow-hidden">
        <div class="p-6 border-b border-gray-700 flex items-center justify-between">
          <h3 class="text-xl font-bold">Block #{{ selectedBlock?.blockNumber }} Details</h3>
          <button @click="closeBlockModal" class="text-gray-400 hover:text-white">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        
        <div class="p-6 overflow-y-auto max-h-[60vh]">
          <!-- Block Info -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label class="text-sm text-gray-400">Block ID</label>
              <p class="font-mono text-sm bg-gray-900 p-2 rounded break-all">{{ selectedBlock?.blockId }}</p>
            </div>
            <div>
              <label class="text-sm text-gray-400">Previous Block ID</label>
              <p class="font-mono text-sm bg-gray-900 p-2 rounded break-all">{{ selectedBlock?.previousBlockId }}</p>
            </div>
            <div>
              <label class="text-sm text-gray-400">State Root Hash</label>
              <p class="font-mono text-sm bg-gray-900 p-2 rounded break-all">{{ selectedBlock?.stateRootHash }}</p>
            </div>
            <div>
              <label class="text-sm text-gray-400">Batch Count</label>
              <p class="text-lg font-bold">{{ selectedBlock?.batchCount }}</p>
            </div>
          </div>

          <!-- Transactions -->
          <h4 class="text-lg font-semibold mb-3">Transactions ({{ selectedBlock?.transactions?.length || 0 }})</h4>
          <div class="space-y-3">
            <div 
              v-for="tx in selectedBlock?.transactions" 
              :key="tx.transactionId"
              class="bg-gray-700 rounded-lg p-4"
            >
              <div class="flex items-center justify-between mb-2">
                <span class="font-mono text-xs text-blue-400">{{ truncateHash(tx.transactionId) }}</span>
                <span 
                  class="px-2 py-1 rounded text-xs"
                  :class="tx.action === 'SEND_TELEMETRY' ? 'bg-green-900 text-green-300' : 'bg-purple-900 text-purple-300'"
                >
                  {{ tx.action }}
                </span>
              </div>
              <div class="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span class="text-gray-400">Device:</span>
                  <span class="ml-2">{{ tx.deviceId || 'N/A' }}</span>
                </div>
                <div>
                  <span class="text-gray-400">Signer:</span>
                  <span class="ml-2 font-mono text-xs">{{ truncateHash(tx.signerPublicKey) }}</span>
                </div>
              </div>
              <div v-if="tx.payload" class="mt-2 text-xs bg-gray-900 p-2 rounded">
                <pre class="break-all">{{ JSON.stringify(tx.payload, null, 2) }}</pre>
              </div>
            </div>
            <div v-if="!selectedBlock?.transactions?.length" class="text-center py-4 text-gray-500">
              No transactions in this block
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useBlocksStore } from '@/stores/blocks'
import { useConnectionStore } from '@/stores/connection'

const blocksStore = useBlocksStore()
const connectionStore = useConnectionStore()

const showBlockModal = ref(false)
const selectedBlock = ref(null)
const loading = ref(false)

// Computed
const latestBlockNumber = computed(() => {
  if (blocksStore.blocks.length === 0) return 0
  return blocksStore.blocks[0].blockNumber
})

// Methods
function truncateHash(hash) {
  if (!hash) return ''
  if (hash.length <= 16) return hash
  return hash.substring(0, 8) + '...' + hash.substring(hash.length - 6)
}

function formatTime(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleString()
}

async function refreshBlocks() {
  loading.value = true
  try {
    await blocksStore.fetchBlocks(50)
    connectionStore.showNotification('Blocks refreshed', 'success')
  } catch (error) {
    connectionStore.showNotification('Failed to refresh blocks', 'error')
  } finally {
    loading.value = false
  }
}

function selectBlock(block) {
  selectedBlock.value = block
}

function viewBlockDetails(block) {
  selectedBlock.value = block
  showBlockModal.value = true
}

function closeBlockModal() {
  showBlockModal.value = false
  selectedBlock.value = null
}

// Periodic refresh
let refreshInterval = null

onMounted(() => {
  refreshBlocks()
  
  refreshInterval = setInterval(() => {
    blocksStore.fetchBlocks(50)
  }, 15000)
})

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
})
</script>
