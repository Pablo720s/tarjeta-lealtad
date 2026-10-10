// === TUS LLAVES VAPID AQUÍ ===
const VAPID_PUBLIC = "BAnT5bbpr4oahQev16GudpIJUpg0_3Kgz20jGLFnBsFeK6-_72MtBXvK3M-BruCeTXNWYWEspRrfrUONCJ2OpGM";
const VAPID_PRIVATE = "YldH1B9DXb5taKwGykHO31HSPbWihtA7TQoUdedDDgQ";
const CONTACT_EMAIL = "mailto:admin@tu-dominio.com";

// --- MAGIA CRIPTOGRÁFICA 100% NATIVA (Sin librerías externas) ---
function base64UrlEncode(str) {
  return btoa(unescape(encodeURIComponent(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64UrlEncodeBuffer(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function createVapidJwt(aud, vapidPriv) {
  const header = { alg: 'ES256', typ: 'JWT' };
  const payload = {
    aud: aud,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: CONTACT_EMAIL
  };
  
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const dataToSign = `${encodedHeader}.${encodedPayload}`;
  
  const rawHex = atob(vapidPriv.replace(/-/g, '+').replace(/_/g, '/')).split('').map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
  const prefix = "3041020100301306072a8648ce3d020106082a8648ce3d030107042730250201010420";
  const pkcs8Bytes = new Uint8Array((prefix + rawHex).match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
  
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pkcs8Bytes,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    key,
    new TextEncoder().encode(dataToSign)
  );
  
  return `${dataToSign}.${base64UrlEncodeBuffer(signature)}`;
}

async function triggerPush(subscription, vapidPub, vapidPriv) {
  try {
    const origin = new URL(subscription.endpoint).origin;
    const jwt = await createVapidJwt(origin, vapidPriv);

    await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `vapid t=${jwt}, k=${vapidPub}`,
        'Content-Length': '0'
      }
    });
  } catch (e) { console.error("Error Push:", e); }
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  const uid = url.searchParams.get('uid');

  if (request.method === 'GET') {
    if (action === 'GET_PENDING' && uid) {
      let notif = await env.PUSH_KV.get(`PENDING_${uid}`, { type: 'json' });
      if (notif) {
        await env.PUSH_KV.delete(`PENDING_${uid}`);
      } else {
        notif = await env.PUSH_KV.get(`PENDING_GLOBAL`, { type: 'json' });
      }
      return new Response(JSON.stringify(notif || {}), { headers: { 'Content-Type': 'application/json' } });
    }
    
    if (uid) {
      const customer = await env.PUSH_KV.get(`USER_${uid}`, { type: 'json' });
      if (customer) return new Response(JSON.stringify({ customer }), { headers: { 'Content-Type': 'application/json' } });
      return new Response("No encontrado", { status: 404 });
    }
    return new Response("Invalid GET", { status: 400 });
  }

  if (request.method === 'POST') {
    const body = await request.json();
    const reqAction = body.action;

    if (reqAction === 'REGISTER') {
      await env.PUSH_KV.put(`USER_${body.uid}`, JSON.stringify(body.customerData));
      return new Response("OK");
    }

    if (reqAction === 'SUBSCRIBE') {
      await env.PUSH_KV.put(`SUB_${body.uid}`, JSON.stringify(body.subscription));
      return new Response("OK");
    }

    if (reqAction === 'SEND_NOTIFICATION') {
      await env.PUSH_KV.put(`PENDING_${body.uid}`, JSON.stringify(body.notification));
      const subRaw = await env.PUSH_KV.get(`SUB_${body.uid}`);
      if (subRaw) await triggerPush(JSON.parse(subRaw), VAPID_PUBLIC, VAPID_PRIVATE);
      return new Response("OK");
    }

    if (reqAction === 'BROADCAST') {
      await env.PUSH_KV.put(`PENDING_GLOBAL`, JSON.stringify(body.notification));
      const list = await env.PUSH_KV.list({ prefix: 'SUB_' });
      for (const key of list.keys) {
        const subRaw = await env.PUSH_KV.get(key.name);
        if (subRaw) await triggerPush(JSON.parse(subRaw), VAPID_PUBLIC, VAPID_PRIVATE);
      }
      return new Response("OK");
    }
  }
  return new Response("Bad Request", { status: 400 });
}
