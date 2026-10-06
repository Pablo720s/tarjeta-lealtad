export async function onRequestGet(context) {
  const { searchParams } = new URL(context.request.url);
  const uid = searchParams.get('uid');

  if (!uid) {
    return new Response(JSON.stringify({ error: "UID requerido" }), { status: 400 });
  }

  // Busca los datos del cliente y el buzón global de notificaciones
  const customerRaw = await context.env.AURA_KV.get(uid);
  const globalNotifRaw = await context.env.AURA_KV.get('AURA_GLOBAL_NOTIF');

  if (!customerRaw) {
    return new Response(JSON.stringify({ error: "Cliente no registrado" }), { status: 404 });
  }

  return new Response(JSON.stringify({
    customer: JSON.parse(customerRaw),
    globalNotification: globalNotifRaw ? JSON.parse(globalNotifRaw) : null
  }), {
    headers: { "Content-Type": "application/json" }
  });
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const { uid, action, customerData, notification } = body;

    // Disparador de Notificación Global (A todos los clientes)
    if (action === "BROADCAST") {
      const globalData = {
        title: notification.title,
        body: notification.body,
        id: Date.now()
      };
      await context.env.AURA_KV.put('AURA_GLOBAL_NOTIF', JSON.stringify(globalData));
      return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
    }

    if (!uid) return new Response(JSON.stringify({ error: "UID requerido" }), { status: 400 });

    let record = await context.env.AURA_KV.get(uid);
    let customer = record ? JSON.parse(record) : customerData;

    if (!customer && action !== "REGISTER") {
      return new Response(JSON.stringify({ error: "Cliente no existe" }), { status: 404 });
    }

    if (action === "REGISTER") {
      customer = customerData;
    } else if (action === "ADD_STAMP") {
      if (customer.stamps < 6) customer.stamps = (customer.stamps || 0) + 1;
    } else if (action === "REDEEM") {
      customer.stamps = 0;
    } else if (action === "SEND_NOTIFICATION") {
      customer.pendingNotification = {
        title: notification.title,
        body: notification.body,
        id: Date.now()
      };
    }

    await context.env.AURA_KV.put(uid, JSON.stringify(customer));

    return new Response(JSON.stringify(customer), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
