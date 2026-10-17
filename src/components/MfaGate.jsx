import React, { useEffect, useState } from 'react';
import { ArrowLeft, Lock, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function MfaGate({ onComplete, onSignOut }) {
  const [factor, setFactor] = useState(null);
  const [enrollment, setEnrollment] = useState(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  useEffect(() => {
    let active = true;
    supabase.auth.mfa.listFactors().then(({ data, error: err }) => {
      if (!active) return;
      if (err) setError(err.message);
      setFactor(data?.totp?.find(f => f.status === 'verified') || null);
      setBusy(false);
    });
    return () => { active = false; };
  }, []);
  const startEnroll = async () => {
    setBusy(true); setError('');
    const { data, error: err } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Kawalpreet Studio' });
    if (err) setError(err.message); else setEnrollment(data);
    setBusy(false);
  };
  const verify = async (event) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) { setError('Enter the six-digit code from your authenticator app.'); return; }
    setBusy(true); setError('');
    const factorId = factor?.id || enrollment?.id;
    const { error: err } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    if (err) { setError(err.message); setCode(''); } else {
      const {data:level,error:levelError} = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if(levelError || level?.currentLevel !== 'aal2') setError('MFA was not fully activated. Please retry.');
      else onComplete();
    }
    setBusy(false);
  };
  return <div className="studio-login"><div className="login-card mfa-card"><div className="login-logo">K.</div><span className="admin-eyebrow">ACCOUNT SECURITY</span><h1>One more step.<br/><em>Keep your work safe.</em></h1><p>Two-factor authentication is required before editing the portfolio or reading private enquiries.</p>
    {busy && !enrollment && !factor ? <p>Checking your security settings…</p> : <>
      {!factor && !enrollment && <button type="button" className="admin-btn primary full" onClick={startEnroll} disabled={busy}><ShieldCheck size={17}/> Set up authenticator app</button>}
      {enrollment && <div className="mfa-setup"><p>Scan this QR code with Google Authenticator, Microsoft Authenticator, 1Password, or another TOTP app.</p><img className="mfa-qr" src={enrollment.totp.qr_code} alt="Authenticator setup QR code"/><p>Can't scan? Enter this key manually:</p><code className="mfa-secret">{enrollment.totp.secret}</code></div>}
      {(factor || enrollment) && <form onSubmit={verify}><label className="studio-field"><span>6-digit authenticator code</span><input value={code} onChange={e => setCode(e.target.value.replace(/\D/g,'').slice(0,6))} autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" required placeholder="123456" /></label><button type="submit" className="admin-btn primary full" disabled={busy}>{busy ? 'Verifying…' : factor ? 'Verify and enter Studio' : 'Activate MFA and continue'} <Lock size={16}/></button></form>}
    </>}
    {error && <p className="form-message error" role="alert">{error}</p>}
    <button type="button" className="reset-link" onClick={onSignOut}><ArrowLeft size={14}/> Sign out</button>
    <div className="login-foot"><Lock size={14}/> Keep your authenticator and account recovery method secure.</div>
  </div></div>;
}
