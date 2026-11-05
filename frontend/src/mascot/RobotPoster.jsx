import { useTheme } from '../theme/useTheme'

// A snapshot of the 3D robot (public/robot-poster-*.webp). Shown while the 3D scene downloads, so the placeholder
// already looks like the live robot, and as the fallback if WebGL cannot start. Height-fit and centred like the camera.
export default function RobotPoster({ gone = false }) {
  const { resolved } = useTheme()
  return <img className={`mascot-poster ${gone ? 'is-gone' : ''}`} src={`/robot-poster-${resolved === 'dark' ? 'dark' : 'light'}.webp`} alt="" aria-hidden width="791" height="800" decoding="async" fetchpriority="high" draggable="false" />
}
