import { SignJWT, importPKCS8 } from 'https://esm.sh/jose@5.2.3';

// === TUS LLAVES VAPID AQUÍ ===
const VAPID_PUBLIC = "BAnT5bbpr4oahQev16GudpIJUpg0_3Kgz20jGLFnBsFeK6-_72MtBXvK3M-BruCeTXNWYWEspRrfrUONCJ2OpGM";
const VAPID_PRIVATE = "YldH1B9DXb5taKwGykHO31HSPbWihtA7TQoUdedDDgQ";
const CONTACT_EMAIL = "mailto:admin@tu-dominio.com";

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  const uid = url.searchParams.get('uid');

  // --- SOLICITUDES GET (Leer datos) ---
  if (request.method === 'GET') {
    // Cuando el teléfono despierta, pide el mensaje pendiente
    if (action === 'GET_PENDING' && uid) {
      let notif = await env.PUSH_KV.get(`PENDING_${uid}`, { type: 'json' });
      if (notif) {
        await env.PUSH_KV.delete(`PENDING_${uid}`); // Lo borramos para no repetirlo
      } else {
        notif = await env.PUSH_KV.get(`PENDING_GLOBAL`, { type: 'json' }); // Busca si hay uno masivo
      }
      return new Response(JSON.stringify(notif || {}), { headers: { 'Content-Type': 'application/json' } });
    }
    
    // Leer perfil del cliente
    if (uid) {
      const customer = await env.PUSH_KV.get(`USER_${uid}`, { type: 'json' });
      if (customer) return new Response(JSON.stringify({ customer }), { headers: { 'Content-Type': 'application/json' } });
      return new Response("No encontrado", { status: 404 });
    }
    return new Response("Invalid GET", { status: 400 });
  }

  // --- SOLICITUDES POST (Guardar datos y enviar alertas) ---
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

// --- MAGIA CRIPTOGRÁFICA (VAPID) ---
async function triggerPush(subscription, vapidPub, vapidPriv) {
  try {
    // Truco hacker: Convertir la llave cruda de VAPID a formato PKCS#8 para WebCrypto
    const rawHex = atob(vapidPriv.replace(/-/g, '+').replace(/_/g, '/')).split('').map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
    const prefix = "3041020100301306072a8648ce3d020106082a8648ce3d030107042730250201010420";
    const pkcs8Bytes = new Uint8Array((prefix + rawHex).match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    const pem = `-----BEGIN PRIVATE KEY-----\n${btoa(String.fromCharCode(...pkcs8Bytes))}\n-----END PRIVATE KEY-----`;
    
    const privateKey = await importPKCS8(pem, 'ES256');
    const origin = new URL(subscription.endpoint).origin;

    const jwt = await new SignJWT({ aud: origin, sub: CONTACT_EMAIL })
      .setProtectedHeader({ alg: 'ES256', typ: 'JWT' })
      .setExpirationTime('12h')
      .sign(privateKey);

    await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `vapid t=${jwt}, k=${vapidPub}`,
        'Content-Length': '0' // Disparo sin carga (Despierta el celular)
      }
    });
  } catch (e) { console.error("Error Push:", e); }
}
