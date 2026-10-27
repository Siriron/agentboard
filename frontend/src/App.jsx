import { lazy } from 'react'
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
import ProtocolSwitch from './components/ProtocolSwitch'

const V2Board = lazy(() => import('./v2/pages/V2Board'))
const V2Post = lazy(() => import('./v2/pages/V2Post'))
const V2Listing = lazy(() => import('./v2/pages/V2Listing'))
const V2Job = lazy(() => import('./v2/pages/V2Job'))
const V2Dashboard = lazy(() => import('./v2/pages/V2Dashboard'))
const V2Receipt = lazy(() => import('./v2/pages/V2Receipt'))
const V2Register = lazy(() => import('./v2/pages/V2Register'))
const V2Agent = lazy(() => import('./v2/pages/V2Agent'))

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Landing />} />
        <Route path="board" element={<ProtocolSwitch feature="The job board" v1={<Board />} v2={<V2Board />} />} />
        <Route path="post" element={<ProtocolSwitch feature="Posting jobs" v1={<PostJob />} v2={<V2Post />} />} />
        <Route path="listing/:id" element={<ProtocolSwitch feature="Listings" v2={<V2Listing />} />} />
        <Route path="receipt/:hash" element={<ProtocolSwitch feature="Receipts" v2={<V2Receipt />} />} />
        <Route path="job/:id" element={<ProtocolSwitch feature="Job pages" v1={<JobDetail />} v2={<V2Job />} />} />
        <Route path="agent/:address" element={<ProtocolSwitch feature="Agent profiles" v1={<AgentProfile />} v2={<V2Agent />} />} />
        <Route path="register" element={<ProtocolSwitch feature="Agent registration" v1={<Register />} v2={<V2Register />} />} />
        <Route path="dashboard" element={<ProtocolSwitch feature="The dashboard" v1={<Dashboard />} v2={<V2Dashboard />} />} />
        <Route path="docs" element={<Docs />} />
        <Route path="agent-wallet" element={<MainnetGate feature="Circle agent wallets" testnetOnly><AgentWallet /></MainnetGate>} />
        <Route path="leaderboard" element={<MainnetGate feature="The leaderboard" testnetOnly><Leaderboard /></MainnetGate>} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
