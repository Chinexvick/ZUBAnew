// Restaurants: business accounts list their kitchen and menu, people order, the restaurant
// confirms. ZUBA goes straight from the buyer's wallet to the restaurant's wallet; the server
// only checks the payment on the blockchain and never touches the money.
import { sql } from './db.js';
import { fail, limit, readBody, requireUser, str } from './core.js';
import { checkPayment, zubaPerUsd, ZUBA_DECIMALS } from './chain.js';
import { mediaUrl, who } from './social.js';

const sid = (n) => 'srv:' + n;
const num = (v, name = 'id') => {
  const m = /^(?:srv:)?(\d{1,15})$/.exec(String(v ?? ''));
  if (!m) fail(400, `Check the ${name}`);
  return Number(m[1]);
};
const q = (req) => new URL(req.url, 'http://x').searchParams;
const text = (v, max, name) => {
  if (v == null || v === '') return '';
  if (typeof v !== 'string' || v.length > max || /[\u0000-\u0009\u000b-\u001f\u007f]/.test(v)) fail(400, `Check the ${name}`);
  return v.normalize('NFC').trim();
};
const STATUSES = { new: ['accepted', 'cancelled'], accepted: ['ready', 'cancelled'], ready: ['delivered'], awaiting_payment: ['cancelled'] };

function restJson(r, extra = {}) {
  return {
    id: sid(r.id), owner: r.username, name: r.name, cuisine: r.cuisine, city: r.city, country: r.country, about: r.about,
    photo: r.photo || null, phone: r.phone, delivery: r.delivery, pickup: r.pickup, open: r.open, zuba: !!r.wallet, ...extra,
  };
}
const itemJson = (i) => ({ id: sid(i.id), name: i.name, about: i.about, price: Number(i.price_usd), photo: i.photo || null, available: i.available });
function orderJson(o) {
  return {
    id: sid(o.id), restaurant: sid(o.restaurant_id), restaurantName: o.restaurant_name, buyer: o.buyer, items: o.items, total: Number(o.total_usd),
    pay: o.pay, status: o.status, address: o.address, note: o.note, phone: o.phone, hash: o.tx_hash, zubaUnits: o.zuba_units, payTo: o.pay_to, at: new Date(o.created_at).getTime(),
  };
}
async function business(u) {
  if (u.kind !== 'business') fail(403, 'Switch your profile to Business to list a restaurant');
}

/** GET /food?q=&city= — open restaurants with at least one dish. */
export async function list(req) {
  const u = await requireUser(req);
  await limit(`food:${u.id}`, 600, 3600);
  const s = String(q(req).get('q') || '').trim().slice(0, 40);
  const like = '%' + s.replace(/[\\%_]/g, (m) => '\\' + m) + '%';
  const rows = await sql`select r.*, x.username, w.address as wallet,
      (select count(*)::int from menu_items i where i.restaurant_id = r.id and i.available) as dishes,
      (select photo from menu_items i where i.restaurant_id = r.id and i.photo <> '' order by sort, id limit 1) as dish_photo
    from restaurants r join users x on x.id = r.owner_id left join wallets w on w.user_id = r.owner_id
    where r.open and x.email_verified and x.kind = 'business'
      and (${s} = '' or r.name ilike ${like} or r.cuisine ilike ${like} or r.city ilike ${like}
           or exists (select 1 from menu_items i where i.restaurant_id = r.id and i.name ilike ${like}))
    order by (r.owner_id = ${u.id}) desc, r.id desc limit 100`;
  return { restaurants: rows.filter((r) => r.dishes > 0 || Number(r.owner_id) === Number(u.id)).map((r) => restJson(r, { dishes: r.dishes, photo: r.photo || r.dish_photo || null })) };
}

async function restaurantById(id) {
  const [r] = await sql`select r.*, x.username, x.kind, w.address as wallet from restaurants r join users x on x.id = r.owner_id
    left join wallets w on w.user_id = r.owner_id where r.id = ${id}`;
  if (!r) fail(404, 'That restaurant is no longer listed');
  return r;
}

/** GET /food/place?id= — one restaurant and its menu. */
export async function place(req) {
  const u = await requireUser(req);
  const r = await restaurantById(num(q(req).get('id'), 'restaurant'));
  const mine = Number(r.owner_id) === Number(u.id);
  if ((!r.open || r.kind !== 'business') && !mine) fail(404, 'That restaurant is no longer listed');
  const items = await sql`select * from menu_items where restaurant_id = ${r.id} and (available or ${mine}) order by sort, id`;
  const [o] = await sql`select * from users where id = ${r.owner_id}`;
  return { restaurant: restJson(r), menu: items.map(itemJson), who: { [o.username]: who(o) } };
}

/** GET /food/mine — your restaurant, full menu and incoming orders. */
export async function mine(req) {
  const u = await requireUser(req);
  const [r] = await sql`select r.*, x.username, w.address as wallet from restaurants r join users x on x.id = r.owner_id
    left join wallets w on w.user_id = r.owner_id where r.owner_id = ${u.id}`;
  if (!r) return { restaurant: null, menu: [], orders: [] };
  const items = await sql`select * from menu_items where restaurant_id = ${r.id} order by sort, id`;
  const orders = await sql`select o.*, x.username as buyer, ${r.name}::text as restaurant_name from food_orders o join users x on x.id = o.buyer_id
    where o.restaurant_id = ${r.id} and o.status <> 'awaiting_payment' order by o.id desc limit 200`;
  return { restaurant: restJson(r), menu: items.map(itemJson), orders: orders.map(orderJson) };
}

/** POST /food/restaurant {name, cuisine, city, country, about, photo, phone, delivery, pickup, open} — business accounts only. */
export async function saveRestaurant(req) {
  const u = await requireUser(req);
  await business(u);
  const b = await readBody(req);
  await limit(`rest:${u.id}`, 60, 86400);
  const f = {
    name: str(b.name, { min: 2, max: 60, name: 'restaurant name' }),
    cuisine: text(b.cuisine, 60, 'cuisine'),
    city: str(b.city, { min: 2, max: 60, name: 'city' }),
    country: text(b.country, 56, 'country'),
    about: text(b.about, 500, 'description'),
    photo: b.photo ? mediaUrl(b.photo) : '',
    phone: text(b.phone, 30, 'phone number'),
    delivery: b.delivery !== false,
    pickup: b.pickup !== false,
    open: b.open !== false,
  };
  if (f.phone && !/^[+0-9 ()-]{6,30}$/.test(f.phone)) fail(400, 'Check the phone number');
  const [r] = await sql`insert into restaurants (owner_id, name, cuisine, city, country, about, photo, phone, delivery, pickup, open)
    values (${u.id}, ${f.name}, ${f.cuisine}, ${f.city}, ${f.country}, ${f.about}, ${f.photo}, ${f.phone}, ${f.delivery}, ${f.pickup}, ${f.open})
    on conflict (owner_id) do update set name = excluded.name, cuisine = excluded.cuisine, city = excluded.city, country = excluded.country,
      about = excluded.about, photo = excluded.photo, phone = excluded.phone, delivery = excluded.delivery, pickup = excluded.pickup, open = excluded.open
    returning *`;
  return { restaurant: restJson({ ...r, username: u.username }) };
}

/** POST /food/item {id?, name, about, price, photo, available} — add or change a dish on your menu. */
export async function saveItem(req) {
  const u = await requireUser(req);
  await business(u);
  const b = await readBody(req);
  await limit(`dish:${u.id}`, 300, 86400);
  const [r] = await sql`select id from restaurants where owner_id = ${u.id}`;
  if (!r) fail(400, 'Set up your restaurant first');
  const price = Math.round(Number(b.price) * 100) / 100;
  if (!Number.isFinite(price) || price <= 0 || price > 10000) fail(400, 'Check the price');
  const name = str(b.name, { min: 2, max: 80, name: 'dish name' });
  const about = text(b.about, 300, 'description');
  const photo = b.photo ? mediaUrl(b.photo) : '';
  const available = b.available !== false;
  let item;
  if (b.id) {
    [item] = await sql`update menu_items set name = ${name}, about = ${about}, price_usd = ${price}, photo = ${photo}, available = ${available}
      where id = ${num(b.id, 'dish')} and restaurant_id = ${r.id} returning *`;
    if (!item) fail(404, 'That dish is not on your menu');
  } else {
    const [n] = await sql`select count(*)::int as n from menu_items where restaurant_id = ${r.id}`;
    if (n.n >= 200) fail(400, 'Your menu can have up to 200 dishes');
    [item] = await sql`insert into menu_items (restaurant_id, name, about, price_usd, photo, available, sort)
      values (${r.id}, ${name}, ${about}, ${price}, ${photo}, ${available}, ${n.n}) returning *`;
  }
  return { item: itemJson(item) };
}

/** POST /food/item/delete {id} */
export async function deleteItem(req) {
  const u = await requireUser(req);
  const id = num((await readBody(req)).id, 'dish');
  await sql`delete from menu_items where id = ${id} and restaurant_id in (select id from restaurants where owner_id = ${u.id})`;
  return { ok: true };
}

/**
 * POST /food/order {restaurant, items: [{id, qty}], pay: 'zuba'|'delivery', address, phone, note}
 * Prices always come from the menu on the server, never from the phone.
 */
export async function order(req) {
  const u = await requireUser(req);
  const b = await readBody(req, 32 * 1024);
  await limit(`order:${u.id}`, 30, 3600);
  const r = await restaurantById(num(b.restaurant, 'restaurant'));
  if (!r.open || r.kind !== 'business') fail(400, 'This restaurant is not taking orders right now');
  if (Number(r.owner_id) === Number(u.id)) fail(400, 'You cannot order from your own restaurant');
  if (!Array.isArray(b.items) || !b.items.length || b.items.length > 50) fail(400, 'Add something to your order');
  const want = new Map();
  for (const it of b.items) {
    const qty = Number(it?.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > 50) fail(400, 'Check the quantities');
    const id = num(it.id, 'dish');
    want.set(id, (want.get(id) || 0) + qty);
  }
  const dishes = await sql`select * from menu_items where restaurant_id = ${r.id} and available and id = any(${[...want.keys()]}::bigint[])`;
  if (dishes.length !== want.size) fail(400, 'Some dishes are no longer available. Refresh the menu.');
  const items = dishes.map((d) => ({ id: sid(d.id), name: d.name, price: Number(d.price_usd), qty: want.get(Number(d.id)) }));
  const total = Math.round(items.reduce((a, i) => a + i.price * i.qty, 0) * 100) / 100;
  const pay = b.pay === 'zuba' ? 'zuba' : 'delivery';
  const address = r.delivery ? text(b.address, 300, 'address') : '';
  const phone = text(b.phone, 30, 'phone number');
  if (phone && !/^[+0-9 ()-]{6,30}$/.test(phone)) fail(400, 'Check the phone number');
  let units = null;
  let payTo = null;
  if (pay === 'zuba') {
    if (!r.wallet) fail(400, 'This restaurant takes payment on delivery only');
    const [w] = await sql`select 1 from wallets where user_id = ${u.id}`;
    if (!w) fail(400, 'Link your wallet first to pay with ZUBA');
    const per = await zubaPerUsd();
    units = ((per * BigInt(Math.round(total * 100))) / 100n).toString();
    payTo = String(r.wallet).toLowerCase();
  }
  const [o] = await sql`insert into food_orders (restaurant_id, buyer_id, items, total_usd, pay, status, address, phone, note, zuba_units, pay_to)
    values (${r.id}, ${u.id}, ${JSON.stringify(items)}, ${total}, ${pay}, ${pay === 'zuba' ? 'awaiting_payment' : 'new'}, ${address}, ${phone},
      ${text(b.note, 300, 'note')}, ${units}, ${payTo}) returning *`;
  if (pay === 'delivery') await newOrderNote(r, u, total);
  return { order: orderJson({ ...o, buyer: u.username, restaurant_name: r.name }), zuba: units ? (BigInt(units) / 10n ** ZUBA_DECIMALS).toString() : null };
}

async function newOrderNote(r, u, total) {
  await sql`insert into notifications (user_id, kind, text, data)
    values (${r.owner_id}, 'order', ${`New order from ${u.name || u.username}: $${total.toFixed(2)}`}, ${JSON.stringify({ restaurant: sid(r.id) })})`;
}

/** POST /food/order/paid {id, hash} — checks the ZUBA transfer from your wallet to the restaurant's. */
export async function paid(req) {
  const u = await requireUser(req);
  await limit(`orderpay:${u.id}`, 60, 3600);
  const b = await readBody(req);
  const hash = String(b.hash || '').toLowerCase();
  if (!/^0x[0-9a-f]{64}$/.test(hash)) fail(400, 'Check the transaction hash');
  const [o] = await sql`select * from food_orders where id = ${num(b.id, 'order')} and buyer_id = ${u.id}`;
  if (!o) fail(404, 'Unknown order');
  if (o.status !== 'awaiting_payment') return { status: o.status };
  const [used] = await sql`select 1 from food_orders where tx_hash = ${hash} union all select 1 from invoices where tx_hash = ${hash} limit 1`;
  if (used) fail(409, 'That payment has already been used');
  const [w] = await sql`select address from wallets where user_id = ${u.id}`;
  const c = await checkPayment(hash, w ? String(w.address).toLowerCase() : null, new Date(o.created_at).getTime(), 3, null, o.pay_to);
  if (c.status === 'pending') return { status: 'pending', reason: c.reason };
  if (c.status === 'bad') fail(400, c.reason);
  if (c.received < (BigInt(o.zuba_units) * 97n) / 100n) fail(400, 'The amount received is less than the order total');
  const [done] = await sql`update food_orders set status = 'new', tx_hash = ${hash} where id = ${o.id} and status = 'awaiting_payment' returning *`;
  if (done) {
    const [r] = await sql`select * from restaurants where id = ${o.restaurant_id}`;
    await newOrderNote(r, u, Number(o.total_usd));
  }
  return { status: 'new' };
}

/** GET /food/orders — orders you placed. */
export async function myOrders(req) {
  const u = await requireUser(req);
  const rows = await sql`select o.*, r.name as restaurant_name, ${u.username}::text as buyer from food_orders o join restaurants r on r.id = o.restaurant_id
    where o.buyer_id = ${u.id} order by o.id desc limit 100`;
  return { orders: rows.map(orderJson) };
}

/** POST /food/order/status {id, status} — the restaurant moves an order along; buyers can cancel unpaid or new orders. */
export async function setStatus(req) {
  const u = await requireUser(req);
  const b = await readBody(req);
  const [o] = await sql`select o.*, r.owner_id, r.name as restaurant_name from food_orders o join restaurants r on r.id = o.restaurant_id where o.id = ${num(b.id, 'order')}`;
  if (!o) fail(404, 'Unknown order');
  const owner = Number(o.owner_id) === Number(u.id);
  const buyer = Number(o.buyer_id) === Number(u.id);
  const next = String(b.status || '');
  const allowed = owner ? STATUSES[o.status] || [] : buyer && next === 'cancelled' && ['awaiting_payment', 'new'].includes(o.status) ? ['cancelled'] : [];
  if (!allowed.includes(next)) fail(400, owner || buyer ? 'That change is not possible for this order' : 'Unknown order');
  await sql`update food_orders set status = ${next} where id = ${o.id} and status = ${o.status}`;
  const words = { accepted: 'is being prepared', ready: 'is ready', delivered: 'was delivered. Enjoy!', cancelled: 'was cancelled' };
  const to = owner ? o.buyer_id : o.owner_id;
  await sql`insert into notifications (user_id, kind, text, data)
    values (${to}, 'order', ${owner ? `Your order from ${o.restaurant_name} ${words[next]}` : 'An order was cancelled by the buyer'}, ${JSON.stringify({ order: sid(o.id) })})`;
  return { status: next };
}
