import { ImageResponse } from 'next/og';

// Preview card shown when a Vitalis link is shared.
export const alt = 'Vitalis: your sleep, heart and movement around the clock';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function TwitterImage() {
  const C = 315;
  const R = 205;
  // A dial: night arc in sleep colours, a day arc in green, ticks every hour.
  const arc = (a0: number, a1: number, r = R) => {
    const p = (a: number) => [C + r * Math.cos(((a - 90) * Math.PI) / 180), C + r * Math.sin(((a - 90) * Math.PI) / 180)];
    const [x0, y0] = p(a0);
    const [x1, y1] = p(a1);
    return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  };
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: '#0e1424', color: '#e7ebf3', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 0 0 80px', width: 640 }}>
          <svg width="112" height="112" viewBox="0 0 512 512">
            <rect width="512" height="512" rx="120" fill="#8E9BFF" />
            <path d="M140 164L256 372L352 200" fill="none" stroke="#0E1424" strokeWidth="48" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="378" cy="150" r="34" fill="#FF6B8E" />
          </svg>
          <div style={{ fontSize: 112, fontWeight: 700, letterSpacing: -4, marginTop: 28 }}>vitalis</div>
          <div style={{ fontSize: 38, color: '#b4bdd0', marginTop: 12, lineHeight: 1.25 }}>Your sleep, heart and movement around the clock.</div>
        </div>
        <svg width="630" height="630" viewBox="0 0 630 630">
          <circle cx={C} cy={C} r={R} fill="none" stroke="#1c2540" strokeWidth="44" />
          <path d={arc(-45 + 360, 360)} fill="none" stroke="#6c7bff" strokeWidth="44" />
          <path d={arc(0, 40)} fill="none" stroke="#3c4688" strokeWidth="44" />
          <path d={arc(40, 70)} fill="none" stroke="#b49cff" strokeWidth="44" />
          <path d={arc(70, 120)} fill="none" stroke="#3c4688" strokeWidth="44" />
          <path d={arc(120, 128)} fill="none" stroke="#ffc15a" strokeWidth="44" />
          <path d={arc(255, 275, 160)} fill="none" stroke="#4cc38a" strokeWidth="16" strokeLinecap="round" />
          <circle cx={C} cy={C} r="96" fill="#161e33" />
          <line x1={C} y1={C - 96} x2={C} y2={C - 232} stroke="#e7ebf3" strokeWidth="4" strokeLinecap="round" />
        </svg>
      </div>
    ),
    size
  );
}
