export async function onRequestGet(context) {
  const { searchParams } = new URL(context.request.url);
  const uid = searchParams.get('uid');

  if (!uid) {
    return new Response(JSON.stringify({ error: "UID requerido" }), { 
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const data = await context.env.AURA_KV.get(uid);
  if (!data) {
    return new Response(JSON.stringify({ error: "Cliente no registrado" }), { 
      status: 404,
      headers: { "Content-Type": "application/json" }
    });
  }

  return new Response(data, {
    headers: { "Content-Type": "application/json" }
  });
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const { uid, action, customerData, notification } = body;

    if (!uid) {
      return new Response(JSON.stringify({ error: "UID requerido" }), { 
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    let record = await context.env.AURA_KV.get(uid);
    let customer = record ? JSON.parse(record) : customerData;

    if (!customer && action !== "REGISTER") {
      return new Response(JSON.stringify({ error: "Cliente no existe" }), { status: 404 });
    }

    if (action === "REGISTER") {
      customer = customerData;
    } else if (action === "ADD_STAMP") {
      if (customer.stamps < 6) {
        customer.stamps = (customer.stamps || 0) + 1;
      }
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
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
