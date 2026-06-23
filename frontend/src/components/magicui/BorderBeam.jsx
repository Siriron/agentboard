export function BorderBeam({
  className,
  size = 200,
  duration = 15,
  anchor = 90,
  borderWidth = 1.5,
  colorFrom = '#9945ff',
  colorTo = '#19fb9b',
  delay = 0,
}) {
  return (
    <div
      style={{
        '--bb-size': size,
        '--bb-duration': duration,
        '--bb-anchor': anchor,
        '--bb-border-width': borderWidth,
        '--bb-color-from': colorFrom,
        '--bb-color-to': colorTo,
        '--bb-delay': `-${delay}s`,
      }}
      className={['border-beam-fx', className].filter(Boolean).join(' ')}
    />
  )
}
