import { useState } from 'react';
import './pocket-harbor.css';

const titles = [
  'Captain of Extremely Short Voyages',
  'Admiral of the Biscuit Tin',
  'Chief Officer of Sideways Navigation',
  'Minister for Very Small Waves',
];

function CrabCaptain() {
  return <svg viewBox="0 0 110 90" aria-hidden="true">
    <g stroke="#29464a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M29 59L14 66L9 78M34 68L24 81M80 59L98 66L103 78M76 68L86 81" fill="none" stroke="#bd7355" strokeWidth="5" />
      <path d="M31 50L17 34M80 50L94 31" fill="none" stroke="#d88b65" strokeWidth="6" />
      <path className="pocket-harbor-claw" d="M17 37C-1 32 1 17 10 15L15 25L23 14C34 24 29 37 17 37Z" fill="#e8ac76" />
      <path d="M95 34C78 29 81 13 90 12L95 23L102 13C115 23 107 37 95 34Z" fill="#e8ac76" />
      <ellipse cx="56" cy="58" rx="30" ry="23" fill="#dc8d67" />
      <path d="M44 40V29M68 40V29" fill="none" stroke="#dc8d67" strokeWidth="6" />
      <ellipse cx="43" cy="30" rx="6" ry="9" fill="#fff0d0" /><ellipse cx="69" cy="30" rx="6" ry="9" fill="#fff0d0" />
      <circle cx="44" cy="30" r="2" fill="#29464a" /><circle cx="68" cy="30" r="2" fill="#29464a" />
      <path d="M46 60Q56 69 67 60" fill="none" />
      <path d="M32 19Q37 2 56 7Q75 2 82 19L77 25H37Z" fill="#f6e7bd" />
      <path d="M37 22H77L73 28H40Z" fill="#35555d" /><path d="M56 11V20M51 16H61" stroke="#b68b48" strokeWidth="2" />
    </g>
  </svg>;
}

/** A small optional toy; the parent owns whether Button has unlocked the tin. */
export default function PocketHarbor({ open }: { open: boolean }) {
  const [away, setAway] = useState(false);
  const [bell, setBell] = useState(0);
  const [title, setTitle] = useState(0);
  const [message, setMessage] = useState('A whole harbor. Pocket-sized. Captain included.');

  if (!open) return <div className="pocket-harbor pocket-harbor-closed">
    <svg viewBox="0 0 600 320" role="img" aria-label="Pip’s closed brass travel tin, with a crab-shaped latch">
      <ellipse cx="300" cy="267" rx="215" ry="22" fill="#244a4920" />
      <g stroke="#4c594c" strokeWidth="4" strokeLinejoin="round">
        <rect x="85" y="81" width="430" height="176" rx="39" fill="#b89151" />
        <rect x="85" y="56" width="430" height="178" rx="39" fill="#d2ad69" />
        <rect x="102" y="72" width="396" height="145" rx="28" fill="none" stroke="#f1d69a" strokeWidth="3" />
        <path d="M173 164Q220 143 265 164T357 163T430 161" fill="none" stroke="#947b49" />
        <path d="M266 141L271 126H316L322 141L339 143L324 157H272L255 143Z" fill="#ba9558" stroke="#947b49" />
        <path d="M286 125V105H306V125M290 108H302" fill="#d9b679" stroke="#947b49" />
        <rect x="274" y="215" width="51" height="44" rx="10" fill="#e0bd7a" />
        <path d="M286 238L279 230M313 238L320 230M287 246L279 251M313 246L321 251" stroke="#8e754b" />
        <ellipse cx="300" cy="239" rx="12" ry="8" fill="#ae8648" /><path d="M295 232V227M305 232V227" stroke="#8e754b" />
      </g>
    </svg>
    <p>A crab-shaped latch. Someone small might know what to do.</p>
  </div>;

  return <div className="pocket-harbor">
    <p className="pocket-harbor-intro">Pip’s travel tin opens onto a very small, very busy bay.</p>
    <div className="pocket-harbor-scene">
      <svg className="pocket-harbor-tin" viewBox="0 0 600 380" role="img" aria-label={`A miniature harbor in an open brass tin. The ferry is ${away ? 'sailing toward the lighthouse' : 'at the village quay'}. A tiny crab wears a captain’s hat.`}>
        <ellipse cx="300" cy="354" rx="230" ry="17" fill="#244a4920" />
        <g stroke="#3d5550" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M80 173L92 56Q95 34 123 34H480Q504 34 508 60L521 173Z" fill="#c4a05e" />
          <path d="M97 157L108 61Q109 51 124 51H477Q490 51 492 64L502 157Z" fill="#d6dfc9" />
          <path d="M101 124Q172 88 222 129Q258 104 306 130Q366 70 411 114Q451 96 500 128V157H99Z" fill="#84a89b" stroke="none" />
          <path d="M107 149Q192 125 236 150T349 143T498 151" fill="none" stroke="#537d79" />
          <circle cx="393" cy="85" r="17" fill="#eccc8d" stroke="none" />
          <path d="M85 170H515L545 288Q551 326 511 337H91Q51 326 57 288Z" fill="#b68d4c" />
          <path d="M89 170H511L529 283Q535 309 508 317H92Q65 309 71 283Z" fill="#dfbe7d" />
          <path d="M105 184H495L509 280Q514 298 491 302H109Q86 298 91 280Z" fill="#78aaa4" />
          <path d="M98 270Q143 256 186 272T277 267T372 270T507 268M102 287Q164 272 208 286T315 285T419 283T501 286" fill="none" stroke="#b7d2bc" strokeWidth="2" />
          <path d="M95 227L106 183H204L217 229Z" fill="#b7be91" />
          <path d="M398 226L410 183H495L502 231Z" fill="#a3b5a1" />
          <path d="M117 213V182H151V213M157 213V178H188V213" fill="#e3bd86" />
          <path d="M111 182L135 163L156 182M152 178L173 159L194 178" fill="#b87760" />
          <path d="M129 212V198H139V213M169 211V193H179V211" fill="#537973" />
          <path d="M445 217L450 167H471L477 217Z" fill="#f1e0b0" />
          <path d="M448 183H473V194H447Z" fill="#ba7560" />
          <path d="M447 167V152H474V167Z" fill="#d6c28a" /><path d="M443 152L460 138L478 152Z" fill="#49666a" />
          <path d="M146 228Q274 264 411 228" fill="none" stroke="#e4d8ab" strokeDasharray="3 8" strokeWidth="2" />
          <path d="M106 221H196M128 222V234M177 222V234" fill="none" stroke="#8c784d" strokeWidth="6" />
        </g>
        <g className={`pocket-harbor-boat ${away ? 'is-away' : ''}`}>
          <g stroke="#304f52" strokeWidth="2.5" strokeLinejoin="round">
            <path d="M-35 0H40L27 17H-23Z" fill="#b96652" /><path d="M-23 0V-17H22V0" fill="#f3deb0" />
            <path d="M-15-17V-28H8V-17" fill="#e8c883" /><path d="M-17-29H11" stroke="#38565a" strokeWidth="4" />
            <path d="M-16-10H-8M0-10H8M15-10H20" stroke="#467c80" strokeWidth="4" /><path d="M-27 8H30" stroke="#ecca8e" strokeWidth="2" />
          </g>
        </g>
        {bell > 0 && <g key={bell} className="pocket-harbor-note" aria-hidden="true">
          <path d="M244 166Q239 137 253 117M285 159Q301 142 299 123" fill="none" stroke="#efddab" strokeWidth="3" strokeLinecap="round" />
          <text x="274" y="112" textAnchor="middle">{bell % 3 === 0 ? 'DING DING!' : 'ding!'}</text>
        </g>}
      </svg>
      <button type="button" className="pocket-harbor-captain" onClick={() => {
        const next = (title + 1) % titles.length;
        setTitle(next);
        setMessage(`Promoted! ${titles[next]}. The paperwork is mostly crumbs.`);
      }} aria-label={`Promote the tiny crab captain. Current title: ${titles[title]}`}>
        <CrabCaptain />
      </button>
      <span className="pocket-harbor-captain-hint" aria-hidden="true">Captain?</span>
    </div>
    <div className="pocket-harbor-controls">
      <button type="button" onClick={() => {
        setBell(value => value + 1);
        setMessage(bell % 3 === 2 ? 'Ding ding! All biscuits aboard. The captain insists.' : 'Ding! One small bell. A very important announcement.');
      }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16V10C6 2 18 2 18 10V16L21 19H3ZM10 22H14M12 2V4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg> Ring the bell</button>
      <button type="button" onClick={() => {
        setAway(value => !value);
        setMessage(away ? 'Homeward bound. Nobody lost at sea. Excellent work, everyone.' : 'The tiny ferry sets sail. Estimated journey: one biscuit.');
      }}><span aria-hidden="true">↝</span> {away ? 'Bring the ferry home' : 'Launch the tiny ferry'}</button>
    </div>
    <p className="pocket-harbor-status" role="status">{message}</p>
    <p className="pocket-harbor-rank">{titles[title]}</p>
  </div>;
}
