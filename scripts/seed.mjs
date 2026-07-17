import { createClient } from "@supabase/supabase-js";

const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

const supabase = createClient(
  required("NEXT_PUBLIC_SUPABASE_URL"),
  required("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const demoUsers = [
  {
    email: "vendor.anna@zonemart.demo",
    password: required("DEMO_VENDOR_PASSWORD"),
    fullName: "Arun Kumar",
    role: "vendor",
    zone: "Anna Nagar",
  },
  {
    email: "vendor.tnagar@zonemart.demo",
    password: required("DEMO_VENDOR_PASSWORD"),
    fullName: "Meera Shah",
    role: "vendor",
    zone: "T Nagar",
  },
  {
    email: "customer@zonemart.demo",
    password: required("DEMO_CUSTOMER_PASSWORD"),
    fullName: "Demo Customer",
    role: "customer",
    zone: "Velachery",
  },
];

async function findUser(email) {
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const match = data.users.find((user) => user.email === email);
    if (match) return match;
    if (data.users.length < 100) return null;
  }
}

async function ensureUser(spec) {
  const existing = await findUser(spec.email);
  if (existing) return existing;

  const { data, error } = await supabase.auth.admin.createUser({
    email: spec.email,
    password: spec.password,
    email_confirm: true,
    user_metadata: {
      full_name: spec.fullName,
      role: spec.role,
      zone: spec.zone,
    },
  });
  if (error) throw error;
  return data.user;
}

const users = {};
for (const spec of demoUsers) {
  const user = await ensureUser(spec);
  users[spec.email] = user.id;
  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    full_name: spec.fullName,
    role: spec.role,
    zone: spec.zone,
  });
  if (error) throw error;
}

const stores = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    owner_id: users["vendor.anna@zonemart.demo"],
    name: "Circuit Corner",
    zone: "Anna Nagar",
    category_tags: ["Electronics", "Repair Essentials"],
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    owner_id: users["vendor.tnagar@zonemart.demo"],
    name: "Maker's Basket",
    zone: "T Nagar",
    category_tags: ["Stationery", "Project Materials", "Repair Essentials"],
  },
];

const { error: storesError } = await supabase.from("stores").upsert(stores);
if (storesError) throw storesError;

const circuitCorner = stores[0].id;
const makersBasket = stores[1].id;
const products = [
  ["20000000-0000-4000-8000-000000000001", circuitCorner, "65W USB-C GaN Charger", "Compact dual-port fast charger for laptops and phones.", "Electronics", 2499, 2],
  ["20000000-0000-4000-8000-000000000002", circuitCorner, "USB-C to USB-C Cable 2m", "100W braided charging and data cable.", "Electronics", 699, 14],
  ["20000000-0000-4000-8000-000000000003", circuitCorner, "Wireless Mouse", "Silent-click 2.4GHz mouse with USB receiver.", "Electronics", 849, 8],
  ["20000000-0000-4000-8000-000000000004", circuitCorner, "32GB USB 3.0 Drive", "Pocket flash drive for presentations and project files.", "Electronics", 549, 20],
  ["20000000-0000-4000-8000-000000000005", circuitCorner, "9V Battery", "Alkaline battery for meters and electronics projects.", "Project Materials", 110, 3],
  ["20000000-0000-4000-8000-000000000006", circuitCorner, "Precision Screwdriver Set", "24-bit magnetic repair toolkit.", "Repair Essentials", 799, 7],
  ["20000000-0000-4000-8000-000000000007", circuitCorner, "Insulation Tape Pack", "Flame-retardant electrical tape, pack of three.", "Repair Essentials", 180, 18],
  ["20000000-0000-4000-8000-000000000008", circuitCorner, "Soldering Iron 25W", "Fine-tip iron for quick electronics repairs.", "Repair Essentials", 625, 1],
  ["20000000-0000-4000-8000-000000000009", circuitCorner, "Mini Breadboard", "400-point solderless prototyping board.", "Project Materials", 160, 12],
  ["20000000-0000-4000-8000-000000000010", makersBasket, "A4 Project Sheets", "Pack of 50 ruled and bordered sheets.", "Stationery", 145, 25],
  ["20000000-0000-4000-8000-000000000011", makersBasket, "Black Permanent Markers", "Quick-dry chisel-tip markers, pack of four.", "Stationery", 220, 11],
  ["20000000-0000-4000-8000-000000000012", makersBasket, "Graph Notebook", "A4 notebook with 1mm graph pages.", "Stationery", 190, 9],
  ["20000000-0000-4000-8000-000000000013", makersBasket, "Foam Board A3", "5mm white presentation and model board.", "Project Materials", 120, 16],
  ["20000000-0000-4000-8000-000000000014", makersBasket, "Hot Glue Gun", "20W compact glue gun for model making.", "Project Materials", 499, 4],
  ["20000000-0000-4000-8000-000000000015", makersBasket, "Hot Glue Sticks Pack", "Transparent 7mm glue sticks, pack of ten.", "Project Materials", 175, 21],
  ["20000000-0000-4000-8000-000000000016", makersBasket, "Jumper Wires M-M", "40-piece breadboard jumper wire ribbon.", "Project Materials", 135, 15],
  ["20000000-0000-4000-8000-000000000017", makersBasket, "Double-Sided Mounting Tape", "Strong foam tape for prototypes and displays.", "Repair Essentials", 210, 6],
  ["20000000-0000-4000-8000-000000000018", makersBasket, "Craft Knife Set", "Precision knife with five replacement blades.", "Repair Essentials", 285, 2],
].map(([id, store_id, name, description, category, price, stock]) => ({
  id,
  store_id,
  name,
  description,
  category,
  price,
  stock,
  image_url: null,
  active: true,
}));

const { error: productsError } = await supabase.from("products").upsert(products);
if (productsError) throw productsError;

console.log(
  `Seed complete: ${demoUsers.length} demo users, ${stores.length} stores, ${products.length} products.`,
);
