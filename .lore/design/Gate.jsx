/* global React, Icon */
const { useState, useEffect } = React;

function Gate({ onEnter }) {
  const [name, setName] = useState('');
  const [pass, setPass] = useState('');
  const [opening, setOpening] = useState(false);

  // Animated typewriter for the lede
  const lede = "Speak the watchword. The Keep remembers what you've already said.";
  const [typed, setTyped] = useState(0);
  useEffect(() => {
    if (typed >= lede.length) return;
    const t = setTimeout(() => setTyped(typed + 1), 22);
    return () => clearTimeout(t);
  }, [typed, lede.length]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (opening) return;
    setOpening(true);
    setTimeout(onEnter, 1500);
  };

  return (
    <div className={`gate ${opening ? 'opening' : ''}`}>
      <div className="gate-art"/>
      <div className="gate-doors" aria-hidden="true">
        <div className="door-leaf left">
          <div className="door-rivets"/>
          <div className="door-handle"/>
        </div>
        <div className="door-leaf right">
          <div className="door-rivets"/>
          <div className="door-handle"/>
        </div>
      </div>

      <div className="gate-card">
        <img className="gate-shield" src="assets/logo-shield-light.png" alt="" width="64" height="64"/>
        <div className="gate-eyebrow">✦ Oracle Keep</div>
        <h1 className="gate-title">Welcome back, traveler.</h1>
        <p className="gate-lede">
          {lede.slice(0, typed)}
          <span style={{ opacity: typed < lede.length ? 1 : 0, color: 'var(--ember-500)' }}>▍</span>
        </p>
        <form className="gate-form" onSubmit={handleSubmit} autoComplete="off">
          <div className="gate-field">
            <label htmlFor="g-name">True name</label>
            <input
              id="g-name"
              className="gate-input"
              type="text"
              placeholder="Wren of Cinderfen"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="gate-field">
            <label htmlFor="g-pass">Watchword</label>
            <input
              id="g-pass"
              className="gate-input"
              type="password"
              placeholder="••••••••"
              value={pass}
              onChange={e => setPass(e.target.value)}
            />
          </div>
          <div className="gate-actions">
            <button className="btn btn-primary" type="submit" style={{ width: '100%', justifyContent: 'center' }}>
              <Icon.Lantern size={16}/>
              <span>Cross the threshold</span>
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => { setName('Wren'); setPass('open'); setTimeout(() => handleSubmit({ preventDefault(){} }), 200); }} style={{ width: '100%', justifyContent: 'center', fontSize: 12 }}>
              Enter as a guest of the Keep
            </button>
          </div>
        </form>
        <p className="gate-foot">
          New here? <a href="#" onClick={e => e.preventDefault()}>Petition the Steward</a>
        </p>
      </div>
    </div>
  );
}

Object.assign(window, { Gate });
