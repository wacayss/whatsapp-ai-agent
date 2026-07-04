// orders.js
// Halkan ku beddel si aad ula xiriirto database-kaaga dhabta ah
// (Shopify, WooCommerce, Google Sheets, ama SQL database kasta).
// Hadda waxaan isticmaaleynaa mock data si tusaale u noqoto.

const MOCK_ORDERS = {
  "1001": {
    status: "Wuu socdaa (in transit)",
    product: "Nikey Air Max - cabbir 42",
    eta: "2 maalmood",
    total: "45 USD",
  },
  "1002": {
    status: "La gaarsiiyay (delivered)",
    product: "Qalab Kabo Dumar",
    eta: "Waa la dhammeeyay",
    total: "30 USD",
  },
  "1003": {
    status: "La diyaarinayaa (processing)",
    product: "Saacad gacanta",
    eta: "3-5 maalmood",
    total: "60 USD",
  },
};

/**
 * Raadi xaaladda dalabka
 * @param {string} orderId
 */
export function getOrderStatus(orderId) {
  const order = MOCK_ORDERS[orderId];
  if (!order) {
    return {
      found: false,
      message: `Lambarka dalabka ${orderId} lama helin. Fadlan hubi lambarka ama la xiriir taageerada.`,
    };
  }
  return {
    found: true,
    orderId,
    ...order,
  };
}

/**
 * Liis guud oo alaabta la heli karo (tusaale)
 */
export function getProductCatalog() {
  return [
    { name: "Nikey Air Max", price: "45 USD", inStock: true },
    { name: "Qalab Kabo Dumar", price: "30 USD", inStock: true },
    { name: "Saacad gacanta", price: "60 USD", inStock: false },
  ];
}
