import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Wallet, Bot, X, ArrowRight, Sparkles } from 'lucide-react'
import { useWallet } from '../hooks/useWallet'
import { formatAddress } from '../lib/arc'

export default function WalletPickerModal() {
  const {
    pickerOpen, closePicker,
    account, connectBrowser, connecting,
    agentWallet, useAgentWallet, activeMode,
    availableProviders, providerUuid,
  } = useWallet()
  const navigate = useNavigate()

  useEffect(() => {
    if (!pickerOpen) return
    function onKey(e) { if (e.key === 'Escape') closePicker() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pickerOpen, closePicker])

  if (!pickerOpen) return null

  async function pickBrowser(uuid) {
    await connectBrowser(uuid)
    closePicker()
  }

  function pickAgent() {
    if (useAgentWallet()) closePicker()
  }

  function goCreateAgentWallet() {
    closePicker()
    navigate('/agent-wallet')
  }

  return (
    <div
      onClick={closePicker}
      style={{
        position: 'fixed', inset: 0, zIndex: 999,
        background: 'rgba(20,15,40,0.45)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 420, background: '#fff',
          border: '1.5px solid var(--border)', borderRadius: 20,
          boxShadow: '0 20px 60px rgba(20,15,40,0.25)',
          overflow: 'hidden',
        }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 22px 14px' }}>
          <div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 19, letterSpacing: '-0.02em', color: 'var(--text-1)', margin: 0 }}>Connect Wallet</h3>
            <p style={{ fontSize: 13, color: 'var(--text-1)', opacity: 0.45, margin: '4px 0 0' }}>Choose how you want to sign transactions</p>
          </div>
          <button onClick={closePicker} aria-label="Close" style={{
            background: 'var(--bg-subtle)', border: '1.5px solid var(--border)',
            borderRadius: 9, width: 30, height: 30, display: 'flex',
            alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            color: 'var(--text-1)', opacity: 0.6, flexShrink: 0,
          }}>
            <X size={15} />
          </button>
        </div>

        <div style={{ padding: '4px 22px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Browser wallet option(s) — if more than one extension is
              installed (MetaMask + Bitget being the common case), list
              them by name instead of one ambiguous "Browser Wallet"
              button. Picking explicitly is what pins the exact provider
              used for every switch/add-chain and signing call afterwards,
              instead of guessing from window.ethereum. */}
          {availableProviders.length > 1 ? (
            availableProviders.map(({ info, provider }) => (
              <button key={info.uuid} onClick={() => pickBrowser(info.uuid)} disabled={connecting} style={{
                display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left',
                width: '100%', padding: '15px 16px', borderRadius: 14,
                border: providerUuid === info.uuid && activeMode === 'browser' ? '1.5px solid rgba(124,92,252,0.5)' : '1.5px solid var(--border)',
                background: providerUuid === info.uuid && activeMode === 'browser' ? 'var(--accent-dim)' : '#fff',
                cursor: connecting ? 'default' : 'pointer', fontFamily: 'var(--font-body)',
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 11, flexShrink: 0,
                  background: 'var(--accent-dim)', border: '1.5px solid rgba(124,92,252,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                }}>
                  {info.icon
                    ? <img src={info.icon} alt="" width={22} height={22} />
                    : <Wallet size={18} style={{ color: 'var(--accent)' }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--text-1)' }}>{info.name}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-1)', opacity: 0.45, marginTop: 1 }}>
                    {providerUuid === info.uuid && account ? `Connected · ${formatAddress(account)}` : 'Sign with a click'}
                  </div>
                </div>
                {connecting
                  ? <span className="spinner" style={{ width: 14, height: 14 }} />
                  : <ArrowRight size={15} style={{ color: 'var(--text-1)', opacity: 0.25, flexShrink: 0 }} />}
              </button>
            ))
          ) : (
            <button onClick={() => pickBrowser(availableProviders[0]?.info.uuid)} disabled={connecting} style={{
              display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left',
              width: '100%', padding: '15px 16px', borderRadius: 14,
              border: activeMode === 'browser' ? '1.5px solid rgba(124,92,252,0.5)' : '1.5px solid var(--border)',
              background: activeMode === 'browser' ? 'var(--accent-dim)' : '#fff',
              cursor: connecting ? 'default' : 'pointer', fontFamily: 'var(--font-body)',
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 11, flexShrink: 0,
                background: 'var(--accent-dim)', border: '1.5px solid rgba(124,92,252,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)',
              }}>
                <Wallet size={18} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--text-1)' }}>
                  {availableProviders[0]?.info.name || 'Browser Wallet'}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-1)', opacity: 0.45, marginTop: 1 }}>
                  {account ? `Connected · ${formatAddress(account)}` : 'MetaMask, Rabby — sign with a click'}
                </div>
              </div>
              {connecting
                ? <span className="spinner" style={{ width: 14, height: 14 }} />
                : <ArrowRight size={15} style={{ color: 'var(--text-1)', opacity: 0.25, flexShrink: 0 }} />}
            </button>
          )}

          {/* Agent wallet option */}
          {agentWallet ? (
            <button onClick={pickAgent} style={{
              display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left',
              width: '100%', padding: '15px 16px', borderRadius: 14,
              border: activeMode === 'agent' ? '1.5px solid rgba(244,114,182,0.5)' : '1.5px solid var(--border)',
              background: activeMode === 'agent' ? 'var(--pink-dim)' : '#fff',
              cursor: 'pointer', fontFamily: 'var(--font-body)',
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 11, flexShrink: 0,
                background: 'var(--pink-dim)', border: '1.5px solid var(--pink-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--pink)',
              }}>
                <Bot size={18} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--text-1)' }}>Agent Wallet</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-1)', opacity: 0.45, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {formatAddress(agentWallet.address)} · no signing popups
                </div>
              </div>
              <ArrowRight size={15} style={{ color: 'var(--text-1)', opacity: 0.25, flexShrink: 0 }} />
            </button>
          ) : (
            <button onClick={goCreateAgentWallet} style={{
              display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left',
              width: '100%', padding: '15px 16px', borderRadius: 14,
              border: '1.5px dashed var(--border)', background: 'var(--bg-subtle)',
              cursor: 'pointer', fontFamily: 'var(--font-body)',
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 11, flexShrink: 0,
                background: '#fff', border: '1.5px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-1)', opacity: 0.4,
              }}>
                <Bot size={18} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--text-1)' }}>Create an Agent Wallet</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-1)', opacity: 0.45, marginTop: 1 }}>
                  For agents that bid & work without a browser
                </div>
              </div>
              <Sparkles size={14} style={{ color: 'var(--pink)', flexShrink: 0 }} />
            </button>
          )}

        </div>

        <div style={{ padding: '0 22px 20px', fontSize: 11.5, color: 'var(--text-1)', opacity: 0.35, lineHeight: 1.55 }}>
          Browser Wallet signs with a MetaMask-style popup each time. Agent Wallet signs instantly through Circle — pick it when you're acting as your own registered agent.
        </div>
      </div>
    </div>
  )
}
