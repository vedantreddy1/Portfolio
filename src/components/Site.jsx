import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, Check, ChevronDown, CirclePlay, Clapperboard, Instagram, Mail, Menu, Play, Plane, Send, Smartphone, Sparkles, Utensils, Video, X } from 'lucide-react';
import { cleanUrl, isConfigured, safeAsset, safeLink, youtubeEmbed } from '../lib/supabase';
import Turnstile from './Turnstile';

const SERVICES_ICONS = { Video, Clapperboard, Utensils, Plane, Sparkles, Smartphone };
const PALETTES = ['peach', 'lilac', 'sage', 'rose', 'blue', 'amber'];
const social = (url) => cleanUrl(url) || '#contact';

function BrandMark({ brand }) {
  return <div className="brandmark">
    {safeAsset(brand.logoUrl) ? <img src={safeAsset(brand.logoUrl)} alt={brand.name} loading="lazy" /> : <span>{brand.name}</span>}
  </div>;
}

function ProjectVisual({ item, index = 0, large = false }) {
  const src = safeAsset(item.coverUrl);
  return <div className={`project-visual palette-${item.palette || PALETTES[index % PALETTES.length]} ${large ? 'is-large' : ''}`}>
    {src ? <img className="project-image" src={src} alt={item.title || 'Project'} loading="lazy" /> : <div className="visual-decor" aria-hidden="true"><span className="decor-ring ring-1"/><span className="decor-ring ring-2"/><span className="decor-type">{index % 3 === 0 ? 'story' : index % 3 === 1 ? 'mood' : 'create'}</span><span className="decor-spark">✳</span></div>}
    {item.placeholder ? <span className="work-ribbon">PREVIEW SLOT · ADD REAL WORK</span> : <span className="visual-play"><Play size={19} fill="currentColor" strokeWidth={1.6}/></span>}
    <div className="visual-bottom"><span> {item.format || 'Creative content'} </span><span className="visual-bottom-arrow"><ArrowUpRight size={17}/></span></div>
  </div>;
}

function ProjectModal({ item, onClose }) {
  if (!item) return null;
  const yt = youtubeEmbed(item.videoUrl);
  const video = safeAsset(item.videoUrl);
  const mp4 = /\.(mp4|webm|ogg)(?:[?#]|$)/i.test(video);
  return <div className="overlay" onMouseDown={onClose} role="presentation"><div className="work-modal" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label={item.title}>
    <button className="modal-close" onClick={onClose} aria-label="Close project"><X size={21}/></button>
    <div className="modal-media">
      {yt ? <iframe title={item.title} src={yt} allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /> : mp4 ? <video src={video} poster={safeAsset(item.coverUrl)} controls playsInline /> : <ProjectVisual item={item} large />}
    </div>
    <div className="modal-details"><span className="eyebrow">{item.category} / {item.format}</span><h3>{item.title}</h3><p>{item.description}</p>{item.brand && <p><strong>Brand:</strong> {item.brand}</p>}{item.result && <div className="result-chip">{item.result}</div>}{video && !yt && !mp4 && <a className="text-link" href={video} target="_blank" rel="noopener noreferrer">View original content <ArrowUpRight size={16}/></a>}{!item.placeholder && <a className="text-link" href={`/work/${encodeURIComponent(item.id)}`}>Open full project page <ArrowUpRight size={16}/></a>}{item.placeholder && <p className="sample-disclaimer">This is a design preview, not a completed campaign. Replace it using the Studio.</p>}</div>
  </div></div>;
}

function Contact({ content }) {
  const { profile, contact } = content;
  const [status, setStatus] = useState({ type: '', text: '' });
  const [sending, setSending] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileReset, setTurnstileReset] = useState(0);
  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
  const [form, setForm] = useState({ name: '', email: '', company: '', service: 'UGC videos', message: '', website: '' });
  const availableServices = (content.services || []).map(s => s.title);
  const change = (key, value) => setForm(s => ({ ...s, [key]: value }));
  const submit = async (e) => {
    e.preventDefault();
    if (!isConfigured || !turnstileSiteKey) { setStatus({type:'error',text:'Enquiries are not configured. Please use Instagram to contact me.'}); return; }
    if (!turnstileToken) { setStatus({type:'error',text:'Please complete the security verification.'}); return; }
    if (form.website) { setStatus({ type: 'success', text: 'Thanks for your enquiry!' }); return; }
    if (form.message.trim().length < 10) { setStatus({ type: 'error', text: 'Please tell me a little more about your project (at least 10 characters).' }); return; }
    try {
      const key = 'kawalpreet-inquiry-last-sent';
      const recent = Number(localStorage.getItem(key) || 0);
      if (Date.now() - recent < 60000) throw new Error('Please wait a minute before sending another enquiry.');
      setSending(true); setStatus({type:'', text:''});
      const response = await fetch('/api/enquiry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, turnstileToken }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Could not send enquiry.');
      localStorage.setItem(key, String(Date.now()));
      setTurnstileToken('');
      setForm({ name:'', email:'', company:'', service:availableServices[0] || 'UGC videos', message:'', website:'' });
      setStatus({type:'success', text:'Thank you! Your enquiry has been received. I’ll get back to you soon.'});
    } catch (err) { setStatus({type:'error',text:err.message || 'Could not send your enquiry.'}); }
    finally { setSending(false); setTurnstileToken(''); setTurnstileReset(v=>v+1); }
  };
  return <section className="contact-section" id="contact">
    <div className="contact-container content-width"><div className="contact-copy"><span className="eyebrow light-eyebrow"><span className="eyebrow-line"/> YOUR IDEA + MY CREATIVE BRAIN</span><h2>{contact.heading || "Let's make something people remember."}</h2><p>{contact.subheading}</p><div className="contact-flourish">Let's create <span>magic.</span> <span className="flourish-star">✳</span></div>
      <div className="contact-socials">{profile.instagram && <a href={social(profile.instagram)} target="_blank" rel="noreferrer">Instagram <ArrowUpRight size={15}/></a>}{profile.youtube && <a href={social(profile.youtube)} target="_blank" rel="noreferrer">YouTube <ArrowUpRight size={15}/></a>}{profile.email && <a href={`mailto:${profile.email}`}>Email me <ArrowUpRight size={15}/></a>}</div>
    </div><div className="contact-panel"><div className="panel-top"><span>LET'S TALK ABOUT YOUR PROJECT</span><span className="availability-dot"/></div>
    {isConfigured && turnstileSiteKey ? <form onSubmit={submit} className="contact-form"><div className="two-inputs"><label>Your name<input value={form.name} onChange={e => change('name',e.target.value)} placeholder="Your name" required maxLength={100}/></label><label>Email address<input type="email" value={form.email} onChange={e => change('email',e.target.value)} placeholder="you@brand.com" required maxLength={200}/></label></div><div className="two-inputs"><label>Brand / company<input value={form.company} onChange={e => change('company',e.target.value)} placeholder="Your brand" maxLength={120}/></label><label>I'm interested in<select value={form.service} onChange={e => change('service',e.target.value)}>{(availableServices.length ? availableServices : ['UGC videos']).map(item => <option key={item}>{item}</option>)}</select></label></div><label>Tell me a little about your idea<textarea rows={4} value={form.message} onChange={e=>change('message',e.target.value)} placeholder="What's your brand, what are you dreaming up, and when do you need it?" required maxLength={3000}/></label><input aria-hidden="true" tabIndex={-1} autoComplete="off" className="hidden-honey" name="website" value={form.website} onChange={e => change('website', e.target.value)}/><Turnstile siteKey={turnstileSiteKey} onToken={setTurnstileToken} resetSignal={turnstileReset}/><button disabled={sending || !turnstileToken} className="btn btn-dark" type="submit">{sending ? 'Sending…' : contact.buttonText || 'Send an enquiry'} <Send size={17}/></button>{status.text && <p className={`form-message ${status.type}`} role="status">{status.text}</p>}<small>Project enquiries only. Your details are used to reply. See our <a href="/privacy">privacy notice</a>.</small></form> : <div className="contact-placeholder"><h3>Let's talk, shall we?</h3><p>For collaborations and brand enquiries, send me a message on Instagram.</p><a className="btn btn-dark" href={social(profile.instagram)} target="_blank" rel="noopener noreferrer">Message on Instagram <ArrowUpRight size={18}/></a><small>The enquiry form becomes available after the database and Turnstile verification are configured.</small></div>}
    </div></div>
  </section>;
}

export default function Site({ content, navigate, loadError }) {
  const { profile, metrics, projects, services, brands, advantages, testimonials, press, faqs } = content;
  const [filter, setFilter] = useState('All');
  useEffect(()=>{if(window.location.hash){const id=window.location.hash.slice(1);requestAnimationFrame(()=>document.getElementById(id)?.scrollIntoView({block:'start'}));}},[]);
  const [selected, setSelected] = useState(null);
  useEffect(()=>{if(!selected)return;const onKey=e=>{if(e.key==='Escape')setSelected(null);};document.addEventListener('keydown',onKey);return()=>document.removeEventListener('keydown',onKey);},[selected]);
  const [menuOpen, setMenuOpen] = useState(false);
  const visible = useMemo(() => (projects || []).filter(p => content.showPlaceholderWork || !p.placeholder).filter(p => filter === 'All' || p.category === filter), [projects, filter, content.showPlaceholderWork]);
  const jump = (id) => { setMenuOpen(false); document.getElementById(id)?.scrollIntoView({ behavior:'smooth', block:'start' }); };
  const profilePicture = safeAsset(profile.portraitUrl);
  const heroPhoto = safeAsset(profile.heroImageUrl);
  const currentCategories = ['All', ...new Set((projects||[]).filter(p=>content.showPlaceholderWork || !p.placeholder).map(p=>p.category).filter(Boolean))];
  return <div className="site-shell">
    <div className="announcement">CREATING THE KIND OF CONTENT PEOPLE ACTUALLY FEEL <span>✳</span> OPEN FOR BRAND COLLABORATIONS</div>
    <header className="site-header"><div className="content-width header-inner"><button onClick={()=>window.scrollTo({top:0,behavior:'smooth'})} className="brand-sign" aria-label="Back to top">K<span>.</span></button><nav className={menuOpen ? 'nav-links open' : 'nav-links'} aria-label="Main navigation"><button onClick={()=>jump('work')}>My work</button><button onClick={()=>jump('about')}>About me</button><button onClick={()=>jump('services')}>Services</button><button onClick={()=>jump('brands')}>Brands</button></nav><div className="header-actions"><button className="nav-cta" onClick={()=>jump('contact')}>Let's collaborate <ArrowUpRight size={16}/></button><button className="mobile-menu" aria-label={menuOpen?'Close menu':'Open menu'} onClick={()=>setMenuOpen(!menuOpen)}>{menuOpen ? <X size={23}/> : <Menu size={23}/>}</button></div></div></header>
    <main>
      <section className="hero" id="home"><div className="content-width hero-grid"><div className="hero-copy"><div className="eyebrow"><span className="eyebrow-line"/> {profile.eyebrow}</div><div className="hero-title-wrap"><h1>Hey, I'm<br/><em>{profile.shortName || 'Kawalpreet'}</em><span className="hero-period">.</span></h1><div className="hero-asterisk">✳</div></div><p className="hero-tagline">{profile.tagline}</p><p className="hero-intro">{profile.intro}</p><div className="hero-buttons"><button className="btn btn-primary" onClick={()=>jump('work')}>Explore my work <ArrowUpRight size={18}/></button><button className="btn btn-outline" onClick={()=>jump('contact')}>Work with me <ArrowRight size={18}/></button></div>{safeLink(profile.mediaKitUrl) && <a className="media-kit-link" href={safeLink(profile.mediaKitUrl)} target="_blank" rel="noopener noreferrer">View my media kit <ArrowUpRight size={15}/></a>}<div className="hero-meta"><div className="meta-avatars"><span>K</span><span>♥</span><span>✳</span></div><p><strong>{profile.availability || 'Open for collaborations'}</strong><br/>India · Wherever the story takes us</p></div></div>
      <div className="hero-art"><div className="art-orbit orbit-one"/><div className="art-orbit orbit-two"/><div className="art-primary"><div className="image-fill">{heroPhoto ? <img src={heroPhoto} alt={`Featured portrait or creative photograph of ${profile.name}`} fetchPriority="high" decoding="async"/> : profilePicture ? <img src={profilePicture} alt={profile.name} fetchPriority="high" decoding="async"/> : <div className="art-placeholder"><span className="art-small">A LITTLE BIT OF</span><span className="art-big">creative<br/><i>magic</i></span><span className="art-star">✹</span><small>ADD A PORTRAIT IN STUDIO</small></div>}</div><div className="art-sticker">made with<br/><strong>♥</strong><br/>& intention</div></div><div className="art-small-card"><span>BEHIND THE CONTENT</span><div><b>01</b><span>story<br/>at a time.</span></div><span className="art-card-star">✳</span></div><div className="art-caption">REAL STORIES<br/>GOOD ENERGY<br/>BIG IDEAS ↗</div></div></div><button className="hero-scroll" onClick={()=>jump('work')}>SCROLL TO EXPLORE <ArrowDown size={17}/></button></section>
      <section className="stats-strip"><div className="content-width stats-content">{(metrics || []).map(metric => <div className="stat-item" key={metric.id}><strong>{metric.value}</strong><span>{metric.label}</span></div>)}</div></section>
      <section className="work-section section-pad" id="work"><div className="content-width"><div className="section-top"><div><span className="eyebrow"><span className="eyebrow-line"/> THE CREATIVE ARCHIVE</span><h2 className="section-title">A little bit of <em>everything.</em></h2><p className="section-subtitle">From little everyday moments to big campaign ideas. Different stories, same obsession with making them feel real.</p></div><div className="section-index">01 / SELECTED WORK</div></div>
      {(projects || []).some(p => p.placeholder) && content.showPlaceholderWork && <div className="preview-note"><Sparkles size={16}/><span>Portfolio layout preview: cards marked “preview slot” are not real campaigns. Add approved work in the Studio before sharing with brands.</span></div>}
      <div className="filter-row" role="group" aria-label="Filter by category">{currentCategories.map(cat => <button key={cat} className={filter===cat ? 'filter active' : 'filter'} onClick={()=>setFilter(cat)}>{cat}</button>)}</div>
      <div className="work-grid">{visible.map((item,i)=><a key={item.id} href={item.placeholder ? "#work" : `/work/${encodeURIComponent(item.id)}`} className="work-card" onClick={event=>{if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();setSelected(item);}}><ProjectVisual item={item} index={i}/><div className="work-card-info"><div><span>{item.category}</span><h3>{item.title}</h3></div><div className="work-card-arrow"><ArrowUpRight size={21}/></div></div></a>)}</div>
      {!visible.length && <div className="empty-gallery">No published work in this category yet. Stay tuned.</div>}
      <div className="work-bottom-note">GOOD CONTENT DOESN'T INTERRUPT. IT CONNECTS. <span>✳</span></div></div></section>
      <section className="about-section section-pad" id="about"><div className="content-width about-layout"><div className="about-visual"><div className="about-frame">{profilePicture ? <img src={profilePicture} alt={`Portrait of ${profile.name}`} /> : <div className="about-placeholder"><span>HELLO, I'M</span><strong>{(profile.shortName||'Kawalpreet').toUpperCase()}</strong><em>nice to meet you!</em><span className="about-sun">✺</span></div>}</div><div className="about-side-label">CREATOR · STORYTELLER · HUMAN</div><div className="about-stamp">KEEP IT<br/><em>real.</em></div></div><div className="about-copy"><span className="eyebrow"><span className="eyebrow-line"/> THE PERSON BEHIND THE CAMERA</span><h2 className="section-title">Not just content.<br/><em>A connection.</em></h2><p className="about-lead">{profile.bio}</p><div className="about-advantages">{(advantages||[]).map((a,i)=><div className="advantage" key={a.id}><span>0{i+1}</span><div><h3>{a.title}</h3><p>{a.detail}</p></div></div>)}</div><button className="btn btn-text" onClick={()=>jump('contact')}>Let's tell your story <ArrowUpRight size={18}/></button></div></div></section>
      <section className="services-section section-pad" id="services"><div className="content-width"><div className="section-top services-heading"><div><span className="eyebrow"><span className="eyebrow-line"/> WAYS WE CAN CREATE TOGETHER</span><h2 className="section-title">Here's what I <em>do best.</em></h2></div><p>Strategic ideas, good storytelling, and a healthy obsession with the little details.</p></div><div className="services-grid">{(services||[]).map((svc,index)=>{ const Icon = SERVICES_ICONS[svc.icon] || Sparkles;return <article className="service-card" key={svc.id}><div className="service-card-top"><span>{svc.number || `0${index+1}`}</span><Icon size={25} strokeWidth={1.55}/></div><h3>{svc.title}</h3><p>{svc.description}</p><span className="service-card-arrow"><ArrowUpRight size={19}/></span></article>})}</div></div></section>
      <section className="brands-section section-pad" id="brands"><div className="content-width"><div className="brand-heading"><span className="eyebrow"><span className="eyebrow-line"/> GOOD COMPANY</span><h2 className="section-title">Brands I've <em>created with.</em></h2><p>Grateful for the brands that have trusted me to bring their stories to life.</p></div><div className="brands-grid">{(brands||[]).map(brand=><BrandMark brand={brand} key={brand.id}/>)}</div></div></section>
      {(press||[]).length > 0 && <section className="press-section"><div className="content-width press-inner"><div><span className="eyebrow"><span className="eyebrow-line"/> IN THE SPOTLIGHT</span><h2>Stories worth <em>sharing.</em></h2></div><div className="press-links">{press.map(item=><a key={item.id} href={cleanUrl(item.url)||"#about"} target="_blank" rel="noopener noreferrer"><span className="press-outlet">{item.outlet}</span><span><strong>{item.title}</strong><small>{item.description}</small></span><ArrowUpRight size={23}/></a>)}</div></div></section>}
      {testimonials?.length > 0 && <section className="testimonials-section section-pad"><div className="content-width"><span className="eyebrow"><span className="eyebrow-line"/> KIND WORDS</span><h2 className="section-title">Better <em>together.</em></h2><div className="testimonials-grid">{testimonials.map(t=><blockquote key={t.id}><span>“</span><p>{t.quote}</p><footer>{t.author}{t.role ? ` · ${t.role}` : ''}</footer></blockquote>)}</div></div></section>}
      {(faqs||[]).some(f=>f.question && f.answer) && <section className="faq-section section-pad" id="faq"><div className="content-width faq-layout"><div><span className="eyebrow"><span className="eyebrow-line"/> YOUR QUESTIONS, ANSWERED</span><h2 className="section-title">Good to <em>know.</em></h2><p className="section-subtitle">Helpful details for brands planning a collaboration.</p></div><div className="faq-items">{faqs.filter(f=>f.question && f.answer).map(f=><details key={f.id}><summary>{f.question}<ChevronDown size={20}/></summary><p>{f.answer}</p></details>)}</div></div></section>}
      <section className="statement-section"><div className="content-width"><span>LET'S MAKE SOMETHING</span><h2>scroll-stopping<span>✳</span><em>and soul-hitting.</em></h2><p>Not just seen. Remembered.</p></div></section>
      <Contact content={content} />
    </main><footer className="site-footer"><div className="content-width footer-main"><div><div className="footer-logo">K<span>.</span></div><p>Good stories. Real connections.<br/>Content with a little extra heart.</p></div><div className="footer-links"><button onClick={()=>jump('work')}>Work</button><button onClick={()=>jump('about')}>About</button><button onClick={()=>jump('services')}>Services</button><button onClick={()=>jump('contact')}>Contact</button></div><div className="footer-credits"><span>CREATED WITH INTENTION IN INDIA</span><span>© {new Date().getFullYear()} {profile.name}</span><a href="/privacy" className="footer-policy-link" onClick={event=>{event.preventDefault();navigate('/privacy');}}>Privacy</a></div></div><div className="content-width footer-bottom"><span>BE KIND. CREATE OFTEN. STAY CURIOUS.</span><button aria-label="Back to top" onClick={()=>window.scrollTo({top:0,behavior:'smooth'})}>BACK TO TOP ↑</button></div></footer>
    {selected && <ProjectModal item={selected} onClose={()=>setSelected(null)}/>} 
    {loadError && <div className="public-error" title={loadError}>Some live updates are unavailable. Showing cached portfolio details.</div>}
  </div>;
}
