import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../services/api'
import './IcannLookupModal.css'

function formatDate(iso) {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString()
}

function ContactBlock({ title, contacts }) {
  if (!contacts || contacts.length === 0) {
    return (
      <div className="icann-block">
        <div className="icann-block-title">{title}</div>
        <div className="icann-muted">No data available (often redacted by registries).</div>
      </div>
    )
  }

  return (
    <div className="icann-block">
      <div className="icann-block-title">{title}</div>
      <div className="icann-block-body">
        {contacts.map((c, idx) => (
          <div key={idx} className="icann-contact">
            <div className="icann-contact-row">
              <span className="icann-label">Name</span>
              <span className="icann-value">{c.name || '-'}</span>
            </div>
            <div className="icann-contact-row">
              <span className="icann-label">Org</span>
              <span className="icann-value">{c.organization || '-'}</span>
            </div>
            <div className="icann-contact-row">
              <span className="icann-label">Email</span>
              <span className="icann-value">{c.emails && c.emails.length ? c.emails.join(', ') : '-'}</span>
            </div>
            <div className="icann-contact-row">
              <span className="icann-label">Phone</span>
              <span className="icann-value">{c.phones && c.phones.length ? c.phones.join(', ') : '-'}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function IcannLookupModal({ isOpen, domain, onClose }) {
  const [activeTab, setActiveTab] = useState('domain') // domain | registrar | contacts
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState(null)

  const title = useMemo(() => domain ? `ICANN / RDAP: ${domain}` : 'ICANN / RDAP', [domain])

  useEffect(() => {
    if (!isOpen) return
    setActiveTab('domain')
    setError('')
    setData(null)

    if (!domain) {
      setError('No domain provided.')
      return
    }

    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const result = await api.getRdap(domain)
        if (cancelled) return
        if (!result.found) {
          setError('No RDAP record found for this domain.')
          setData(null)
        } else {
          setData(result.rdap)
        }
      } catch (e) {
        if (cancelled) return
        setError(e.message || 'RDAP lookup failed')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [isOpen, domain])

  if (!isOpen) return null

  return (
    <div className="icann-overlay" onClick={onClose}>
      <div className="icann-window" onClick={(e) => e.stopPropagation()}>
        <div className="icann-header">
          <h2>{title}</h2>
          <button className="icann-close" onClick={onClose} title="Close">×</button>
        </div>

        <div className="icann-tabs">
          <button className={`icann-tab ${activeTab === 'domain' ? 'active' : ''}`} onClick={() => setActiveTab('domain')}>
            Domain
          </button>
          <button className={`icann-tab ${activeTab === 'registrar' ? 'active' : ''}`} onClick={() => setActiveTab('registrar')}>
            Registrar
          </button>
          <button className={`icann-tab ${activeTab === 'contacts' ? 'active' : ''}`} onClick={() => setActiveTab('contacts')}>
            Contacts
          </button>
        </div>

        <div className="icann-content">
          {loading && <div className="icann-muted">Loading RDAP data…</div>}
          {!loading && error && <div className="icann-error">{error}</div>}

          {!loading && !error && data && activeTab === 'domain' && (
            <div className="icann-grid">
              <div className="icann-row">
                <span className="icann-label">Domain</span>
                <span className="icann-value">{data.domain || '-'}</span>
              </div>
              <div className="icann-row">
                <span className="icann-label">Unicode</span>
                <span className="icann-value">{data.unicodeName || '-'}</span>
              </div>
              <div className="icann-row">
                <span className="icann-label">Status</span>
                <span className="icann-value">{data.statuses && data.statuses.length ? data.statuses.join(', ') : '-'}</span>
              </div>
              <div className="icann-row">
                <span className="icann-label">Registered</span>
                <span className="icann-value">{formatDate(data.events?.registration)}</span>
              </div>
              <div className="icann-row">
                <span className="icann-label">Updated</span>
                <span className="icann-value">{formatDate(data.events?.lastChanged)}</span>
              </div>
              <div className="icann-row">
                <span className="icann-label">Expires</span>
                <span className="icann-value">{formatDate(data.events?.expiration)}</span>
              </div>
              <div className="icann-row">
                <span className="icann-label">Nameservers</span>
                <span className="icann-value">{data.nameservers && data.nameservers.length ? data.nameservers.join(', ') : '-'}</span>
              </div>
            </div>
          )}

          {!loading && !error && data && activeTab === 'registrar' && (
            <div className="icann-grid">
              <div className="icann-row">
                <span className="icann-label">Registrar</span>
                <span className="icann-value">{data.registrar?.name || '-'}</span>
              </div>
              <div className="icann-row">
                <span className="icann-label">IANA ID</span>
                <span className="icann-value">{data.registrar?.ianaId || '-'}</span>
              </div>
              <div className="icann-muted">
                Some registries provide limited registrar/contact details via RDAP.
              </div>
            </div>
          )}

          {!loading && !error && data && activeTab === 'contacts' && (
            <div className="icann-contacts">
              <ContactBlock title="Registrant" contacts={data.contacts?.registrant} />
              <ContactBlock title="Administrative" contacts={data.contacts?.administrative} />
              <ContactBlock title="Technical" contacts={data.contacts?.technical} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default IcannLookupModal

