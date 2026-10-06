export async function onRequestGet(context) {
  const { searchParams } = new URL(context.request.url);
  const uid = searchParams.get('uid');

  if (!uid) {
    return new Response(JSON.stringify({ error: "UID requerido" }), { status: 400 });
  }

  const customerRaw = await context.env.AURA_KV.get(uid);
  if (!customerRaw) {
    return new Response(JSON.stringify({ error: "Cliente no registrado" }), { status: 404 });
  }

  return new Response(JSON.stringify({
    customer: JSON.parse(customerRaw)
  }), {
    headers: { "Content-Type": "application/json" }
  });
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const { uid, action, customerData, notification } = body;
    const APP_ID = "d58ea2fb-a340-4669-9e14-f8baaf7cba74";
    const API_KEY = "342iey2k3ugznnjys3rgmjyrw";

    if (action === "BROADCAST") {
      await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Basic " + API_KEY },
        body: JSON.stringify({
          app_id: APP_ID,
          included_segments: ["Subscribed Users"],
          headings: { en: notification.title, es: notification.title },
          contents: { en: notification.body, es: notification.body }
        })
      });
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
      await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Basic " + API_KEY },
        body: JSON.stringify({
          app_id: APP_ID,
          include_aliases: { external_id: [uid] },
          target_channel: "push",
          headings: { en: notification.title, es: notification.title },
          contents: { en: notification.body, es: notification.body }
        })
      });
    }

    await context.env.AURA_KV.put(uid, JSON.stringify(customer));

    return new Response(JSON.stringify(customer), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
