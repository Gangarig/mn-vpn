const url = 'https://qoqllxnfzueyyrfbbdtx.supabase.co';
const key = 'sb_publishable_L5B6xrQRit2ADwxO9ZC3eA_bXN-P3-G';
const headers = (token) => ({ apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' });
const $ = (id) => document.getElementById(id);
let session;

async function request(path, options = {}, token = session?.access_token) {
  const response = await fetch(`${url}${path}`, { ...options, headers: { ...headers(token), ...options.headers } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.msg || body.message || 'Request failed');
  return body;
}
function render() {
  $('auth').hidden = Boolean(session); $('dashboard').hidden = !session;
  if (session) { $('account').textContent = session.user.email; refresh(); }
}
async function refresh() {
  const sessions = await request('/rest/v1/connection_sessions?select=id,ended_at&ended_at=is.null&limit=1');
  session.activeId = sessions[0]?.id || null;
  $('state').textContent = session.activeId ? 'Connected' : 'Disconnected';
  $('dot').classList.toggle('on', Boolean(session.activeId));
  $('toggle').textContent = session.activeId ? 'Disconnect' : 'Connect';
}
$('auth').addEventListener('submit', async (event) => { event.preventDefault(); try { session = await request('/auth/v1/token?grant_type=password', { method:'POST', body:JSON.stringify({ email:$('email').value.trim(), password:$('password').value }) }, key); await chrome.storage.local.set({ session }); render(); } catch (error) { $('message').textContent = error.message; } });
$('signup').addEventListener('click', async () => { try { await request('/auth/v1/signup', { method:'POST', body:JSON.stringify({ email:$('email').value.trim(), password:$('password').value }) }, key); $('message').textContent = 'Check your email to confirm your account, then log in.'; } catch (error) { $('message').textContent = error.message; } });
$('toggle').addEventListener('click', async () => { $('toggle').disabled = true; try { if (session.activeId) await request(`/rest/v1/connection_sessions?id=eq.${session.activeId}`, { method:'PATCH', body:JSON.stringify({ ended_at:new Date().toISOString() }), headers:{ Prefer:'return=minimal' } }); else await request('/rest/v1/connection_sessions', { method:'POST', body:JSON.stringify({ user_id:session.user.id, server_location:'Ulaanbaatar, MN' }), headers:{ Prefer:'return=minimal' } }); await refresh(); } catch (error) { $('message').textContent = error.message; } finally { $('toggle').disabled = false; } });
$('logout').addEventListener('click', async () => { await request('/auth/v1/logout', { method:'POST' }); session = null; await chrome.storage.local.remove('session'); render(); });
chrome.storage.local.get('session').then(({ session: saved }) => { session = saved; render(); });
