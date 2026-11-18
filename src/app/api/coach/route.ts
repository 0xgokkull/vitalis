import { connection, NextRequest, NextResponse } from 'next/server';
import { getCoachContext, SYSTEM_PROMPT } from '@/lib/coach';
import { CoachLimitError, sseToText, streamChat, type ChatMessage } from '@/lib/groq';
import { asUser } from '@/lib/healthData';
import { getSessionEmail } from '@/lib/session';

// Streamed answers can take a while on the slower fallback models.
export const maxDuration = 60;

// Everyone shares the Groq keys, so each person gets a fair share per day.
const PER_DAY = Number(process.env.COACH_DAILY_LIMIT) || 100;
const asked = new Map<string, number[]>();
function overLimit(email: string) {
  const since = Date.now() - 86400_000;
  const times = (asked.get(email) ?? []).filter((t) => t > since);
  if (times.length >= PER_DAY) return Math.ceil((times[0] + 86400_000 - Date.now()) / 3600_000);
  asked.set(email, [...times, Date.now()]);
  return 0;
}

// Chat with the coach (streams plain text). The client sends only the conversation and the day on screen;
// the band data is loaded here, so nothing the browser sends can change the numbers.
export async function POST(req: NextRequest) {
  await connection();
  const email = await getSessionEmail();
  if (!email) return NextResponse.json({ error: 'Sign in to talk to the coach.' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { date?: string; messages?: ChatMessage[] };
  const history = (body.messages ?? [])
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-10) // keep requests small: Groq limits tokens per minute
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  if (!history.length || history[history.length - 1].role !== 'user') {
    return NextResponse.json({ error: 'Ask a question first.' }, { status: 400 });
  }

  const hours = overLimit(email);
  if (hours) {
    return NextResponse.json({ error: `That's your ${PER_DAY} questions for today. Ask again in about ${hours} hour${hours === 1 ? '' : 's'}.` }, { status: 429 });
  }

  try {
    const context = await asUser(email, () => getCoachContext(email, body.date));
    const { body: stream, model } = await streamChat([
      { role: 'system', content: `${SYSTEM_PROMPT}\n\n=== BAND DATA ===\n${context}` },
      ...history,
    ]);
    return new Response(sseToText(stream), {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Coach-Model': model },
    });
  } catch (e) {
    if (e instanceof CoachLimitError) {
      const min = Math.max(1, Math.ceil(e.retryInMs / 60000));
      return NextResponse.json(
        { error: `I've used up my free answers on every Groq key for now. Try again in about ${min} minute${min === 1 ? '' : 's'}, or add another key to GROQ_API_KEY.` },
        { status: 429 }
      );
    }
    const msg = (e as Error).message;
    if (msg === 'not_connected' || msg === 'needs_reauth') {
      return NextResponse.json({ error: 'Your Google connection has expired. Reload the page to connect again.' }, { status: 401 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
