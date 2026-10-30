import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { WalletProvider } from './hooks/useWallet'
import { MainnetConfirmProvider } from './components/MainnetConfirm'
import { ToastContainer } from './components/Toast'
import WalletPickerModal from './components/WalletPickerModal'
import { initTheme } from './theme/theme'
import './index.css'
import './styles/tokens.css'
import './styles/base.css'

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 10_000, retry: 1, refetchOnWindowFocus: false } } })

initTheme()

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <QueryClientProvider client={queryClient}>
      <WalletProvider>
        <MainnetConfirmProvider>
        <App />
        <ToastContainer />
        <WalletPickerModal />
      </MainnetConfirmProvider>
      </WalletProvider>
    </QueryClientProvider>
  </BrowserRouter>
)
