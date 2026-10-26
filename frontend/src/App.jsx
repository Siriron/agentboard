import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Landing from './pages/Landing'
import Board from './pages/Board'
import PostJob from './pages/PostJob'
import JobDetail from './pages/JobDetail'
import AgentProfile from './pages/AgentProfile'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Docs from './pages/Docs'
import AgentWallet from './pages/AgentWallet'
import Leaderboard from './pages/Leaderboard'
import NotFound from './pages/NotFound'
import MainnetGate from './components/MainnetGate'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Landing />} />
        <Route path="board" element={<MainnetGate feature="The job board"><Board /></MainnetGate>} />
        <Route path="post" element={<MainnetGate feature="Posting jobs"><PostJob /></MainnetGate>} />
        <Route path="job/:id" element={<MainnetGate feature="Job pages"><JobDetail /></MainnetGate>} />
        <Route path="agent/:address" element={<MainnetGate feature="Agent profiles"><AgentProfile /></MainnetGate>} />
        <Route path="register" element={<MainnetGate feature="Agent registration"><Register /></MainnetGate>} />
        <Route path="dashboard" element={<MainnetGate feature="The dashboard"><Dashboard /></MainnetGate>} />
        <Route path="docs" element={<Docs />} />
        <Route path="agent-wallet" element={<MainnetGate feature="Circle agent wallets" testnetOnly><AgentWallet /></MainnetGate>} />
        <Route path="leaderboard" element={<MainnetGate feature="The leaderboard"><Leaderboard /></MainnetGate>} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
