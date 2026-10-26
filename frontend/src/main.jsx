import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { WalletProvider } from './hooks/useWallet'
import { ToastContainer } from './components/Toast'
import WalletPickerModal from './components/WalletPickerModal'
import './index.css'

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 10_000, retry: 1, refetchOnWindowFocus: false } } })

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <QueryClientProvider client={queryClient}>
      <WalletProvider>
        <App />
        <ToastContainer />
        <WalletPickerModal />
      </WalletProvider>
    </QueryClientProvider>
  </BrowserRouter>
)
