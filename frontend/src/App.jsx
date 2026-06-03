import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Landing from './pages/Landing'
import Board from './pages/Board'
import PostJob from './pages/PostJob'
import JobDetail from './pages/JobDetail'
import AgentProfile from './pages/AgentProfile'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Landing />} />
        <Route path="board" element={<Board />} />
        <Route path="post" element={<PostJob />} />
        <Route path="job/:id" element={<JobDetail />} />
        <Route path="agent/:address" element={<AgentProfile />} />
        <Route path="register" element={<Register />} />
        <Route path="dashboard" element={<Dashboard />} />
      </Route>
    </Routes>
  )
}
