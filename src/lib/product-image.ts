type ProductImageInput = {
  name: string;
  category?: string;
  image_url?: string | null;
};

export function productImage({ name, category = "", image_url }: ProductImageInput) {
  if (image_url?.startsWith("/")) return image_url;

  const value = `${name} ${category}`.toLowerCase();
  if (value.includes("charger") || value.includes("cable")) return "/products/usb-charger-hub.jpg";
  if (value.includes("mouse")) return "/products/wireless-mouse.jpg";
  if (value.includes("usb") || value.includes("drive")) return "/products/usb-hub.jpg";
  if (value.includes("screwdriver") || value.includes("knife")) return "/products/screwdriver-set.jpg";
  if (value.includes("solder") || value.includes("repair")) return "/products/repair-drill.jpg";
  if (value.includes("wire") || value.includes("battery") || value.includes("tape")) return "/products/copper-wire.jpg";
  if (value.includes("marker")) return "/products/journal.jpg";
  if (value.includes("notebook") || value.includes("sheet")) return "/products/notebook.jpg";
  if (value.includes("breadboard") || value.includes("foam") || value.includes("glue")) return "/products/project-materials.jpg";
  if (category === "Stationery") return "/products/notebook.jpg";
  if (category === "Electronics") return "/products/mechanical-keyboard.jpg";
  return "/products/project-materials.jpg";
}
